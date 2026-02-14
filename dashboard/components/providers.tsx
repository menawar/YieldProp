'use client'

import { Suspense, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { config } from '@/lib/wagmi'
import { Toaster } from '@/components/ui/sonner'
import { ContractEventWatcher } from '@/components/contract-event-watcher'
import { WrongNetworkBanner } from '@/components/wrong-network-banner'
import { PropertyProvider } from '@/lib/property-context'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000, // 30 seconds - balance after MetaMask actions
            refetchOnWindowFocus: true, // Refetch when returning from MetaMask popup
          },
        },
      })
  )

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={null}>
          <PropertyProvider>
            <WrongNetworkBanner />
            <ContractEventWatcher />
            {children}
          </PropertyProvider>
        </Suspense>
        <Toaster />
      </QueryClientProvider>
    </WagmiProvider>
  )
}
