'use client'

import { useState } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { usePropertyContracts } from '@/lib/property-context'
import { ABIS } from '@/lib/contracts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShieldCheck, UserPlus, UserMinus } from 'lucide-react'
import { toast } from 'sonner'
import { isAddress } from 'viem'
import { getBlockExplorerTxUrl } from '@/lib/utils'
import { useInvalidateOnTxConfirm } from '@/lib/use-invalidate-on-tx-confirm'

/**
 * Whitelist management - add/remove addresses (Property Manager only)
 */
export function WhitelistManager() {
  const { address } = useAccount()
  const queryClient = useQueryClient()
  const contracts = usePropertyContracts()
  const [newAddress, setNewAddress] = useState('')
  const [removeAddress, setRemoveAddress] = useState('')

  const { data: managerRole } = useReadContract({
    address: contracts.PropertyToken,
    abi: ABIS.PropertyToken,
    functionName: 'PROPERTY_MANAGER_ROLE',
  }) as { data: `0x${string}` | undefined }

  const { data: isManager } = useReadContract({
    address: contracts.PropertyToken,
    abi: ABIS.PropertyToken,
    functionName: 'hasRole',
    args: address && managerRole ? [managerRole, address] : undefined,
  }) as { data: boolean | undefined }

  const { data: isWhitelisted } = useReadContract({
    address: contracts.PropertyToken,
    abi: ABIS.PropertyToken,
    functionName: 'isWhitelisted',
    args: removeAddress && isAddress(removeAddress) ? [removeAddress as `0x${string}`] : undefined,
  }) as { data: boolean | undefined }

  const { writeContract: addToWhitelist, data: addHash, isPending: isAdding } = useWriteContract()
  const { writeContract: removeFromWhitelist, data: removeHash, isPending: isRemoving } = useWriteContract()

  const { isLoading: isAddTx, isSuccess: isAddSuccess } = useWaitForTransactionReceipt({ hash: addHash })
  const { isLoading: isRemoveTx, isSuccess: isRemoveSuccess } = useWaitForTransactionReceipt({ hash: removeHash })

  useInvalidateOnTxConfirm(addHash, isAddSuccess)
  useInvalidateOnTxConfirm(removeHash, isRemoveSuccess)

  const handleAdd = () => {
    if (!newAddress || !isAddress(newAddress)) {
      toast.error('Invalid address')
      return
    }
    addToWhitelist(
      {
        address: contracts.PropertyToken,
        abi: ABIS.PropertyToken,
        functionName: 'addToWhitelist',
        args: [newAddress as `0x${string}`],
      },
      {
        onSuccess: (hash) => {
          toast.success('Address added to whitelist', {
            description: hash ? (
              <a href={getBlockExplorerTxUrl(hash)} target="_blank" rel="noopener noreferrer" className="underline text-sm">
                View on Etherscan ↗
              </a>
            ) : undefined,
          })
          setNewAddress('')
        },
      }
    )
  }

  const handleRemove = () => {
    if (!removeAddress || !isAddress(removeAddress)) {
      toast.error('Invalid address')
      return
    }
    if (
      !window.confirm(
        `Remove ${removeAddress.slice(0, 10)}… from whitelist? This address will no longer be able to receive or transfer tokens.`
      )
    ) {
      return
    }
    removeFromWhitelist(
      {
        address: contracts.PropertyToken,
        abi: ABIS.PropertyToken,
        functionName: 'removeFromWhitelist',
        args: [removeAddress as `0x${string}`],
      },
      {
        onSuccess: (hash) => {
          toast.success('Address removed from whitelist', {
            description: hash ? (
              <a href={getBlockExplorerTxUrl(hash)} target="_blank" rel="noopener noreferrer" className="underline text-sm">
                View on Etherscan ↗
              </a>
            ) : undefined,
          })
          setRemoveAddress('')
        },
      }
    )
  }

  if (!isManager) return null

  const addBusy = isAdding || isAddTx
  const removeBusy = isRemoving || isRemoveTx

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif text-base">
          <ShieldCheck className="h-4 w-4" />
          Whitelist Management
        </CardTitle>
        <CardDescription>
          Add or remove addresses allowed to receive PROP tokens.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Add address</label>
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              placeholder="0x..."
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
            />
            <Button size="sm" onClick={handleAdd} disabled={!isAddress(newAddress) || addBusy}>
              <UserPlus className="mr-1 h-3.5 w-3.5" />
              {addBusy ? 'Adding...' : 'Add'}
            </Button>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Remove address</label>
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              value={removeAddress}
              onChange={(e) => setRemoveAddress(e.target.value)}
              placeholder="0x..."
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
            />
            <Button
              size="sm"
              variant="destructive"
              onClick={handleRemove}
              disabled={!isAddress(removeAddress) || removeBusy}
            >
              <UserMinus className="mr-1 h-3.5 w-3.5" />
              {removeBusy ? 'Removing...' : 'Remove'}
            </Button>
          </div>
          {removeAddress && isAddress(removeAddress) && (
            <p className="mt-1 text-xs text-muted-foreground">
              Status: {isWhitelisted ? 'Whitelisted' : 'Not whitelisted'}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
