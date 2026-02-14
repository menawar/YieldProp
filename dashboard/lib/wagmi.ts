import { http, createConfig } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

// Contract addresses - fallback from multi-property deployment (prop-1)
// See deployments/sepolia-multi-*.json; use sync:addresses to update .env.local
export const CONTRACTS = {
  PropertyToken: (process.env.NEXT_PUBLIC_PROPERTY_TOKEN_ADDRESS || '0x071eB7911Cf4D28a4E558eF0EF6EaAF2C77c596F') as `0x${string}`,
  PriceManager: (process.env.NEXT_PUBLIC_PRICE_MANAGER_ADDRESS || '0xA775Fd6f8240f8F79fbdE07E7246cc077445d5cB') as `0x${string}`,
  YieldDistributor: (process.env.NEXT_PUBLIC_YIELD_DISTRIBUTOR_ADDRESS || '0xdFE830ce59c3e66c9E6DC8D8F30a23b02998Da00') as `0x${string}`,
  PropertySale: (process.env.NEXT_PUBLIC_PROPERTY_SALE_ADDRESS || '0x5570c6df7efb4F1B0A5637a344d8f6A6215BF099') as `0x${string}`,
  MockUSDC: (process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS || '0x5545b442C06cC8E4FD329D2C6DebAe4C0410A1e9') as `0x${string}`,
} as const

// Wagmi configuration for Sepolia testnet
export const config = createConfig({
  chains: [sepolia],
  connectors: [
    injected(),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
    }),
  ],
  transports: {
    [sepolia.id]: http(
      process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 
      'https://rpc.sepolia.org'
    ),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
