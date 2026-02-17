'use client'

import Link from 'next/link'
import { useReadContract } from 'wagmi'
import { usePropertyContracts } from '@/lib/property-context'
import { ABIS, formatUsdc } from '@/lib/contracts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Sparkles, ArrowRight } from 'lucide-react'

/**
 * Task 14.1: Compact latest recommendation preview for Overview
 * Requirements: 9.1, 9.2
 */
type Recommendation = {
  id: bigint
  recommendedPrice: bigint
  confidenceScore: bigint
  accepted: boolean
  rejected: boolean
}

export function LatestRecommendationPreview() {
  const contracts = usePropertyContracts()
  const { data: recommendationRaw, isLoading, isError } = useReadContract({
    address: contracts.PriceManager,
    abi: ABIS.PriceManager,
    functionName: 'getLatestRecommendation',
  })
  const recommendation = recommendationRaw as unknown as Recommendation | undefined

  const hasRecommendation = recommendation && recommendation.id > 0n
  const isPending = hasRecommendation && !recommendation.accepted && !recommendation.rejected

  if (isError) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          Failed to load recommendation.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <Sparkles className="h-4 w-4" />
          Latest AI Recommendation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : !hasRecommendation ? (
          <p className="text-sm text-muted-foreground">No recommendations yet</p>
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <p className="text-xl font-bold">{formatUsdc(recommendation.recommendedPrice)}</p>
              {isPending && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                  Pending
                </span>
              )}
              {recommendation.accepted && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-200">
                  Accepted
                </span>
              )}
              {recommendation.rejected && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-200">
                  Rejected
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Confidence: {Number(recommendation.confidenceScore)}%
            </p>
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link href="/recommendations">
                View details
                <ArrowRight className="ml-2 h-3.5 w-3.5" />
              </Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
