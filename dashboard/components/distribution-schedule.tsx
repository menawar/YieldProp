'use client'

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { usePropertyContracts } from '@/lib/property-context'
import { ABIS, formatUsdc } from '@/lib/contracts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, Send } from 'lucide-react'
import { toast } from 'sonner'
import { getBlockExplorerTxUrl, getErrorMessage } from '@/lib/utils'
import { useInvalidateOnTxConfirm } from '@/lib/use-invalidate-on-tx-confirm'

/**
 * Task 16.1: Distribution schedule - pool status and distribute trigger
 * Requirements: 9.3
 */
export function DistributionSchedule() {
  const { address } = useAccount()
  const queryClient = useQueryClient()
  const contracts = usePropertyContracts()

  const { data: poolBalance } = useReadContract({
    address: contracts.YieldDistributor,
    abi: ABIS.YieldDistributor,
    functionName: 'getDistributionPool',
  })

  const { data: managerRole } = useReadContract({
    address: contracts.YieldDistributor,
    abi: ABIS.YieldDistributor,
    functionName: 'PROPERTY_MANAGER_ROLE',
  })

  const { data: isManager } = useReadContract({
    address: contracts.YieldDistributor,
    abi: ABIS.YieldDistributor,
    functionName: 'hasRole',
    args: address ? [managerRole ?? '0x', address] : undefined,
  })

  const {
    writeContract: distributeYields,
    data: hash,
    isPending,
    error,
  } = useWriteContract()

  const { isLoading: isTxPending, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash })

  useInvalidateOnTxConfirm(hash, isTxSuccess)

  const canDistribute = poolBalance && poolBalance > 0n && isManager
  const isBusy = isPending || isTxPending

  const handleDistribute = () => {
    distributeYields(
      {
        address: contracts.YieldDistributor,
        abi: ABIS.YieldDistributor,
        functionName: 'distributeYields',
      },
      {
        onSuccess: (hash) => {
          toast.success('Yields distributed successfully', {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif">
          <Calendar className="h-5 w-5" />
          Next Distribution
        </CardTitle>
        <CardDescription>Trigger yield distribution when pool has funds</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Pool balance</p>
            <p className="text-xl font-semibold">{formatUsdc(poolBalance)}</p>
          </div>
          {canDistribute && (
            <Button onClick={handleDistribute} disabled={isBusy}>
              <Send className="mr-2 h-4 w-4" />
              Distribute Now
            </Button>
          )}
        </div>
        {poolBalance === 0n || !poolBalance ? (
          <p className="text-sm text-muted-foreground">
            No pending funds. Rental payments will be added to the pool for distribution.
          </p>
        ) : !isManager ? (
          <p className="text-sm text-muted-foreground">
            Only the property manager can trigger distribution.
          </p>
        ) : null}
        {error && <p className="text-sm text-destructive">{getErrorMessage(error)}</p>}
      </CardContent>
    </Card>
  )
}
