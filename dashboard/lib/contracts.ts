/**
 * Contract ABIs and types for YieldProp MVP dashboard
 * Aligned with design.md and deployed Sepolia contracts
 */

import { CONTRACTS } from './wagmi'

// PropertyToken (ERC-1400) - decimals 18, 100 tokens = 100%
const PROPERTY_TOKEN_ABI = [
  {
    inputs: [],
    name: 'getPropertyDetails',
    outputs: [
      { name: 'propertyAddress', type: 'string' },
      { name: 'propertyType', type: 'string' },
      { name: 'valuation', type: 'uint256' },
      { name: 'totalTokens', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'holder', type: 'address' }],
    name: 'getOwnershipPercentage',
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
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [{ name: 'role', type: 'bytes32' }, { name: 'account', type: 'address' }],
    name: 'hasRole',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'PROPERTY_MANAGER_ROLE',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'isWhitelisted',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'addToWhitelist',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'removeFromWhitelist',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'accounts', type: 'address[]' }],
    name: 'batchAddToWhitelist',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'status', type: 'bool', indexed: false },
    ],
    name: 'WhitelistUpdated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
    name: 'Transfer',
    type: 'event',
  },
] as const

// PriceManager - USDC decimals (6) for rental price
const PRICE_MANAGER_ABI = [
  {
    inputs: [],
    name: 'getCurrentRentalPrice',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getLatestRecommendation',
    outputs: [
      {
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'recommendedPrice', type: 'uint256' },
          { name: 'confidenceScore', type: 'uint256' },
          { name: 'reasoning', type: 'string' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'accepted', type: 'bool' },
          { name: 'rejected', type: 'bool' },
          { name: 'submitter', type: 'address' },
        ],
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getRecommendationIds',
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getRecommendationHistory',
    outputs: [
      {
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'recommendedPrice', type: 'uint256' },
          { name: 'confidenceScore', type: 'uint256' },
          { name: 'reasoning', type: 'string' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'accepted', type: 'bool' },
          { name: 'rejected', type: 'bool' },
          { name: 'submitter', type: 'address' },
        ],
        name: '',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'limit', type: 'uint256' }],
    name: 'getRecentRecommendations',
    outputs: [
      {
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'recommendedPrice', type: 'uint256' },
          { name: 'confidenceScore', type: 'uint256' },
          { name: 'reasoning', type: 'string' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'accepted', type: 'bool' },
          { name: 'rejected', type: 'bool' },
          { name: 'submitter', type: 'address' },
        ],
        name: '',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'id', type: 'uint256' }],
    name: 'getRecommendation',
    outputs: [
      {
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'recommendedPrice', type: 'uint256' },
          { name: 'confidenceScore', type: 'uint256' },
          { name: 'reasoning', type: 'string' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'accepted', type: 'bool' },
          { name: 'rejected', type: 'bool' },
          { name: 'submitter', type: 'address' },
        ],
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'price', type: 'uint256' },
      { name: 'confidence', type: 'uint256' },
      { name: 'reasoning', type: 'string' },
    ],
    name: 'submitRecommendation',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'recommendationId', type: 'uint256' }],
    name: 'acceptRecommendation',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'recommendationId', type: 'uint256' }],
    name: 'rejectRecommendation',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'role', type: 'bytes32' }, { name: 'account', type: 'address' }],
    name: 'hasRole',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'PROPERTY_MANAGER_ROLE',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { name: 'id', type: 'uint256', indexed: true },
      { name: 'price', type: 'uint256', indexed: false },
      { name: 'confidence', type: 'uint256', indexed: false },
      { name: 'reasoning', type: 'string', indexed: false },
      { name: 'submitter', type: 'address', indexed: true },
    ],
    name: 'RecommendationSubmitted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { name: 'id', type: 'uint256', indexed: true },
      { name: 'newPrice', type: 'uint256', indexed: false },
      { name: 'acceptedBy', type: 'address', indexed: true },
    ],
    name: 'RecommendationAccepted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { name: 'id', type: 'uint256', indexed: true },
      { name: 'rejectedBy', type: 'address', indexed: true },
    ],
    name: 'RecommendationRejected',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { name: 'oldPrice', type: 'uint256', indexed: false },
      { name: 'newPrice', type: 'uint256', indexed: false },
    ],
    name: 'RentalPriceUpdated',
    type: 'event',
  },
] as const

// YieldDistributor - USDC (6 decimals) for amounts
const YIELD_DISTRIBUTOR_ABI = [
  {
    inputs: [],
    name: 'getDistributionPool',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getDistributionHistory',
    outputs: [
      {
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'totalAmount', type: 'uint256' },
          { name: 'amountPerToken', type: 'uint256' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'recipientCount', type: 'uint256' },
        ],
        name: '',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getTotalYieldsDistributed',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'holder', type: 'address' }],
    name: 'getHolderYields',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getAnnualizedYield',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'distributeYields',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'receiveRentalPayment',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'holder', type: 'address' }],
    name: 'registerHolder',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'holders', type: 'address[]' }],
    name: 'registerHolders',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'registerHolderForSelf',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'PAYMENT_PROCESSOR_ROLE',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'holder', type: 'address' }],
    name: 'isRegisteredHolder',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getRegisteredHolders',
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'role', type: 'bytes32' }, { name: 'account', type: 'address' }],
    name: 'hasRole',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'PROPERTY_MANAGER_ROLE',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
      { name: 'payer', type: 'address', indexed: true },
    ],
    name: 'RentalPaymentReceived',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { name: 'distributionId', type: 'uint256', indexed: true },
      { name: 'totalAmount', type: 'uint256', indexed: false },
      { name: 'recipientCount', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
    name: 'YieldsDistributed',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { name: 'holder', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'distributionId', type: 'uint256', indexed: true },
    ],
    name: 'YieldTransferred',
    type: 'event',
  },
] as const

// PropertySale - invest(tokenAmount) to purchase property tokens with USDC
const PROPERTY_SALE_ABI = [
  { inputs: [], name: 'saleActive', outputs: [{ name: '', type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'tokensOfferedForSale', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'pricePerToken', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'tokenAmount', type: 'uint256' }], name: 'getCostForTokens', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'tokenAmount', type: 'uint256' }], name: 'invest', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'amount', type: 'uint256' }], name: 'setTokensOfferedForSale', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'stablecoin', outputs: [{ name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'tokenHolder', outputs: [{ name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  {
    anonymous: false,
    inputs: [
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'tokenAmount', type: 'uint256', indexed: false },
      { name: 'cost', type: 'uint256', indexed: false },
    ],
    name: 'TokensPurchased',
    type: 'event',
  },
] as const

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
