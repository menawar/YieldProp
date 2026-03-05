'use client'

import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { usePropertyContracts } from '@/lib/property-context'
import { ABIS, formatUsdc } from '@/lib/contracts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TransactionButton } from '@/components/ui/transaction-button'
import { DollarSign } from 'lucide-react'
import { toast } from 'sonner'
import { getBlockExplorerTxUrl, getErrorMessage } from '@/lib/utils'
import { usePropertyData } from '@/lib/use-property-data'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

/**
 * Rental payment submission - approve USDC + receiveRentalPayment (Payment Processor only)
 */

const formSchema = z.object({
  useCurrentPrice: z.boolean(),
  customAmount: z.number().optional()
}).refine((data) => data.useCurrentPrice || (data.customAmount && data.customAmount > 0), {
  message: "Amount must be greater than 0",
  path: ["customAmount"],
})

export function RentalPaymentForm() {
  const contracts = usePropertyContracts()
  const { currentRentalPrice, isPaymentProcessor, usdcBalance, yieldDistributorAllowance } = usePropertyData()

  const { register, watch, formState: { errors, isValid }, reset } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      useCurrentPrice: true,
    },
    mode: "onChange",
  })

  const useCurrentPrice = watch("useCurrentPrice")
  const customAmountValue = watch("customAmount")

  const { writeContract: approve, data: approveHash, isPending: isApproving } = useWriteContract()
  const { writeContract: receivePayment, data: paymentHash, isPending: isSubmitting } = useWriteContract()

  // Calculate required amount
  const amount = useCurrentPrice && currentRentalPrice
    ? currentRentalPrice
    : BigInt(Math.floor((customAmountValue || 0) * 1e6))

  const needsApproval = amount > 0n && (yieldDistributorAllowance === undefined || yieldDistributorAllowance < amount)
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
        onError: (e) => toast.error(getErrorMessage(e)),
      }
    )
  }

  const handleSubmitPayment = () => {
    if (amount <= 0n) {
      toast.error('Invalid amount')
      return
    }
    if (yieldDistributorAllowance !== undefined && yieldDistributorAllowance < amount) {
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
          reset({ useCurrentPrice: true, customAmount: undefined })
        },
        onError: (e) => toast.error(getErrorMessage(e)),
      }
    )
  }

  if (!isPaymentProcessor) return null

  const canApprove = amount > 0n && needsApproval && hasBalance && isValid
  const canSubmit = amount > 0n && !needsApproval && hasBalance && isValid

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
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="use-current"
              {...register("useCurrentPrice")}
              className="rounded"
            />
            <label htmlFor="use-current" className="text-sm">Use current rental price ({formatUsdc(currentRentalPrice)})</label>
          </div>
          {!useCurrentPrice && (
            <div>
              <label className="text-xs font-medium text-muted-foreground flex justify-between">
                <span>Custom amount (USD)</span>
                {errors.customAmount && <span className="text-destructive font-semibold">{errors.customAmount.message}</span>}
              </label>
              <input
                type="number"
                placeholder="2000.00"
                min="0"
                step="0.01"
                {...register("customAmount", { valueAsNumber: true })}
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
              <TransactionButton
                onClick={handleApprove}
                disabled={!canApprove}
                isPending={isApproving}
                txHash={approveHash}
                loadingText="Approving..."
                defaultText="1. Approve USDC"
              />
            ) : (
              <TransactionButton
                onClick={handleSubmitPayment}
                disabled={!canSubmit}
                isPending={isSubmitting}
                txHash={paymentHash}
                loadingText="Submitting..."
                defaultText="2. Submit Payment"
              />
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
