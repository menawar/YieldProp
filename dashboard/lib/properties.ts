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
  PropertyToken: (process.env.NEXT_PUBLIC_PROPERTY_TOKEN_ADDRESS || '0x48b6bc9A045CC73B9511f01eB03e0c4ada10934A') as `0x${string}`,
  PriceManager: (process.env.NEXT_PUBLIC_PRICE_MANAGER_ADDRESS || '0xd06d573BbC46B1B47bcF8CC7729663a071F8B590') as `0x${string}`,
  YieldDistributor: (process.env.NEXT_PUBLIC_YIELD_DISTRIBUTOR_ADDRESS || '0x84a6F5a99CC64C4061228214C99B38AC80e12b46') as `0x${string}`,
  PropertySale: (process.env.NEXT_PUBLIC_PROPERTY_SALE_ADDRESS || '0xa908376dAE4611af71367f443648c1fd79523b03') as `0x${string}`,
  MockUSDC: (process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS || '0x6cBFD98EFa90681EA824E57E594822e1B893d42e') as `0x${string}`,
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
