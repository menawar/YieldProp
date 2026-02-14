/**
 * API route to compute a price recommendation.
 * Returns recommendation data only; submission is done client-side via user's wallet.
 * Uses rule-based logic (valuation-based). No private key required.
 */

import { NextResponse } from 'next/server'
import { createPublicClient, http, formatUnits, type Address } from 'viem'
import { sepolia } from 'viem/chains'

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

/**
 * Rule-based price recommendation.
 */
function getRecommendation(
  valuation: number,
  currentPriceUsd?: number
): { price: number; confidence: number; reasoning: string } {
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
      'Connect RentCast + OpenAI API keys for AI-powered analysis.',
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

    const recommendation = getRecommendation(valuation, currentPriceUsd)
    return NextResponse.json({ recommendation })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Generate recommendation error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
