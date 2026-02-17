/**
 * Contract ABIs and types for YieldProp MVP dashboard
 * Aligned with design.md and deployed Sepolia contracts
 */

import { CONTRACTS } from './wagmi'
import PROPERTY_TOKEN_URI from './abis/PropertyToken.json'
import PRICE_MANAGER_URI from './abis/PriceManager.json'
import YIELD_DISTRIBUTOR_URI from './abis/YieldDistributor.json'
import PROPERTY_SALE_URI from './abis/PropertySale.json'

// PropertyToken (ERC-1400)
// PropertyToken (ERC-1400)
const PROPERTY_TOKEN_ABI = PROPERTY_TOKEN_URI

// PriceManager
const PRICE_MANAGER_ABI = PRICE_MANAGER_URI

// YieldDistributor
const YIELD_DISTRIBUTOR_ABI = YIELD_DISTRIBUTOR_URI

// PropertySale
const PROPERTY_SALE_ABI = PROPERTY_SALE_URI

// ERC20 (MockUSDC) - approve, allowance, balanceOf
const ERC20_ABI = [
  {
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

export const ABIS = {
  PropertyToken: PROPERTY_TOKEN_ABI,
  PriceManager: PRICE_MANAGER_ABI,
  YieldDistributor: YIELD_DISTRIBUTOR_ABI,
  PropertySale: PROPERTY_SALE_ABI,
  ERC20: ERC20_ABI,
} as const

export { CONTRACTS }

// Format helpers - valuation in 1e18, rental/amounts in 1e6 (USDC)
const USDC_DECIMALS = 6
const VALUATION_DECIMALS = 18

export function formatUsdc(value: bigint | undefined): string {
  if (value === undefined || value === 0n) return '$0.00'
  const num = Number(value) / 10 ** USDC_DECIMALS
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

export function formatValuation(value: bigint | undefined): string {
  if (value === undefined || value === 0n) return '$0'
  const num = Number(value) / 10 ** VALUATION_DECIMALS
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

export function formatTokens(raw: bigint | undefined, decimals = 18): string {
  if (raw === undefined || raw === 0n) return '0'
  const num = Number(raw) / 10 ** decimals
  return num.toFixed(2)
}

// Ownership % from contract: basis points (10000 = 100%)
export function formatOwnershipPercentage(basisPoints: bigint | undefined): string {
  if (basisPoints === undefined || basisPoints === 0n) return '0.00'
  return (Number(basisPoints) / 100).toFixed(2)
}

// Annualized yield: basis points (100 = 1%)
export function formatAnnualizedYield(basisPoints: bigint | undefined): string {
  if (basisPoints === undefined || basisPoints === 0n) return '0.00'
  return (Number(basisPoints) / 100).toFixed(2)
}
