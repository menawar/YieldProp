/**
 * Property registry and contract address resolution.
 * Supports single-property (env vars) and multi-property (NEXT_PUBLIC_PROPERTIES_JSON).
 * Backward compatible with existing deployments.
 */

export interface PropertyContracts {
  PropertyToken: `0x${string}`
  PriceManager: `0x${string}`
  YieldDistributor: `0x${string}`
  PropertySale: `0x${string}`
  MockUSDC: `0x${string}`
}

export interface Property {
  id: string
  name: string
  address?: string
  propertyType?: string
  valuation?: string
  contracts: PropertyContracts
}

// Fallback from multi-property deployment (prop-1: 123 Main St)
const FALLBACK_CONTRACTS: PropertyContracts = {
  PropertyToken: (process.env.NEXT_PUBLIC_PROPERTY_TOKEN_ADDRESS || '0x071eB7911Cf4D28a4E558eF0EF6EaAF2C77c596F') as `0x${string}`,
  PriceManager: (process.env.NEXT_PUBLIC_PRICE_MANAGER_ADDRESS || '0xA775Fd6f8240f8F79fbdE07E7246cc077445d5cB') as `0x${string}`,
  YieldDistributor: (process.env.NEXT_PUBLIC_YIELD_DISTRIBUTOR_ADDRESS || '0xdFE830ce59c3e66c9E6DC8D8F30a23b02998Da00') as `0x${string}`,
  PropertySale: (process.env.NEXT_PUBLIC_PROPERTY_SALE_ADDRESS || '0x5570c6df7efb4F1B0A5637a344d8f6A6215BF099') as `0x${string}`,
  MockUSDC: (process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS || '0x5545b442C06cC8E4FD329D2C6DebAe4C0410A1e9') as `0x${string}`,
}

/**
 * Parse properties from environment.
 * Multi-property: NEXT_PUBLIC_PROPERTIES_JSON (JSON array)
 * Single-property: legacy env vars (NEXT_PUBLIC_PROPERTY_TOKEN_ADDRESS, etc.)
 */
export function parsePropertiesFromEnv(): Property[] {
  const json = process.env.NEXT_PUBLIC_PROPERTIES_JSON
  if (json) {
    try {
      const arr = JSON.parse(json) as Property[]
      if (Array.isArray(arr) && arr.length > 0) return arr
    } catch {
      /* ignore */
    }
  }
  return [makeSingleProperty(process.env as Record<string, string | undefined>)]
}

function makeSingleProperty(env: Record<string, string | undefined>): Property {
  const token = env.NEXT_PUBLIC_PROPERTY_TOKEN_ADDRESS || FALLBACK_CONTRACTS.PropertyToken
  const priceManager = env.NEXT_PUBLIC_PRICE_MANAGER_ADDRESS || FALLBACK_CONTRACTS.PriceManager
  const yieldDist = env.NEXT_PUBLIC_YIELD_DISTRIBUTOR_ADDRESS || FALLBACK_CONTRACTS.YieldDistributor
  const sale = env.NEXT_PUBLIC_PROPERTY_SALE_ADDRESS || FALLBACK_CONTRACTS.PropertySale
  const usdc = env.NEXT_PUBLIC_MOCK_USDC_ADDRESS || FALLBACK_CONTRACTS.MockUSDC
  return {
    id: 'default',
    name: 'Property',
    contracts: {
      PropertyToken: token as `0x${string}`,
      PriceManager: priceManager as `0x${string}`,
      YieldDistributor: yieldDist as `0x${string}`,
      PropertySale: sale as `0x${string}`,
      MockUSDC: usdc as `0x${string}`,
    },
  }
}

/**
 * Get contracts for a property by id. Returns fallback if not found.
 */
export function getContractsForProperty(properties: Property[], propertyId: string): PropertyContracts {
  const p = properties.find((x) => x.id === propertyId)
  return p?.contracts ?? FALLBACK_CONTRACTS
}
