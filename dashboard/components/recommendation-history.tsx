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
import { Badge } from '@/components/ui/badge'
import { History } from 'lucide-react'

type Recommendation = {
  id: bigint
  recommendedPrice: bigint
  confidenceScore: bigint
  reasoning: string
  timestamp: bigint
  accepted: boolean
  rejected: boolean
  submitter: `0x${string}`
}

/**
 * Task 15.1: Historical recommendations table
 * Requirements: 9.2, 9.5
 */
export function RecommendationHistory() {
  const contracts = usePropertyContracts()
  // Use getRecentRecommendations (gas-safe, newest first) instead of getRecommendationHistory
  const { data: history, isLoading, isError } = useReadContract({
    address: contracts.PriceManager,
    abi: ABIS.PriceManager,
    functionName: 'getRecentRecommendations',
    args: [50n],
  })

  if (isError) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Failed to load recommendation history.
        </CardContent>
      </Card>
    )
  }

  const recommendations = (history ?? []) as Recommendation[]
  const hasHistory = recommendations.length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif">
          <History className="h-5 w-5" />
          Recommendation History
        </CardTitle>
        <CardDescription>All AI price recommendations</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !hasHistory ? (
          <p className="py-8 text-center text-muted-foreground">No history yet</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recommendations.map((rec) => (
                  <TableRow key={rec.id.toString()}>
                    <TableCell className="font-mono">#{rec.id.toString()}</TableCell>
                    <TableCell className="font-medium">
                      {formatUsdc(rec.recommendedPrice)}
                    </TableCell>
                    <TableCell>{Number(rec.confidenceScore)}%</TableCell>
                    <TableCell>
                      {rec.accepted && (
                        <Badge variant="default" className="bg-green-600">
                          Accepted
                        </Badge>
                      )}
                      {rec.rejected && <Badge variant="destructive">Rejected</Badge>}
                      {!rec.accepted && !rec.rejected && (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {rec.timestamp > 0n
                        ? new Date(Number(rec.timestamp) * 1000).toLocaleString()
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
