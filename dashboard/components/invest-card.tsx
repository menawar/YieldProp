'use client'

/**
 * Invest Card - Purchase property tokens with USDC
 * Uses PropertySale.invest(tokenAmount) - requires whitelist and USDC approval
 */

import { useState, useEffect } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { usePropertyContracts } from '@/lib/property-context'
import { ABIS, formatUsdc } from '@/lib/contracts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DollarSign } from 'lucide-react'
import { toast } from 'sonner'
import { getBlockExplorerTxUrl, getErrorMessage } from '@/lib/utils'
import { useInvalidateOnTxConfirm } from '@/lib/use-invalidate-on-tx-confirm'

const TOKEN_DECIMALS = 18
const USDC_DECIMALS = 6

export function InvestCard() {
  const { address, isConnected } = useAccount()
  const queryClient = useQueryClient()
  const contracts = usePropertyContracts()
  const [tokenAmount, setTokenAmount] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const { data: saleActive } = useReadContract({
    address: contracts.PropertySale,
    abi: ABIS.PropertySale,
    functionName: 'saleActive',
  })

  const { data: tokensOfferedForSale } = useReadContract({
    address: contracts.PropertySale,
    abi: ABIS.PropertySale,
    functionName: 'tokensOfferedForSale',
  })

  const { data: pricePerToken } = useReadContract({
    address: contracts.PropertySale,
    abi: ABIS.PropertySale,
    functionName: 'pricePerToken',
  })

  const { data: isWhitelisted } = useReadContract({
    address: contracts.PropertyToken,
    abi: ABIS.PropertyToken,
    functionName: 'isWhitelisted',
    args: address ? [address] : undefined,
  })

  const tokenAmountWei = tokenAmount
    ? BigInt(Math.floor(parseFloat(tokenAmount) * 10 ** TOKEN_DECIMALS))
    : 0n

  // pricePerToken from PropertySale is in USDC (6 decimals). Cost = (tokenAmount * pricePerToken) / 1e18.
  const displayCostUsdc =
    tokenAmountWei > 0n && pricePerToken !== undefined && pricePerToken > 0n
      ? (tokenAmountWei * pricePerToken) / 10n ** 18n
      : 0n

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
    args: address ? [address, contracts.PropertySale] : undefined,
  })

  const needsApproval =
    displayCostUsdc > 0n && allowance !== undefined && allowance < displayCostUsdc

  const {
    writeContract: invest,
    data: investHash,
    isPending: isInvestPending,
  } = useWriteContract()

  const {
    writeContract: approve,
    data: approveHash,
    isPending: isApprovePending,
  } = useWriteContract()

  const { isLoading: isInvestTxPending, isSuccess: isInvestSuccess } = useWaitForTransactionReceipt({ hash: investHash })
  const { isLoading: isApproveTxPending, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({ hash: approveHash })

  useInvalidateOnTxConfirm(investHash, isInvestSuccess)
  useInvalidateOnTxConfirm(approveHash, isApproveSuccess)

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
          setTokenAmount('')
        },
        onError: (e) => toast.error(getErrorMessage(e)),
      }
    )
  }

  const amountNum = parseFloat(tokenAmount)
  const offeredWei = tokensOfferedForSale ?? 0n
  const offeredNum = Number(offeredWei) / 10 ** TOKEN_DECIMALS
  const isValidAmount =
    !isNaN(amountNum) &&
    amountNum > 0 &&
    amountNum <= 100 &&
    tokenAmountWei <= offeredWei
  const hasEnoughUsdc =
    displayCostUsdc > 0n && usdcBalance !== undefined && usdcBalance >= displayCostUsdc
  const canInvest =
    isConnected &&
    saleActive &&
    isWhitelisted &&
    isValidAmount &&
    hasEnoughUsdc &&
    !needsApproval &&
    !isInvestPending &&
    !isInvestTxPending

  const isLoading = isInvestPending || isInvestTxPending || isApprovePending || isApproveTxPending

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
          <p className="text-muted-foreground text-sm">
            PropertySale not deployed. Run{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">npm run deploy:property-sale</code>
            {' '}then{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">npm run sync:addresses</code>
            {' '}and restart the dashboard.
          </p>
        ) : !saleActive ? (
          <p className="text-muted-foreground text-sm">The token sale is not active. Contact the property manager.</p>
        ) : !isWhitelisted ? (
          <p className="text-muted-foreground text-sm">
            You must be whitelisted to invest. Contact the property manager to add your address.
          </p>
        ) : (offeredNum <= 0 ? (
          <p className="text-muted-foreground text-sm">
            No tokens are currently offered for sale. The property manager must set the offering amount.
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Token amount (1 token = 1% ownership)</label>
              <input
                type="number"
                min="0.01"
                max="100"
                step="0.1"
                placeholder="e.g. 5"
                value={tokenAmount}
                onChange={(e) => setTokenAmount(e.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            {displayCostUsdc > 0n && (
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2">
                <span className="text-sm text-muted-foreground">Cost</span>
                <span className="font-semibold">{formatUsdc(displayCostUsdc)} USDC</span>
              </div>
            )}
            {usdcBalance !== undefined && (
              <p className="text-xs text-muted-foreground">Your USDC balance: {formatUsdc(usdcBalance)}</p>
            )}
            {offeredNum > 0 && (
              <p className="text-xs text-muted-foreground">
                Available for sale: {offeredNum.toFixed(2)} tokens
              </p>
            )}
            {pricePerToken !== undefined && pricePerToken > 0n && (
              <p className="text-xs text-muted-foreground">
                Price per token: {formatUsdc(pricePerToken)} USDC
              </p>
            )}
            <div className="flex gap-2">
              {needsApproval ? (
                <Button
                  onClick={handleApprove}
                  disabled={
                    !isValidAmount ||
                    !displayCostUsdc ||
                    displayCostUsdc <= 0n ||
                    isApprovePending ||
                    isApproveTxPending ||
                    !hasEnoughUsdc
                  }
                >
                  {isApprovePending || isApproveTxPending ? 'Approving…' : 'Approve USDC'}
                </Button>
              ) : (
                <Button onClick={handleInvest} disabled={!canInvest || isLoading}>
                  {isInvestPending || isInvestTxPending ? 'Purchasing…' : 'Purchase Tokens'}
                </Button>
              )}
            </div>
            {isValidAmount && !hasEnoughUsdc && usdcBalance !== undefined && displayCostUsdc > 0n && (
              <p className="text-sm text-destructive">Insufficient USDC balance</p>
            )}
            {amountNum > 0 && tokenAmountWei > offeredWei && offeredNum > 0 && (
              <p className="text-sm text-destructive">Amount exceeds tokens offered for sale ({offeredNum.toFixed(2)})</p>
            )}
          </div>
        )
        )}
      </CardContent>
    </Card>
  )
}
