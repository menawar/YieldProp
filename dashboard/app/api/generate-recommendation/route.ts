/**
 * API route to compute a price recommendation.
 * Returns recommendation data only; submission is done client-side via user's wallet.
 * Uses OpenAI + market data (RentCast when configured) with safe fallback logic.
 */

import { NextResponse } from 'next/server'
import { createPublicClient, http, formatUnits, type Address } from 'viem'
import { sepolia } from 'viem/chains'
import { getMarketDataForAddress } from '@/lib/redfin-adapter'

// In-memory rate limit: 15 requests per minute per IP
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 15
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

const VALUATION_MIN = 1
const VALUATION_MAX = 1_000_000_000_000

const PRICE_MANAGER_ABI = [
  {
    inputs: [],
    name: 'getCurrentRentalPrice',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

type MarketData = {
  averageRent: number
  medianRent: number
  occupancyRate: number
  rentGrowthYoY: number
  comparableCount: number
  source: 'rentcast' | 'reference'
}

/**
 * Rule-based fallback recommendation.
 */
function getRecommendation(
  valuation: number,
  currentPriceUsd?: number
): { price: number; confidence: number; reasoning: string; source: 'fallback' } {
  const baseRent = valuation * 0.004
  let price = Math.round(baseRent)
  if (currentPriceUsd && currentPriceUsd > 0) {
    const maxChange = currentPriceUsd * 0.1
    const diff = price - currentPriceUsd
    if (Math.abs(diff) > maxChange) {
      price = Math.round(currentPriceUsd + Math.sign(diff) * maxChange)
    }
  }
  return {
    price,
    confidence: 75,
    reasoning:
      `Rule-based recommendation: $${price}/month based on property valuation ($${valuation.toLocaleString()}). ` +
      `Typical rent 0.3-0.5% of valuation. ${currentPriceUsd ? `Current rent: $${currentPriceUsd}. ` : ''}` +
      'Using fallback mode because AI or market-data service is unavailable.',
    source: 'fallback',
  }
}

function clampToOnchainBounds(price: number, currentPriceUsd?: number) {
  if (!currentPriceUsd || currentPriceUsd <= 0) return Math.max(1, Math.round(price))
  const lower = Math.round(currentPriceUsd * 0.5)
  const upper = Math.round(currentPriceUsd * 1.5)
  return Math.max(lower, Math.min(upper, Math.round(price)))
}

async function fetchRentcastMarketData(
  propertyAddress: string,
  propertyType: string,
  radius: number
): Promise<MarketData> {
  const apiKey = process.env.RENTCAST_API_KEY
  const apiUrl = process.env.RENTCAST_API_URL || 'https://api.rentcast.io/v1'
  if (!apiKey) throw new Error('RENTCAST_API_KEY not configured')

  const url = new URL(`${apiUrl.replace(/\/$/, '')}/properties/comparable`)
  url.searchParams.set('address', propertyAddress)
  url.searchParams.set('radius', String(radius))
  url.searchParams.set('propertyType', propertyType)
  url.searchParams.set('limit', '10')

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`RentCast request failed (${res.status})`)

  const body = await res.json() as {
    data?: {
      comparables?: Array<{ price?: number }>
      averageRent?: number
      medianRent?: number
      occupancyRate?: number
      rentGrowth?: number
    }
  }
  const data = body?.data
  const comparables = data?.comparables ?? []
  const prices = comparables.map((c) => Number(c.price ?? 0)).filter((p) => Number.isFinite(p) && p > 0)
  if (prices.length === 0 && !data?.averageRent && !data?.medianRent) {
    throw new Error('RentCast response missing comparables')
  }

  const avg = data?.averageRent ?? prices.reduce((a, b) => a + b, 0) / prices.length
  const sorted = [...prices].sort((a, b) => a - b)
  const med = data?.medianRent ?? (
    sorted.length === 0
      ? avg
      : sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)]
  )

  return {
    averageRent: Math.round(avg),
    medianRent: Math.round(med),
    occupancyRate: Number(data?.occupancyRate ?? 95),
    rentGrowthYoY: Number(data?.rentGrowth ?? 0),
    comparableCount: comparables.length || prices.length,
    source: 'rentcast',
  }
}

async function getMarketData(
  propertyAddress: string,
  propertyType: string,
  radius: number
): Promise<MarketData> {
  try {
    return await fetchRentcastMarketData(propertyAddress, propertyType, radius)
  } catch {
    const fallback = getMarketDataForAddress(propertyAddress, propertyType)
    return {
      averageRent: fallback.averageRent,
      medianRent: fallback.medianRent,
      occupancyRate: fallback.occupancyRate,
      rentGrowthYoY: fallback.rentGrowthYoY,
      comparableCount: fallback.comparableCount,
      source: 'reference',
    }
  }
}

async function getOpenAIRecommendation(params: {
  valuation: number
  currentPriceUsd?: number
  propertyAddress: string
  propertyType: string
  marketData: MarketData
}) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const currentMonth = new Date().toLocaleString('en-US', { month: 'long' })

  const prompt = `You are an expert real estate pricing analyst. Analyze the data and return JSON only.
PROPERTY:
- Address: ${params.propertyAddress}
- Type: ${params.propertyType}
- Valuation: $${params.valuation.toLocaleString()}
- CurrentRent: ${params.currentPriceUsd ? `$${params.currentPriceUsd}` : 'N/A'}

MARKET_DATA:
${JSON.stringify(params.marketData, null, 2)}

OUTPUT JSON SCHEMA:
{"price": number, "confidence": number, "reasoning": string}

Requirements:
- prioritize stable occupancy
- be conservative
- reasoning should be specific and concise`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'Return strict JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    }),
  })
  if (!res.ok) throw new Error(`OpenAI request failed (${res.status})`)

  const body = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
  const content = body?.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI response missing content')

  const parsed = JSON.parse(content) as { price?: number; confidence?: number; reasoning?: string }
  if (!parsed.price || !Number.isFinite(parsed.price)) throw new Error('OpenAI response missing valid price')
  return {
    price: parsed.price,
    confidence: Number.isFinite(parsed.confidence) ? Number(parsed.confidence) : 75,
    reasoning: (parsed.reasoning || 'AI recommendation generated from market data.').trim(),
  }
}

export async function POST(request?: Request) {
  try {
    // Rate limiting
    const forwarded = request?.headers?.get('x-forwarded-for')
    const ip = forwarded?.split(',')[0]?.trim() ?? 'unknown'
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    let priceManagerAddr =
      (process.env.NEXT_PUBLIC_PRICE_MANAGER_ADDRESS ||
        process.env.PRICE_MANAGER_ADDRESS ||
        '0xA775Fd6f8240f8F79fbdE07E7246cc077445d5cB') as Address
    let valuation = parseInt(process.env.PROPERTY_VALUATION || '500000', 10)
    let propertyAddress = process.env.PROPERTY_ADDRESS || '123 Main St, San Francisco, CA'
    let propertyType = process.env.PROPERTY_TYPE || 'Single Family'
    let radius = parseInt(process.env.MARKET_DATA_RADIUS_MILES || '5', 10)

    if (request) {
      try {
        const body = await request.json().catch(() => ({}))
        if (body?.priceManagerAddress && /^0x[a-fA-F0-9]{40}$/.test(body.priceManagerAddress)) {
          priceManagerAddr = body.priceManagerAddress as Address
        }
        if (typeof body?.propertyValuation === 'number') {
          valuation = body.propertyValuation
        } else if (typeof body?.propertyValuation === 'string') {
          valuation = parseInt(body.propertyValuation, 10)
        }
        if (typeof body?.propertyAddress === 'string' && body.propertyAddress.trim()) {
          propertyAddress = body.propertyAddress.trim()
        }
        if (typeof body?.propertyType === 'string' && body.propertyType.trim()) {
          propertyType = body.propertyType.trim()
        }
        if (typeof body?.radius === 'number' && Number.isFinite(body.radius)) {
          radius = Math.max(1, Math.min(50, Math.round(body.radius)))
        }
      } catch {
        /* ignore body */
      }
    }

    // Input validation
    if (!Number.isFinite(valuation) || valuation < VALUATION_MIN || valuation > VALUATION_MAX) {
      return NextResponse.json(
        { error: `Valuation must be between ${VALUATION_MIN} and ${VALUATION_MAX}` },
        { status: 400 }
      )
    }

    const rpcUrl =
      process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
      process.env.SEPOLIA_RPC_URL ||
      'https://rpc.sepolia.org'

    const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) })

    let currentPriceUsd: number | undefined
    try {
      const raw = await publicClient.readContract({
        address: priceManagerAddr,
        abi: PRICE_MANAGER_ABI,
        functionName: 'getCurrentRentalPrice',
      })
      currentPriceUsd = Number(formatUnits(raw, 6))
    } catch {
      // ignore
    }

    const marketData = await getMarketData(propertyAddress, propertyType, radius)

    let recommendation: { price: number; confidence: number; reasoning: string; source: 'openai' | 'fallback' }
    try {
      const ai = await getOpenAIRecommendation({
        valuation,
        currentPriceUsd,
        propertyAddress,
        propertyType,
        marketData,
      })
      const boundedPrice = clampToOnchainBounds(ai.price, currentPriceUsd)
      recommendation = {
        price: boundedPrice,
        confidence: Math.max(0, Math.min(100, Math.round(ai.confidence))),
        reasoning: ai.reasoning.slice(0, 512),
        source: 'openai',
      }
    } catch {
      const fallback = getRecommendation(valuation, currentPriceUsd)
      recommendation = {
        ...fallback,
        price: clampToOnchainBounds(fallback.price, currentPriceUsd),
        reasoning: fallback.reasoning.slice(0, 512),
      }
    }

    return NextResponse.json({ recommendation })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Generate recommendation error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
