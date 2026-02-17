'use client'

import { useState } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { usePropertyContracts } from '@/lib/property-context'
import { ABIS } from '@/lib/contracts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Package } from 'lucide-react'
import { toast } from 'sonner'
import { getBlockExplorerTxUrl, getErrorMessage } from '@/lib/utils'
import { useInvalidateOnTxConfirm } from '@/lib/use-invalidate-on-tx-confirm'

const TOKEN_DECIMALS = 18

/**
 * Property Manager: Set how many tokens are offered for sale via PropertySale.
 * Until set, no one can purchase (prevents accidental full sale).
 */
export function SaleOfferingCard() {
  const { address } = useAccount()
  const queryClient = useQueryClient()
  const contracts = usePropertyContracts()
  const [amount, setAmount] = useState('')

  const { data: ptManagerRoleRaw } = useReadContract({
    address: contracts.PropertyToken,
    abi: ABIS.PropertyToken,
    functionName: 'PROPERTY_MANAGER_ROLE',
  })
  const ptManagerRole = ptManagerRoleRaw as unknown as `0x${string}` | undefined
  const { data: isManagerRaw } = useReadContract({
    address: contracts.PropertyToken,
    abi: ABIS.PropertyToken,
    functionName: 'hasRole',
    args: address && ptManagerRole ? [ptManagerRole, address] : undefined,
  })
  const isManager = isManagerRaw as unknown as boolean | undefined

  const { data: tokensOfferedForSaleRaw } = useReadContract({
    address: contracts.PropertySale,
    abi: ABIS.PropertySale,
    functionName: 'tokensOfferedForSale',
  })
  const tokensOfferedForSale = tokensOfferedForSaleRaw as unknown as bigint | undefined
  const { data: tokenHolderRaw } = useReadContract({
    address: contracts.PropertySale,
    abi: ABIS.PropertySale,
    functionName: 'tokenHolder',
  })
  const tokenHolder = tokenHolderRaw as unknown as `0x${string}` | undefined
  const { data: holderBalanceRaw } = useReadContract({
    address: contracts.PropertyToken,
    abi: ABIS.PropertyToken,
    functionName: 'balanceOf',
    args: tokenHolder ? [tokenHolder] : undefined,
  })
  const holderBalance = holderBalanceRaw as unknown as bigint | undefined

  const { writeContract, data: txHash, isPending } = useWriteContract()
  const { isLoading: isTxPending, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  useInvalidateOnTxConfirm(txHash, isTxSuccess)

  const offeredNum = tokensOfferedForSale !== undefined ? Number(tokensOfferedForSale) / 10 ** TOKEN_DECIMALS : 0
  const maxAvailable = holderBalance !== undefined ? Number(holderBalance) / 10 ** TOKEN_DECIMALS : 0
  const amountWei = amount ? BigInt(Math.floor(parseFloat(amount) * 10 ** TOKEN_DECIMALS)) : 0n

  const handleSet = () => {
    if (!amount || parseFloat(amount) < 0) {
      toast.error('Enter a valid amount')
      return
    }
    if (amountWei > (holderBalance ?? 0n)) {
      toast.error(`Cannot exceed token holder balance (${maxAvailable.toFixed(2)} tokens)`)
      return
    }
    writeContract(
      {
        address: contracts.PropertySale,
        abi: ABIS.PropertySale,
        functionName: 'setTokensOfferedForSale',
        args: [amountWei],
      },
      {
        onSuccess: (hash) => {
          toast.success('Sale offering updated', {
            description: hash ? (
              <a href={getBlockExplorerTxUrl(hash)} target="_blank" rel="noopener noreferrer" className="underline text-sm">
                View on Etherscan ↗
              </a>
            ) : undefined,
          })
          setAmount('')
        },
        onError: (e) => toast.error(getErrorMessage(e)),
      }
    )
  }

  const busy = isPending || isTxPending

  if (!isManager) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif text-base">
          <Package className="h-4 w-4" />
          Sale Offering
        </CardTitle>
        <CardDescription>
          Set how many tokens are available for purchase. Until set, no one can buy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Currently offered: <strong>{offeredNum.toFixed(2)}</strong> tokens
          {maxAvailable > 0 && ` (max available: ${maxAvailable.toFixed(2)})`}
        </p>
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            max={maxAvailable}
            step="0.1"
            placeholder="e.g. 20"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
          />
          <Button
            size="sm"
            onClick={handleSet}
            disabled={busy || !amount || parseFloat(amount) < 0 || amountWei > (holderBalance ?? 0n)}
          >
            {busy ? 'Updating…' : 'Set Offering'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
