'use client'

import { useReadContract } from 'wagmi'
import { usePropertyContracts } from '@/lib/property-context'
import { ABIS, formatUsdc } from '@/lib/contracts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { TrendingUp } from 'lucide-react'

/**
 * Task 16.1: YieldChart - distribution history using Recharts
 * Requirements: 9.3
 */
export function YieldChart() {
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

  const chartData = distributions
    .map((d) => ({
      date: new Date(Number(d.timestamp) * 1000).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: '2-digit',
      }),
      amount: Number(d.totalAmount) / 1e6,
      full: formatUsdc(d.totalAmount),
    }))
    .reverse()

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
          <TrendingUp className="h-5 w-5" />
          Distribution History
        </CardTitle>
        <CardDescription>Rental yield distributions over time</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : chartData.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            No distributions yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fillYield" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(var(--chart-1))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="oklch(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                formatter={(value: number | undefined) =>
                  value != null ? [`$${value.toFixed(2)}`, 'Amount'] : []
                }
                contentStyle={{ borderRadius: '8px' }}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="oklch(var(--chart-1))"
                strokeWidth={2}
                fill="url(#fillYield)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
