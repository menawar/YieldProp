'use client'

import { useReadContract } from 'wagmi'
import { usePropertyContracts } from '@/lib/property-context'
import { ABIS } from '@/lib/contracts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Coins } from 'lucide-react'

const TOKEN_DECIMALS = 18

/**
 * Task 14.1: Token supply - fixed 100 tokens = 100% ownership
 * Requirements: 9.1
 */
export function TokenSupplyCard() {
  const contracts = usePropertyContracts()
  const { data: totalSupply, isLoading, isError } = useReadContract({
    address: contracts.PropertyToken,
    abi: ABIS.PropertyToken,
    functionName: 'totalSupply',
  }) as { data: bigint | undefined, isLoading: boolean, isError: boolean }

  const tokenCount =
    totalSupply !== undefined ? Number(totalSupply) / 10 ** TOKEN_DECIMALS : null

  if (isError) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          Failed to load token supply.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <Coins className="h-4 w-4" />
          Token Supply
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-10 w-20" />
        ) : (
          <p className="text-2xl font-bold tracking-tight">{tokenCount ?? '—'}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">100 tokens = 100% ownership</p>
      </CardContent>
    </Card>
  )
}
