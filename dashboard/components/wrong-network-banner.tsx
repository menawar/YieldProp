'use client'

import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

const SEPOLIA_CHAIN_ID = sepolia.id

export function WrongNetworkBanner() {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain, isPending } = useSwitchChain()

  if (!isConnected || chainId === SEPOLIA_CHAIN_ID) return null

  return (
    <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
          <span>
            Wrong network. Connect to <strong>Sepolia</strong> to use this app.
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="border-amber-600 text-amber-700 hover:bg-amber-500/20 dark:border-amber-500 dark:text-amber-400"
          onClick={() => switchChain({ chainId: SEPOLIA_CHAIN_ID })}
          disabled={isPending}
        >
          {isPending ? 'Switching…' : 'Switch to Sepolia'}
        </Button>
      </div>
    </div>
  )
}
