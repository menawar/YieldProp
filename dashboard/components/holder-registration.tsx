'use client'

import { useState } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { usePropertyContracts } from '@/lib/property-context'
import { ABIS } from '@/lib/contracts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users } from 'lucide-react'
import { toast } from 'sonner'
import { isAddress } from 'viem'
import { getBlockExplorerTxUrl, getErrorMessage } from '@/lib/utils'
import { useInvalidateOnTxConfirm } from '@/lib/use-invalidate-on-tx-confirm'

/**
 * Holder registration - Property Manager registers others; any token holder can self-register for yields
 */
export function HolderRegistration() {
  const { address } = useAccount()
  const queryClient = useQueryClient()
  const contracts = usePropertyContracts()
  const [newHolder, setNewHolder] = useState('')
  const [batchInput, setBatchInput] = useState('')

  const { data: tokenBalance } = useReadContract({
    address: contracts.PropertyToken,
    abi: ABIS.PropertyToken,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  })

  const { data: isRegistered } = useReadContract({
    address: contracts.YieldDistributor,
    abi: ABIS.YieldDistributor,
    functionName: 'isRegisteredHolder',
    args: address ? [address] : undefined,
  })

  const { data: isNewHolderRegistered } = useReadContract({
    address: contracts.YieldDistributor,
    abi: ABIS.YieldDistributor,
    functionName: 'isRegisteredHolder',
    args: newHolder && isAddress(newHolder) ? [newHolder as `0x${string}`] : undefined,
  })

  const { writeContract: registerSelf, data: selfHash, isPending: isSelfPending } = useWriteContract()
  const { isLoading: isSelfTx, isSuccess: isSelfSuccess } = useWaitForTransactionReceipt({ hash: selfHash })

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

  const { data: registeredHolders } = useReadContract({
    address: contracts.YieldDistributor,
    abi: ABIS.YieldDistributor,
    functionName: 'getRegisteredHolders',
  })

  const { writeContract: registerHolder, data: singleHash, isPending: isSinglePending } = useWriteContract()
  const { writeContract: registerHolders, data: batchHash, isPending: isBatchPending } = useWriteContract()

  const { isLoading: isSingleTx, isSuccess: isSingleSuccess } = useWaitForTransactionReceipt({ hash: singleHash })
  const { isLoading: isBatchTx, isSuccess: isBatchSuccess } = useWaitForTransactionReceipt({ hash: batchHash })

  useInvalidateOnTxConfirm(selfHash, isSelfSuccess)
  useInvalidateOnTxConfirm(singleHash, isSingleSuccess)
  useInvalidateOnTxConfirm(batchHash, isBatchSuccess)

  const handleRegisterSingle = () => {
    if (!newHolder || !isAddress(newHolder)) {
      toast.error('Invalid address')
      return
    }
    if (isNewHolderRegistered) {
      toast.error('This address is already registered for yield distribution')
      return
    }
    registerHolder(
      {
        address: contracts.YieldDistributor,
        abi: ABIS.YieldDistributor,
        functionName: 'registerHolder',
        args: [newHolder as `0x${string}`],
      },
      {
        onSuccess: (hash) => {
          toast.success('Holder registered', {
            description: hash ? (
              <a href={getBlockExplorerTxUrl(hash)} target="_blank" rel="noopener noreferrer" className="underline text-sm">
                View on Etherscan ↗
              </a>
            ) : undefined,
          })
          setNewHolder('')
        },
      }
    )
  }

  const handleRegisterBatch = () => {
    const addresses = batchInput
      .split(/[\n,;\s]+/)
      .map((a) => a.trim())
      .filter((a) => a && isAddress(a))
    if (addresses.length === 0) {
      toast.error('Enter valid addresses (one per line or comma-separated)')
      return
    }
    const registeredSet = new Set((registeredHolders ?? []).map((a) => a.toLowerCase()))
    const toRegister = addresses.filter((a) => !registeredSet.has(a.toLowerCase()))
    const alreadyCount = addresses.length - toRegister.length
    if (toRegister.length === 0) {
      toast.error(
        alreadyCount === 1
          ? 'This address is already registered for yield distribution'
          : `All ${addresses.length} address(es) are already registered for yield distribution`
      )
      return
    }
    if (alreadyCount > 0) {
      toast.info(`${alreadyCount} address(es) already registered — registering ${toRegister.length} new holder(s)`)
    }
    registerHolders(
      {
        address: contracts.YieldDistributor,
        abi: ABIS.YieldDistributor,
        functionName: 'registerHolders',
        args: [toRegister as `0x${string}`[]],
      },
      {
        onSuccess: (hash) => {
          toast.success(`${toRegister.length} holder(s) registered`, {
            description: hash ? (
              <a href={getBlockExplorerTxUrl(hash)} target="_blank" rel="noopener noreferrer" className="underline text-sm">
                View on Etherscan ↗
              </a>
            ) : undefined,
          })
          setBatchInput('')
        },
      }
    )
  }

  const singleBusy = isSinglePending || isSingleTx
  const batchBusy = isBatchPending || isBatchTx
  const selfBusy = isSelfPending || isSelfTx

  // Only show self-register when we've confirmed user is NOT registered (not when loading/undefined)
  const showSelfRegister =
    address && tokenBalance && tokenBalance > 0n && isRegistered === false

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif text-base">
          <Users className="h-4 w-4" />
          Holder Registration
        </CardTitle>
        <CardDescription>
          Register token holders to receive yield distributions. Only registered holders receive yields.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {address && tokenBalance && tokenBalance > 0n && isRegistered === true && (
          <p className="text-sm text-muted-foreground">
            You&apos;re registered for yield distributions. You&apos;ll receive your share when distributions are made.
          </p>
        )}
        {showSelfRegister && (
          <div>
            <label className="text-xs font-medium text-muted-foreground">You hold tokens but are not registered</label>
            <p className="mt-1 text-sm text-muted-foreground">
              Click below to register yourself and start receiving yield distributions.
            </p>
            <Button
              size="sm"
              variant="default"
              className="mt-2"
              onClick={() =>
                registerSelf(
                  {
                    address: contracts.YieldDistributor,
                    abi: ABIS.YieldDistributor,
                    functionName: 'registerHolderForSelf',
                  },
                  {
                    onSuccess: (hash) => {
                      toast.success('You are now registered for yield distributions', {
                        description: hash ? (
                          <a href={getBlockExplorerTxUrl(hash)} target="_blank" rel="noopener noreferrer" className="underline text-sm">
                            View on Etherscan ↗
                          </a>
                        ) : undefined,
                      })
                    },
                    onError: (e) => toast.error(getErrorMessage(e)),
                  }
                )
              }
              disabled={selfBusy}
            >
              {selfBusy ? 'Registering...' : 'Register Myself for Yields'}
            </Button>
          </div>
        )}
        {isManager && (
          <>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Register single holder</label>
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={newHolder}
                  onChange={(e) => setNewHolder(e.target.value)}
                  placeholder="0x..."
                  className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                />
                <Button
                  size="sm"
                  onClick={handleRegisterSingle}
                  disabled={!isAddress(newHolder) || singleBusy || !!isNewHolderRegistered}
                >
                  {singleBusy ? 'Registering...' : isNewHolderRegistered ? 'Already registered' : 'Register'}
                </Button>
              </div>
              {isNewHolderRegistered && newHolder && isAddress(newHolder) && (
                <p className="mt-1 text-xs text-amber-600">This address is already registered for yield distribution.</p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Register multiple (one per line or comma-separated)</label>
              <textarea
                value={batchInput}
                onChange={(e) => setBatchInput(e.target.value)}
                placeholder="0x...&#10;0x...&#10;0x..."
                rows={3}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
              />
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={handleRegisterBatch}
                disabled={batchBusy || !batchInput.trim()}
              >
                {batchBusy ? 'Registering...' : 'Register All'}
              </Button>
            </div>
          </>
        )}
        {isManager && registeredHolders && registeredHolders.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Registered holders: {registeredHolders.length}
            </p>
            <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
              {registeredHolders.slice(0, 3).join(', ')}
              {registeredHolders.length > 3 ? '...' : ''}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
