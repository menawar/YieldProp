'use client'

import { useReadContract } from 'wagmi'
import { usePropertyContracts } from '@/lib/property-context'
import { ABIS, formatUsdc } from '@/lib/contracts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp } from 'lucide-react'

/**
 * Task 14.1: Total yields distributed across all distributions
 * Requirements: 9.1
 */
export function TotalYieldsCard() {
  const contracts = usePropertyContracts()
  const { data: totalYields, isLoading, isError } = useReadContract({
    address: contracts.YieldDistributor,
    abi: ABIS.YieldDistributor,
    functionName: 'getTotalYieldsDistributed',
  })

  if (isError) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          Failed to load yields.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <TrendingUp className="h-4 w-4" />
          Total Yields Distributed
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-10 w-28" />
        ) : (
          <p className="text-2xl font-bold tracking-tight">{formatUsdc(totalYields)}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">All-time to token holders</p>
      </CardContent>
    </Card>
  )
}
