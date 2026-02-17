'use client'

import { useReadContract } from 'wagmi'
import { usePropertyContracts } from '@/lib/property-context'
import { ABIS, formatUsdc } from '@/lib/contracts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DollarSign } from 'lucide-react'

/**
 * Task 14.1: Rental price from PriceManager
 * Requirements: 9.1
 */
export function RentalPriceCard() {
  const contracts = usePropertyContracts()
  const { data: price, isLoading, isError } = useReadContract({
    address: contracts.PriceManager,
    abi: ABIS.PriceManager,
    functionName: 'getCurrentRentalPrice',
  }) as { data: bigint | undefined, isLoading: boolean, isError: boolean }

  if (isError) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          Failed to load rental price.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <DollarSign className="h-4 w-4" />
          Current Monthly Rent
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-10 w-32" />
        ) : (
          <p className="text-2xl font-bold tracking-tight">{formatUsdc(price)}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">AI-optimized rate</p>
      </CardContent>
    </Card>
  )
}
