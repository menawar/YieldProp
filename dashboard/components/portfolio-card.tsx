'use client'

import { useAccount, useReadContract } from 'wagmi'
import { usePropertyContracts } from '@/lib/property-context'
import { ABIS, formatUsdc, formatTokens, formatOwnershipPercentage } from '@/lib/contracts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Wallet, Coins, Percent, DollarSign } from 'lucide-react'
import { ConnectButton } from './connect-button'

const TOKEN_DECIMALS = 18

/**
 * Task 17.1: PortfolioCard - connected wallet token balance, ownership %, yields
 * Requirements: 9.4
 */
export function PortfolioCard() {
  const { address, isConnected } = useAccount()
  const contracts = usePropertyContracts()

  const { data: balanceRaw, isLoading: l1 } = useReadContract({
    address: contracts.PropertyToken,
    abi: ABIS.PropertyToken,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  })
  const balance = balanceRaw as unknown as bigint | undefined

  const { data: ownershipPctRaw, isLoading: l2 } = useReadContract({
    address: contracts.PropertyToken,
    abi: ABIS.PropertyToken,
    functionName: 'getOwnershipPercentage',
    args: address ? [address] : undefined,
  })
  const ownershipPct = ownershipPctRaw as unknown as bigint | undefined

  const { data: holderYieldsRaw, isLoading: l3 } = useReadContract({
    address: contracts.YieldDistributor,
    abi: ABIS.YieldDistributor,
    functionName: 'getHolderYields',
    args: address ? [address] : undefined,
  })
  const holderYields = holderYieldsRaw as unknown as bigint | undefined

  const isLoading = l1 || l2 || l3

  if (!isConnected || !address) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="mb-4 rounded-full bg-muted p-4">
            <Wallet className="h-12 w-12 text-muted-foreground" />
          </div>
          <h3 className="font-serif text-xl font-semibold">Connect Your Wallet</h3>
          <p className="mt-2 max-w-sm text-center text-muted-foreground">
            Connect your wallet to view your property token holdings and yield earnings
          </p>
          <div className="mt-6">
            <ConnectButton />
          </div>
        </CardContent>
      </Card>
    )
  }

  const tokenCount = balance !== undefined ? Number(balance) / 10 ** TOKEN_DECIMALS : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif">
          <Wallet className="h-5 w-5" />
          My Portfolio
        </CardTitle>
        <CardDescription>
          {address.slice(0, 6)}...{address.slice(-4)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Token Balance
              </span>
            </div>
            {isLoading ? (
              <Skeleton className="mt-2 h-8 w-24" />
            ) : (
              <p className="mt-2 text-2xl font-bold">{formatTokens(balance)}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">PROP tokens</p>
          </div>

          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Ownership
              </span>
            </div>
            {isLoading ? (
              <Skeleton className="mt-2 h-8 w-20" />
            ) : (
              <p className="mt-2 text-2xl font-bold">{formatOwnershipPercentage(ownershipPct)}%</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">Of property</p>
          </div>

          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Total Yields Earned
              </span>
            </div>
            {isLoading ? (
              <Skeleton className="mt-2 h-8 w-24" />
            ) : (
              <p className="mt-2 text-2xl font-bold">{formatUsdc(holderYields)}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">All-time</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
