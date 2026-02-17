import { Navigation } from '@/components/navigation'
import { PropertyCard } from '@/components/property-card'
import { RentalPriceCard } from '@/components/rental-price-card'
import { TokenSupplyCard } from '@/components/token-supply-card'
import { TotalYieldsCard } from '@/components/total-yields-card'
import { LatestRecommendationPreview } from '@/components/latest-recommendation-preview'
import { YieldChart } from '@/components/yield-chart'

/**
 * Task 14: Property Overview Page
 * Requirements: 9.1
 * - Institutional Layout: Grid Optimized
 */
export default function OverviewPage() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <Navigation />
      <main className="mx-auto max-w-[1600px] px-6 py-10">
        <div className="mb-10 flex items-end justify-between border-b border-border pb-6">
          <div>
            <h1 className="font-serif text-4xl font-medium tracking-tight text-foreground">
              Portfolio Overview
            </h1>
          </div>
          <div className="text-right">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Last Updated</span>
            <p className="font-mono text-sm font-medium">{new Date().toLocaleDateString()}</p>
          </div>
        </div>

        {/* Top Row: Key Metrics & Property High Level */}
        <div className="grid gap-6 lg:grid-cols-4 mb-8">
          {/* Main Property Card - Hero */}
          <div className="lg:col-span-2">
            <PropertyCard />
          </div>

          {/* Quick Stats Column */}
          <div className="lg:col-span-2 grid grid-cols-2 gap-6">
            <RentalPriceCard />
            <TokenSupplyCard />
            <TotalYieldsCard />
            <LatestRecommendationPreview />
          </div>
        </div>

        {/* Second Row: Deep Dive & Charts */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <YieldChart />
          </div>
          <div className="lg:col-span-1">
            {/* Placeholder for future "Activity Feed" or "Notifications" */}
            <div className="rounded-lg border border-border bg-card p-6 h-full flex flex-col justify-center items-center text-center">
              <h3 className="font-serif text-lg mb-2">Recent Activity</h3>
              <p className="text-muted-foreground text-sm italic">Connect Tenderly wallet to view transaction history.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
