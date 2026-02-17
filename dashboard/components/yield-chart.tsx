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
        <CardTitle className="flex items-center gap-2 font-serif text-2xl font-normal text-foreground">
          Cumulative Yield Distribution
        </CardTitle>
        <CardDescription className="uppercase tracking-widest text-xs font-semibold text-muted-foreground">
          Historical Performance
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : chartData.length === 0 ? (
          <div className="flex h-72 items-center justify-center text-muted-foreground font-serif italic">
            No yield data available yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fillYield" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(var(--chart-2))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(var(--chart-2))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(var(--muted))" />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: 'oklch(var(--muted-foreground))' }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: 'oklch(var(--muted-foreground))' }}
                tickFormatter={(v) => `$${v}`}
                dx={-10}
              />
              <Tooltip
                formatter={(value: number | undefined) =>
                  value != null ? [`$${value.toFixed(2)}`, 'Yield Paid'] : []
                }
                contentStyle={{
                  backgroundColor: 'oklch(var(--popover))',
                  border: '1px solid oklch(var(--border))',
                  borderRadius: '0px', // Sharp corners for institutional feel
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  fontFamily: 'var(--font-sans)',
                }}
                labelStyle={{ color: 'oklch(var(--muted-foreground))', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '1px' }}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="oklch(var(--chart-2))"
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
