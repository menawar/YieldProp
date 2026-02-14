import { Navigation } from '@/components/navigation'
import { PropertyCard } from '@/components/property-card'
import { RentalPriceCard } from '@/components/rental-price-card'
import { TokenSupplyCard } from '@/components/token-supply-card'
import { TotalYieldsCard } from '@/components/total-yields-card'
import { LatestRecommendationPreview } from '@/components/latest-recommendation-preview'

/**
 * Task 14: Property Overview Page
 * Requirements: 9.1
 * - Property details (address, type, valuation)
 * - Current rental price
 * - Token supply and distribution
 * - Total yields distributed
 */
export default function OverviewPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Property Overview
          </h1>
          <p className="mt-2 text-muted-foreground">
            Monitor your tokenized real estate property and AI-powered yield optimization
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: Main property card */}
          <div className="lg:col-span-2">
            <PropertyCard />
          </div>

          {/* Right: Summary cards */}
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-1">
              <RentalPriceCard />
              <TokenSupplyCard />
            </div>
            <TotalYieldsCard />
            <LatestRecommendationPreview />
          </div>
        </div>
      </main>
    </div>
  )
}
