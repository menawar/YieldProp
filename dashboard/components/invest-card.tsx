'use client'

/**
 * Invest Card - Purchase property tokens with USDC
 * Uses PropertySale.invest(tokenAmount) - requires whitelist and USDC approval
 */

import { useState, useEffect } from 'react'
import { useAccount, useWriteContract } from 'wagmi'
import { usePropertyContracts } from '@/lib/property-context'
import { ABIS, formatUsdc } from '@/lib/contracts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TransactionButton } from '@/components/ui/transaction-button'
import { DollarSign, Droplets } from 'lucide-react'
import { toast } from 'sonner'
import { getBlockExplorerTxUrl, getErrorMessage } from '@/lib/utils'
import { usePropertyData } from '@/lib/use-property-data'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

const TOKEN_DECIMALS = 18
const USDC_DECIMALS = 6

const formSchema = z.object({
  tokenAmount: z.number().min(0.01, "Must buy at least 0.01 tokens").max(100, "Cannot buy more than 100% of the property"),
})

export function InvestCard() {
  const { address, isConnected } = useAccount()
  const contracts = usePropertyContracts()
  const { saleActive, tokensOfferedForSale, pricePerToken, isWhitelisted, usdcBalance, saleAllowance } = usePropertyData()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const { register, watch, formState: { errors, isValid }, reset } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
  })

  const tokenAmountValue = watch("tokenAmount")
  const tokenAmountWei = tokenAmountValue
    ? BigInt(Math.floor(tokenAmountValue * 10 ** TOKEN_DECIMALS))
    : 0n

  // pricePerToken from PropertySale is in USDC (6 decimals). Cost = (tokenAmount * pricePerToken) / 1e18.
  const displayCostUsdc =
    tokenAmountWei > 0n && pricePerToken !== undefined && pricePerToken !== null && pricePerToken > 0n
      ? (tokenAmountWei * pricePerToken) / 10n ** 18n
      : 0n

  const needsApproval =
    displayCostUsdc > 0n && saleAllowance !== undefined && saleAllowance < displayCostUsdc

  const { writeContract: invest, data: investHash, isPending: isInvestPending } = useWriteContract()
  const { writeContract: approve, data: approveHash, isPending: isApprovePending } = useWriteContract()
  const { writeContract: mintUsdc, data: mintUsdcHash, isPending: isMintUsdcPending } = useWriteContract()

  const handleApprove = () => {
    if (!displayCostUsdc || displayCostUsdc <= 0n) return
    approve(
      {
        address: contracts.MockUSDC,
        abi: ABIS.ERC20,
        functionName: 'approve',
        args: [contracts.PropertySale, displayCostUsdc],
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

  const handleInvest = () => {
    if (!tokenAmountWei || tokenAmountWei <= 0n) return
    invest(
      {
        address: contracts.PropertySale,
        abi: ABIS.PropertySale,
        functionName: 'invest',
        args: [tokenAmountWei],
      },
      {
        onSuccess: (hash) => {
          toast.success('Purchase submitted', {
            description: hash ? (
              <a href={getBlockExplorerTxUrl(hash)} target="_blank" rel="noopener noreferrer" className="underline text-sm">
                View on Etherscan ↗
              </a>
            ) : undefined,
          })
          reset()
        },
        onError: (e) => toast.error(getErrorMessage(e)),
      }
    )
  }

  const handleFaucet = () => {
    if (!address) return
    const mintAmount = 10_000n * (10n ** BigInt(USDC_DECIMALS))
    mintUsdc(
      {
        address: contracts.MockUSDC,
        abi: [...ABIS.ERC20, {
          inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
          name: 'mint',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        }],
        functionName: 'mint',
        args: [address, mintAmount],
      },
      {
        onSuccess: (hash) => {
          toast.success('Test USDC minted successfully!', {
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

  const amountNum = tokenAmountValue || 0
  const offeredWei = tokensOfferedForSale ?? 0n
  const offeredNum = Number(offeredWei) / 10 ** TOKEN_DECIMALS

  const hasEnoughUsdc =
    displayCostUsdc > 0n && usdcBalance !== undefined && usdcBalance >= displayCostUsdc

  const canInvest =
    isConnected &&
    saleActive &&
    isWhitelisted &&
    isValid &&
    hasEnoughUsdc &&
    !needsApproval &&
    amountNum > 0 &&
    tokenAmountWei <= offeredWei

  // Prevent hydration mismatch: server and initial client render same structure until mounted
  if (!mounted || !isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif text-base">
            <DollarSign className="h-4 w-4" />
            Invest in Property
          </CardTitle>
          <CardDescription>Connect your wallet to purchase property tokens with USDC</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 font-serif text-base">
              <DollarSign className="h-4 w-4" />
              Invest in Property
            </CardTitle>
            <CardDescription>Purchase fractional ownership tokens with USDC</CardDescription>
          </div>
          {!saleActive && <Badge variant="secondary">Sale Closed</Badge>}
          {saleActive && !isWhitelisted && <Badge variant="outline">Not Whitelisted</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        {contracts.PropertySale === '0x0000000000000000000000000000000000000000' ? (
          <div className="rounded-lg border border-dashed p-4 bg-muted/20 text-center text-sm text-muted-foreground">
            PropertySale contract missing. Please sync network configuration.
          </div>
        ) : !saleActive ? (
          <div className="rounded-lg border border-dashed p-4 bg-muted/20 text-center text-sm text-muted-foreground">
            The token sale is currently closed. Contact the property manager.
          </div>
        ) : !isWhitelisted ? (
          <div className="rounded-lg border border-dashed border-red-200 p-4 bg-red-50/10 text-center text-sm text-red-800 dark:text-red-200">
            You must be whitelisted to invest. Contact the property manager.
          </div>
        ) : (offeredNum <= 0 ? (
          <div className="rounded-lg border border-dashed p-4 bg-muted/20 text-center text-sm text-muted-foreground">
            No tokens are currently offered for sale.
          </div>
        ) : (
          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div>
              <label className="text-xs font-medium text-muted-foreground flex justify-between">
                <span>Token amount (1 token = 1% ownership)</span>
                {errors.tokenAmount && <span className="text-destructive font-semibold">{errors.tokenAmount.message}</span>}
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 5"
                {...register("tokenAmount", { valueAsNumber: true })}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            {displayCostUsdc > 0n && (
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2">
                <span className="text-sm text-muted-foreground">Cost</span>
                <span className="font-semibold">{formatUsdc(displayCostUsdc)} USDC</span>
              </div>
            )}

            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>Your USDC balance: {formatUsdc(usdcBalance)}</span>
                <TransactionButton
                  variant="link"
                  size="sm"
                  className="h-auto px-0 text-xs flex items-center gap-1"
                  onClick={handleFaucet}
                  isPending={isMintUsdcPending}
                  txHash={mintUsdcHash}
                  loadingText="Minting..."
                  defaultText={<><Droplets className="h-3 w-3" /> Get 10k Test USDC</>}
                />
              </div>
              {offeredNum > 0 && <span>Available: {offeredNum.toFixed(2)} tokens</span>}
            </div>

            <div className="flex gap-2 pt-2">
              {needsApproval ? (
                <TransactionButton
                  className="w-full"
                  onClick={handleApprove}
                  isPending={isApprovePending}
                  txHash={approveHash}
                  loadingText="Approving..."
                  defaultText="1. Approve USDC"
                  disabled={!isValid || displayCostUsdc <= 0n || !hasEnoughUsdc}
                />
              ) : (
                <TransactionButton
                  className="w-full"
                  onClick={handleInvest}
                  isPending={isInvestPending}
                  txHash={investHash}
                  loadingText="Purchasing..."
                  defaultText={needsApproval === false && amountNum > 0 ? "2. Purchase Tokens" : "Purchase Tokens"}
                  disabled={!canInvest}
                />
              )}
            </div>
            {isValid && !hasEnoughUsdc && usdcBalance !== undefined && displayCostUsdc > 0n && (
              <p className="text-sm text-destructive text-center">Insufficient USDC balance</p>
            )}
            {amountNum > 0 && tokenAmountWei > offeredWei && offeredNum > 0 && (
              <p className="text-sm text-destructive text-center">Amount exceeds tokens offered for sale ({offeredNum.toFixed(2)})</p>
            )}
          </form>
        )
        )}
      </CardContent>
    </Card>
  )
}
