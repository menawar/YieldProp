'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAccount, useReadContract, useWatchContractEvent, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { usePropertyContracts } from '@/lib/property-context'
import { ABIS } from '@/lib/contracts'
import { toast } from 'sonner'
import { zeroAddress } from 'viem'
import { getBlockExplorerTxUrl, getErrorMessage } from '@/lib/utils'
import { useInvalidateOnTxConfirm } from '@/lib/use-invalidate-on-tx-confirm'

/**
 * Task 18.1: Contract event watchers + React Query cache invalidation
 * Requirements: 9.6
 * Also: Auto-register new holders for yields when Property Manager is connected
 */
export function ContractEventWatcher() {
  const queryClient = useQueryClient()
  const contracts = usePropertyContracts()
  const { address } = useAccount()
  const { writeContract, data: registerHash } = useWriteContract()
  const { isSuccess: isRegisterSuccess } = useWaitForTransactionReceipt({ hash: registerHash })
  useInvalidateOnTxConfirm(registerHash, isRegisterSuccess)
  const registeringRef = useRef<Set<string>>(new Set())

  const { data: managerRole } = useReadContract({
    address: contracts.YieldDistributor,
    abi: ABIS.YieldDistributor,
    functionName: 'PROPERTY_MANAGER_ROLE',
  })

  const { data: isManager } = useReadContract({
    address: contracts.YieldDistributor,
    abi: ABIS.YieldDistributor,
    functionName: 'hasRole',
    args: address && managerRole ? [managerRole, address] : undefined,
  })

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['readContract'] })
  }

  // Invalidate when user switches wallet/account - data is address-dependent
  const prevAddress = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (prevAddress.current !== undefined && prevAddress.current !== address) {
      invalidateAll()
    }
    prevAddress.current = address
  }, [address])

  const tryRegisterHolder = (holder: `0x${string}`) => {
    if (!holder || holder === zeroAddress || holder.toLowerCase() === zeroAddress.toLowerCase()) return
    if (!isManager) return
    const key = holder.toLowerCase()
    if (registeringRef.current.has(key)) return
    registeringRef.current.add(key)
    writeContract(
      {
        address: contracts.YieldDistributor,
        abi: ABIS.YieldDistributor,
        functionName: 'registerHolder',
        args: [holder],
      },
      {
        onSettled: () => {
          registeringRef.current.delete(key)
        },
        onSuccess: (hash) => {
          toast.success(`New holder ${holder.slice(0, 10)}… registered for yields`, {
            description: hash ? (
              <a href={getBlockExplorerTxUrl(hash)} target="_blank" rel="noopener noreferrer" className="underline text-sm">
                View on Etherscan ↗
              </a>
            ) : undefined,
          })
        },
        onError: (e) => {
          toast.error(getErrorMessage(e))
        },
      }
    )
  }

  // PriceManager events
  useWatchContractEvent({
    address: contracts.PriceManager,
    abi: ABIS.PriceManager,
    eventName: 'RecommendationSubmitted',
    onLogs: () => {
      invalidateAll()
      toast.info('New AI recommendation received')
    },
  })

  useWatchContractEvent({
    address: contracts.PriceManager,
    abi: ABIS.PriceManager,
    eventName: 'RecommendationAccepted',
    onLogs: () => {
      invalidateAll()
      toast.success('Rental price updated')
    },
  })

  useWatchContractEvent({
    address: contracts.PriceManager,
    abi: ABIS.PriceManager,
    eventName: 'RecommendationRejected',
    onLogs: () => {
      invalidateAll()
      toast.info('Recommendation rejected')
    },
  })

  useWatchContractEvent({
    address: contracts.PriceManager,
    abi: ABIS.PriceManager,
    eventName: 'RentalPriceUpdated',
    onLogs: () => {
      invalidateAll()
      toast.success('Rental price updated')
    },
  })

  // YieldDistributor events
  useWatchContractEvent({
    address: contracts.YieldDistributor,
    abi: ABIS.YieldDistributor,
    eventName: 'RentalPaymentReceived',
    onLogs: () => {
      invalidateAll()
      toast.info('Rental payment received')
    },
  })

  useWatchContractEvent({
    address: contracts.YieldDistributor,
    abi: ABIS.YieldDistributor,
    eventName: 'YieldsDistributed',
    onLogs: () => {
      invalidateAll()
      toast.success('Yields distributed to token holders')
    },
  })

  useWatchContractEvent({
    address: contracts.YieldDistributor,
    abi: ABIS.YieldDistributor,
    eventName: 'YieldTransferred',
    onLogs: () => {
      invalidateAll()
    },
  })

  // PropertyToken - whitelist changes
  useWatchContractEvent({
    address: contracts.PropertyToken,
    abi: ABIS.PropertyToken,
    eventName: 'WhitelistUpdated',
    onLogs: () => {
      invalidateAll()
      toast.info('Whitelist updated')
    },
  })

  // PropertyToken Transfer - auto-register recipient for yields (when PM connected)
  useWatchContractEvent({
    address: contracts.PropertyToken,
    abi: ABIS.PropertyToken,
    eventName: 'Transfer',
    onLogs: (logs) => {
      invalidateAll()
      for (const log of logs) {
        const { to } = (log as any).args as { from?: `0x${string}`; to?: `0x${string}`; value?: bigint }
        if (to && to !== zeroAddress) tryRegisterHolder(to)
      }
    },
  })

  // PropertySale TokensPurchased - invalidate cache (buyer auto-registered on-chain by PropertySale)
  useWatchContractEvent({
    address: contracts.PropertySale,
    abi: ABIS.PropertySale,
    eventName: 'TokensPurchased',
    onLogs: () => {
      invalidateAll()
      toast.info('Property tokens purchased')
    },
  })

  return null
}
