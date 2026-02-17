'use client'

import { useState } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { usePropertyContracts } from '@/lib/property-context'
import { ABIS, formatTokens } from '@/lib/contracts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowRightLeft } from 'lucide-react'
import { toast } from 'sonner'
import { isAddress } from 'viem'
import { getBlockExplorerTxUrl, getErrorMessage } from '@/lib/utils'
import { useInvalidateOnTxConfirm } from '@/lib/use-invalidate-on-tx-confirm'

const TOKEN_DECIMALS = 18

/**
 * Token transfer - send PROP tokens to whitelisted address
 */
export function TokenTransferCard() {
  const { address, isConnected } = useAccount()
  const queryClient = useQueryClient()
  const contracts = usePropertyContracts()
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')

  const { data: balance } = useReadContract({
    address: contracts.PropertyToken,
    abi: ABIS.PropertyToken,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  }) as { data: bigint | undefined, isLoading: boolean, isError: boolean }

  const recipientValidForQuery = recipient && isAddress(recipient)
  const { data: isRecipientWhitelisted } = useReadContract({
    address: contracts.PropertyToken,
    abi: ABIS.PropertyToken,
    functionName: 'isWhitelisted',
    args: recipientValidForQuery ? [recipient as `0x${string}`] : undefined,
  })

  const {
    writeContract: transfer,
    data: hash,
    isPending,
    error,
  } = useWriteContract()

  const { isLoading: isTxPending, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash })

  useInvalidateOnTxConfirm(hash, isTxSuccess)

  const handleTransfer = () => {
    if (!recipient || !amount || !isAddress(recipient)) return
    const amountWei = BigInt(Math.floor(parseFloat(amount) * 10 ** TOKEN_DECIMALS))
    if (amountWei <= 0n) {
      toast.error('Enter a valid amount')
      return
    }
    if (balance !== undefined && amountWei > balance) {
      toast.error('Insufficient balance')
      return
    }
    transfer(
      {
        address: contracts.PropertyToken,
        abi: ABIS.PropertyToken,
        functionName: 'transfer',
        args: [recipient as `0x${string}`, amountWei],
      },
      {
        onError: (e) => toast.error(getErrorMessage(e)),
        onSuccess: (hash) => {
          toast.success('Transfer initiated', {
            description: hash ? (
              <a href={getBlockExplorerTxUrl(hash)} target="_blank" rel="noopener noreferrer" className="underline text-sm">
                View on Etherscan ↗
              </a>
            ) : undefined,
          })
          setRecipient('')
          setAmount('')
        },
      }
    )
  }

  const isValidAddress = recipientValidForQuery
  const amountNum = parseFloat(amount)
  const isValidAmount = !isNaN(amountNum) && amountNum > 0
  const hasEnough = balance !== undefined && amountNum <= Number(balance) / 10 ** TOKEN_DECIMALS
  const recipientNotWhitelisted = isValidAddress && isRecipientWhitelisted === false
  const canTransfer =
    isConnected &&
    isValidAddress &&
    isValidAmount &&
    hasEnough &&
    isRecipientWhitelisted !== false &&
    !isPending &&
    !isTxPending

  if (!isConnected) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif text-base">
          <ArrowRightLeft className="h-4 w-4" />
          Transfer Tokens
        </CardTitle>
        <CardDescription>
          Send PROP tokens to a whitelisted address. Recipient must be on whitelist.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Recipient address</label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x..."
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          {recipient && !isAddress(recipient) && (
            <p className="mt-1 text-xs text-destructive">Invalid address</p>
          )}
          {recipientNotWhitelisted && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
              Recipient must be whitelisted before receiving tokens.
            </p>
          )}
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Amount (PROP)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          {balance !== undefined && (
            <p className="mt-1 text-xs text-muted-foreground">Balance: {formatTokens(balance)}</p>
          )}
        </div>
        <Button onClick={handleTransfer} disabled={!canTransfer} size="sm">
          {isPending || isTxPending ? 'Transferring...' : 'Transfer'}
        </Button>
        {error && <p className="text-xs text-destructive">{getErrorMessage(error)}</p>}
      </CardContent>
    </Card>
  )
}
