'use client'

import { useReadContract } from 'wagmi'
import { usePropertyContracts } from '@/lib/property-context'
import { ABIS, formatUsdc, formatAnnualizedYield } from '@/lib/contracts'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Percent, DollarSign, PiggyBank } from 'lucide-react'

/**
 * Task 16.1: Yield metrics - annualized yield, total distributed, pool balance
 * Requirements: 9.3
 */
export function YieldMetrics() {
  const contracts = usePropertyContracts()
  const { data: totalYields, isLoading: l1 } = useReadContract({
    address: contracts.YieldDistributor,
    abi: ABIS.YieldDistributor,
    functionName: 'getTotalYieldsDistributed',
  }) as { data: bigint | undefined, isLoading: boolean }

  const { data: annualizedYield, isLoading: l2 } = useReadContract({
    address: contracts.YieldDistributor,
    abi: ABIS.YieldDistributor,
    functionName: 'getAnnualizedYield',
  }) as { data: bigint | undefined, isLoading: boolean }

  const { data: poolBalance, isLoading: l3 } = useReadContract({
    address: contracts.YieldDistributor,
    abi: ABIS.YieldDistributor,
    functionName: 'getDistributionPool',
  }) as { data: bigint | undefined, isLoading: boolean }

  const isLoading = l1 || l2 || l3

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Percent className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Annualized Yield
              </p>
              {isLoading ? (
                <Skeleton className="mt-1 h-8 w-20" />
              ) : (
                <p className="text-2xl font-bold">{formatAnnualizedYield(annualizedYield)}%</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Total Distributed
              </p>
              {isLoading ? (
                <Skeleton className="mt-1 h-8 w-24" />
              ) : (
                <p className="text-2xl font-bold">{formatUsdc(totalYields)}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <PiggyBank className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Pending Pool
              </p>
              {isLoading ? (
                <Skeleton className="mt-1 h-8 w-24" />
              ) : (
                <p className="text-2xl font-bold">{formatUsdc(poolBalance)}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
