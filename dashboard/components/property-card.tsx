'use client'

import { useReadContract } from 'wagmi'
import { usePropertyContracts } from '@/lib/property-context'
import { ABIS, formatValuation } from '@/lib/contracts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Building2, MapPin, Home } from 'lucide-react'

/**
 * Task 14.1: PropertyCard - displays property details from PropertyToken
 * Requirements: 9.1
 */
export function PropertyCard() {
  const contracts = usePropertyContracts()
  const { data: metadata, isLoading, isError } = useReadContract({
    address: contracts.PropertyToken,
    abi: ABIS.PropertyToken,
    functionName: 'getPropertyDetails',
  })

  if (isError) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="py-8 text-center text-muted-foreground">
          Failed to load property data. Check your network connection.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 font-serif text-lg">
              <Building2 className="h-5 w-5 text-primary" />
              Property Details
            </CardTitle>
            {isLoading ? (
              <Skeleton className="mt-1 h-4 w-56" />
            ) : (
              <CardDescription className="mt-1 flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" />
                {metadata?.[0] ?? '—'}
              </CardDescription>
            )}
          </div>
          <div className="rounded-xl bg-primary/10 p-3">
            <Home className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Property Type
            </p>
            {isLoading ? (
              <Skeleton className="mt-1 h-7 w-24" />
            ) : (
              <p className="mt-1 font-semibold">{metadata?.[1] ?? '—'}</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Valuation
            </p>
            {isLoading ? (
              <Skeleton className="mt-1 h-7 w-28" />
            ) : (
              <p className="mt-1 font-semibold">{formatValuation(metadata?.[2])}</p>
            )}
          </div>
        </div>
        <div className="rounded-lg border bg-muted/30 px-4 py-2">
          <p className="text-xs text-muted-foreground">Token Contract</p>
          <p className="truncate font-mono text-xs">{contracts.PropertyToken}</p>
        </div>
      </CardContent>
    </Card>
  )
}
