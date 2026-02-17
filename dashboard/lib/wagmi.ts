import { http, createConfig } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

// Contract addresses - fallback from multi-property deployment (prop-1)
// See deployments/sepolia-multi-*.json; use sync:addresses to update .env.local
export const CONTRACTS = {
  PropertyToken: (process.env.NEXT_PUBLIC_PROPERTY_TOKEN_ADDRESS || '0x48b6bc9A045CC73B9511f01eB03e0c4ada10934A') as `0x${string}`,
  PriceManager: (process.env.NEXT_PUBLIC_PRICE_MANAGER_ADDRESS || '0xd06d573BbC46B1B47bcF8CC7729663a071F8B590') as `0x${string}`,
  YieldDistributor: (process.env.NEXT_PUBLIC_YIELD_DISTRIBUTOR_ADDRESS || '0x84a6F5a99CC64C4061228214C99B38AC80e12b46') as `0x${string}`,
  PropertySale: (process.env.NEXT_PUBLIC_PROPERTY_SALE_ADDRESS || '0xa908376dAE4611af71367f443648c1fd79523b03') as `0x${string}`,
  MockUSDC: (process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS || '0x6cBFD98EFa90681EA824E57E594822e1B893d42e') as `0x${string}`,
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
