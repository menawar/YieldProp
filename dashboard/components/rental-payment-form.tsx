'use client'

import { useState } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { usePropertyContracts } from '@/lib/property-context'
import { ABIS, formatUsdc } from '@/lib/contracts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DollarSign } from 'lucide-react'
import { toast } from 'sonner'
import { getBlockExplorerTxUrl } from '@/lib/utils'
import { useInvalidateOnTxConfirm } from '@/lib/use-invalidate-on-tx-confirm'

/**
 * Rental payment submission - approve USDC + receiveRentalPayment (Payment Processor only)
 */
export function RentalPaymentForm() {
  const { address } = useAccount()
  const queryClient = useQueryClient()
  const contracts = usePropertyContracts()
  const [useCurrentPrice, setUseCurrentPrice] = useState(true)
  const [customAmount, setCustomAmount] = useState('')

  const { data: managerRole } = useReadContract({
    address: contracts.YieldDistributor,
    abi: ABIS.YieldDistributor,
    functionName: 'PAYMENT_PROCESSOR_ROLE',
  })

  const { data: isPaymentProcessor } = useReadContract({
    address: contracts.YieldDistributor,
    abi: ABIS.YieldDistributor,
    functionName: 'hasRole',
    args: address && managerRole ? [managerRole, address] : undefined,
  })

  const { data: currentPrice } = useReadContract({
    address: contracts.PriceManager,
    abi: ABIS.PriceManager,
    functionName: 'getCurrentRentalPrice',
  })

  const { data: usdcBalance } = useReadContract({
    address: contracts.MockUSDC,
    abi: ABIS.ERC20,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  })

  const { data: allowance } = useReadContract({
    address: contracts.MockUSDC,
    abi: ABIS.ERC20,
    functionName: 'allowance',
    args: address ? [address, contracts.YieldDistributor] : undefined,
  })

  const { writeContract: approve, data: approveHash, isPending: isApproving } = useWriteContract()
  const { writeContract: receivePayment, data: paymentHash, isPending: isSubmitting } = useWriteContract()

  const { isLoading: isApproveTx, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({ hash: approveHash })
  const { isLoading: isPaymentTx, isSuccess: isPaymentSuccess } = useWaitForTransactionReceipt({ hash: paymentHash })

  useInvalidateOnTxConfirm(approveHash, isApproveSuccess)
  useInvalidateOnTxConfirm(paymentHash, isPaymentSuccess)

  const amount = useCurrentPrice && currentPrice ? currentPrice : BigInt(Math.floor(parseFloat(customAmount || '0') * 1e6))
  const needsApproval = amount > 0n && (allowance === undefined || allowance < amount)
  const hasBalance = usdcBalance !== undefined && amount <= usdcBalance

  const handleApprove = () => {
    if (amount <= 0n) return
    approve(
      {
        address: contracts.MockUSDC,
        abi: ABIS.ERC20,
        functionName: 'approve',
        args: [contracts.YieldDistributor, amount],
      },
      {
        onSuccess: (hash) => {
          toast.success('Approval submitted', {
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

  const handleSubmitPayment = () => {
    if (amount <= 0n) {
      toast.error('Invalid amount')
      return
    }
    if (allowance !== undefined && allowance < amount) {
      toast.error('Approve USDC first')
      return
    }
    receivePayment(
      {
        address: contracts.YieldDistributor,
        abi: ABIS.YieldDistributor,
        functionName: 'receiveRentalPayment',
        args: [amount],
      },
      {
        onSuccess: (hash) => {
          toast.success('Rental payment submitted', {
            description: hash ? (
              <a href={getBlockExplorerTxUrl(hash)} target="_blank" rel="noopener noreferrer" className="underline text-sm">
                View on Etherscan ↗
              </a>
            ) : undefined,
          })
          setCustomAmount('')
        },
      }
    )
  }

  if (!isPaymentProcessor) return null

  const approveBusy = isApproving || isApproveTx
  const paymentBusy = isSubmitting || isPaymentTx
  const canApprove = amount > 0n && needsApproval && hasBalance && !approveBusy
  const canSubmit = amount > 0n && !needsApproval && hasBalance && !paymentBusy

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif text-base">
          <DollarSign className="h-4 w-4" />
          Submit Rental Payment
        </CardTitle>
        <CardDescription>
          Submit USDC rental payment to the distribution pool. Requires Payment Processor role.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="use-current"
            checked={useCurrentPrice}
            onChange={(e) => setUseCurrentPrice(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="use-current" className="text-sm">Use current rental price ({formatUsdc(currentPrice)})</label>
        </div>
        {!useCurrentPrice && (
          <div>
            <label className="text-xs font-medium text-muted-foreground">Custom amount (USD)</label>
            <input
              type="number"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder="2000.00"
              min="0"
              step="0.01"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
        )}
        <div className="text-xs text-muted-foreground">
          Your USDC balance: {formatUsdc(usdcBalance)}
        </div>
        {!hasBalance && amount > 0n && (
          <p className="text-xs text-destructive">Insufficient USDC. Get testnet USDC from a faucet.</p>
        )}
        <div className="flex gap-2">
          {needsApproval ? (
            <Button size="sm" onClick={handleApprove} disabled={!canApprove}>
              {approveBusy ? 'Approving...' : '1. Approve USDC'}
            </Button>
          ) : (
            <Button size="sm" onClick={handleSubmitPayment} disabled={!canSubmit}>
              {paymentBusy ? 'Submitting...' : '2. Submit Payment'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
