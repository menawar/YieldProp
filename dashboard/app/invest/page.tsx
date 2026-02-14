import { Navigation } from '@/components/navigation'
import { InvestCard } from '@/components/invest-card'
import { PropertyCard } from '@/components/property-card'

/**
 * Invest Page - New investors purchase fractional property tokens with USDC
 * Requires: whitelist, USDC approval
 */
export default function InvestPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold tracking-tight">Invest in Property</h1>
          <p className="mt-2 text-muted-foreground">
            Purchase fractional ownership tokens with USDC and earn rental yields
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <InvestCard />
          </div>
          <div>
            <PropertyCard />
          </div>
        </div>
      </main>
    </div>
  )
}
