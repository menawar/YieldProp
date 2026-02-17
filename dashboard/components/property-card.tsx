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
    <Card className="shadow-sm border-none bg-card h-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 font-serif text-2xl font-normal text-foreground">
              <Building2 className="h-6 w-6 text-primary" />
              Property Details
            </CardTitle>
            {isLoading ? (
              <Skeleton className="mt-2 h-4 w-56" />
            ) : (
              <CardDescription className="mt-2 flex items-center gap-2 uppercase tracking-wide text-xs font-semibold">
                <MapPin className="h-3.5 w-3.5 text-accent-foreground" />
                {metadata?.[0] ?? '—'}
              </CardDescription>
            )}
          </div>
          <div className="rounded-full bg-secondary p-3">
            <Home className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-2">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Asset Class
            </p>
            {isLoading ? (
              <Skeleton className="mt-1 h-8 w-24" />
            ) : (
              <p className="mt-1 text-xl font-medium font-sans">{metadata?.[1] ?? '—'}</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Latest Valuation
            </p>
            {isLoading ? (
              <Skeleton className="mt-1 h-8 w-28" />
            ) : (
              <p className="mt-1 text-xl font-medium font-sans">{formatValuation(metadata?.[2])}</p>
            )}
          </div>
        </div>
        <div className="rounded-md bg-secondary/50 px-4 py-3 border border-border/50">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Contract Address</p>
            <p className="truncate font-mono text-xs text-primary">{contracts.PropertyToken}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
