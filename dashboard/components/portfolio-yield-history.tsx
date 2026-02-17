'use client'

import { useAccount, useReadContract } from 'wagmi'
import { usePropertyContracts } from '@/lib/property-context'
import { ABIS, formatUsdc } from '@/lib/contracts'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { History } from 'lucide-react'

const TOKEN_DECIMALS = 18

/**
 * Task 17.1: Portfolio yield history - distributions user participated in
 * Shows distribution log; user received (balance/totalSupply) * totalAmount per distribution
 * Requirements: 9.4
 */
export function PortfolioYieldHistory() {
  const { address, isConnected } = useAccount()
  const contracts = usePropertyContracts()

  const { data: history } = useReadContract({
    address: contracts.YieldDistributor,
    abi: ABIS.YieldDistributor,
    functionName: 'getDistributionHistory',
  })

  const { data: totalSupplyRaw } = useReadContract({
    address: contracts.PropertyToken,
    abi: ABIS.PropertyToken,
    functionName: 'totalSupply',
  })
  const totalSupply = totalSupplyRaw as unknown as bigint | undefined

  const { data: currentBalanceRaw } = useReadContract({
    address: contracts.PropertyToken,
    abi: ABIS.PropertyToken,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  })
  const currentBalance = currentBalanceRaw as unknown as bigint | undefined

  if (!isConnected || !address) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif">
            <History className="h-5 w-5" />
            Yield History
          </CardTitle>
          <CardDescription>Connect wallet to view your yield history</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-muted-foreground">Connect your wallet</p>
        </CardContent>
      </Card>
    )
  }

  const distributions = (history ?? []) as Array<{
    id: bigint
    totalAmount: bigint
    amountPerToken: bigint
    timestamp: bigint
    recipientCount: bigint
  }>

  const hasHistory = distributions.length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif">
          <History className="h-5 w-5" />
          Yield History
        </CardTitle>
        <CardDescription>Distributions you participated in</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasHistory ? (
          <p className="py-8 text-center text-muted-foreground">No distributions yet</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Your Share (est.)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...distributions].reverse().map((d) => {
                  const estShare =
                    totalSupply && currentBalance && totalSupply > 0n
                      ? (d.totalAmount * currentBalance) / totalSupply
                      : 0n
                  return (
                    <TableRow key={d.id.toString()}>
                      <TableCell className="font-mono">#{d.id.toString()}</TableCell>
                      <TableCell>
                        {d.timestamp > 0n
                          ? new Date(Number(d.timestamp) * 1000).toLocaleDateString()
                          : '—'}
                      </TableCell>
                      <TableCell className="font-medium">{formatUsdc(estShare)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
