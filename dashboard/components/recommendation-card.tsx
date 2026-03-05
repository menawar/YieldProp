'use client'

import { useState } from 'react'
import { parseUnits } from 'viem'
import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { usePropertyContracts } from '@/lib/property-context'
import { ABIS, formatUsdc } from '@/lib/contracts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TransactionButton } from '@/components/ui/transaction-button'
import { Sparkles, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { getBlockExplorerTxUrl, getErrorMessage } from '@/lib/utils'
import { useInvalidateOnTxConfirm } from '@/lib/use-invalidate-on-tx-confirm'
import { usePropertyData } from '@/lib/use-property-data'

type Recommendation = {
  id: bigint
  recommendedPrice: bigint
  confidenceScore: bigint
  accepted: boolean
  rejected: boolean
  reasoning: string
}

export function RecommendationCard() {
  const [isGenerating, setIsGenerating] = useState(false)
  const contracts = usePropertyContracts()
  const { isManager, propertyDetails } = usePropertyData()

  const { data: recommendationRaw, isLoading, isError, refetch: refetchRecommendation } = useReadContract({
    address: contracts.PriceManager,
    abi: ABIS.PriceManager,
    functionName: 'getLatestRecommendation',
  })
  const recommendation = recommendationRaw as unknown as Recommendation | undefined

  const { writeContract: submitRecommendation, data: submitHash, isPending: isSubmitting } = useWriteContract()
  const { isSuccess: isSubmitSuccess } = useWaitForTransactionReceipt({ hash: submitHash })
  useInvalidateOnTxConfirm(submitHash, isSubmitSuccess)

  const handleGenerateRecommendation = async () => {
    if (!isManager) {
      toast.error('Connect as property manager to submit recommendations')
      return
    }
    setIsGenerating(true)
    try {
      const valuationUsd = propertyDetails
        ? Number(propertyDetails[2]) / 1e18
        : 500_000
      const res = await fetch('/api/generate-recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceManagerAddress: contracts.PriceManager,
          propertyValuation: Math.round(valuationUsd),
          propertyAddress: propertyDetails?.[0] || undefined,
          propertyType: propertyDetails?.[1] || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || res.statusText)
      const rec = json.recommendation as { price: number; confidence: number; reasoning: string }
      if (!rec?.price) throw new Error('Invalid recommendation response')
      const priceUsdc6 = parseUnits(String(rec.price), 6)
      submitRecommendation(
        {
          address: contracts.PriceManager,
          abi: ABIS.PriceManager,
          functionName: 'submitRecommendation',
          args: [priceUsdc6, BigInt(rec.confidence), rec.reasoning.slice(0, 512)],
        },
        {
          onSuccess: (hash) => {
            toast.success(`Recommendation submitted: $${rec.price}/month`, {
              description: hash ? (
                <a href={getBlockExplorerTxUrl(hash)} target="_blank" rel="noopener noreferrer" className="underline text-sm">
                  View on Etherscan ↗
                </a>
              ) : undefined,
            })
          },
        }
      )
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setIsGenerating(false)
    }
  }

  const {
    writeContract: acceptRecommendation,
    data: acceptHash,
    isPending: isAccepting,
    error: acceptError,
  } = useWriteContract()

  const {
    writeContract: rejectRecommendation,
    data: rejectHash,
    isPending: isRejecting,
    error: rejectError,
  } = useWriteContract()

  const handleAccept = () => {
    if (!recommendation?.id || recommendation.accepted || recommendation.rejected) return
    acceptRecommendation(
      {
        address: contracts.PriceManager,
        abi: ABIS.PriceManager,
        functionName: 'acceptRecommendation',
        args: [recommendation.id],
      },
      {
        onSuccess: (hash) => {
          toast.success('Recommendation accepted', {
            description: hash ? (
              <a href={getBlockExplorerTxUrl(hash)} target="_blank" rel="noopener noreferrer" className="underline text-sm">
                View on Etherscan ↗
              </a>
            ) : undefined,
          })
        },
      }
    )
  }

  const handleReject = () => {
    if (!recommendation?.id || recommendation.accepted || recommendation.rejected) return
    if (
      !window.confirm(
        'Reject this recommendation? The rental price will remain unchanged and you can generate a new one.'
      )
    ) {
      return
    }
    rejectRecommendation(
      {
        address: contracts.PriceManager,
        abi: ABIS.PriceManager,
        functionName: 'rejectRecommendation',
        args: [recommendation.id],
      },
      {
        onSuccess: (hash) => {
          toast.success('Recommendation rejected', {
            description: hash ? (
              <a href={getBlockExplorerTxUrl(hash)} target="_blank" rel="noopener noreferrer" className="underline text-sm">
                View on Etherscan ↗
              </a>
            ) : undefined,
          })
        },
      }
    )
  }

  const hasRecommendation = recommendation && recommendation.id > 0n
  const isPending = hasRecommendation && !recommendation.accepted && !recommendation.rejected
  const canAct = isManager && isPending
  const isBusy = isGenerating || isSubmitting

  if (isError) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Failed to load recommendation.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif">
          <Sparkles className="h-5 w-5 text-primary" />
          Latest Price Recommendation
        </CardTitle>
        <CardDescription>AI-analyzed optimal rental price</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !hasRecommendation ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <p className="text-center text-muted-foreground">
              {isManager
                ? 'No recommendations yet. Generate one with AI analysis.'
                : 'Connect as property manager to generate recommendations.'}
            </p>
            <TransactionButton
              onClick={handleGenerateRecommendation}
              disabled={isBusy || !isManager}
              isPending={isBusy}
              txHash={submitHash}
              loadingText={isGenerating ? 'Generating…' : 'Confirm in wallet…'}
              defaultText={<><Sparkles className="mr-2 h-4 w-4" />Generate AI Recommendation</>}
            />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Recommended Price
                </p>
                <p className="text-3xl font-bold">{formatUsdc(recommendation.recommendedPrice)}</p>
                <p className="text-sm text-muted-foreground">/ month</p>
              </div>
              <div className="rounded-xl bg-primary/10 px-4 py-2">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Confidence
                </p>
                <p className="text-xl font-bold">{Number(recommendation.confidenceScore)}%</p>
              </div>
              <div>
                {recommendation.accepted && (
                  <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800 dark:bg-green-900/40 dark:text-green-200">
                    Accepted
                  </span>
                )}
                {recommendation.rejected && (
                  <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800 dark:bg-red-900/40 dark:text-red-200">
                    Rejected
                  </span>
                )}
                {isPending && (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                    Pending Review
                  </span>
                )}
              </div>
            </div>

            {recommendation.reasoning && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  AI Reasoning
                </p>
                <p className="mt-2 rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed">
                  {recommendation.reasoning}
                </p>
              </div>
            )}

            {canAct && (
              <div className="flex gap-3">
                <TransactionButton
                  onClick={handleAccept}
                  isPending={isAccepting}
                  txHash={acceptHash}
                  className="flex-1"
                  loadingText="Accepting..."
                  defaultText={<><Check className="mr-2 h-4 w-4" />Accept</>}
                />
                <TransactionButton
                  variant="destructive"
                  onClick={handleReject}
                  isPending={isRejecting}
                  txHash={rejectHash}
                  className="flex-1"
                  loadingText="Rejecting..."
                  defaultText={<><X className="mr-2 h-4 w-4" />Reject</>}
                />
              </div>
            )}

            <div className="pt-2 border-t">
              <TransactionButton
                variant="outline"
                size="sm"
                onClick={handleGenerateRecommendation}
                disabled={isBusy || !isManager}
                isPending={isBusy}
                txHash={submitHash}
                loadingText={isGenerating ? 'Generating…' : 'Confirming...'}
                defaultText={<><Sparkles className="mr-2 h-4 w-4" />Generate New Recommendation</>}
              />
            </div>

            {(acceptError || rejectError) && (
              <p className="text-sm text-destructive">
                {getErrorMessage(acceptError || rejectError)}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
