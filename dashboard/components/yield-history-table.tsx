'use client'

import { useReadContract } from 'wagmi'
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

/**
 * Task 16.1: Yield distribution history table
 * Requirements: 9.3, 8.1
 */
export function YieldHistoryTable() {
  const contracts = usePropertyContracts()
  const { data: history, isLoading, isError } = useReadContract({
    address: contracts.YieldDistributor,
    abi: ABIS.YieldDistributor,
    functionName: 'getDistributionHistory',
  })

  const distributions = (history ?? []) as Array<{
    id: bigint
    totalAmount: bigint
    amountPerToken: bigint
    timestamp: bigint
    recipientCount: bigint
  }>

  if (isError) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Failed to load distribution history.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif">
          <History className="h-5 w-5" />
          Distribution Log
        </CardTitle>
        <CardDescription>Per-token yield metrics and timestamps</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : distributions.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">No distributions yet</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Per Token</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...distributions].reverse().map((d) => (
                  <TableRow key={d.id.toString()}>
                    <TableCell className="font-mono">#{d.id.toString()}</TableCell>
                    <TableCell className="font-medium">{formatUsdc(d.totalAmount)}</TableCell>
                    <TableCell>{formatUsdc(d.amountPerToken)}</TableCell>
                    <TableCell>{d.recipientCount.toString()}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {d.timestamp > 0n
                        ? new Date(Number(d.timestamp) * 1000).toLocaleString()
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
