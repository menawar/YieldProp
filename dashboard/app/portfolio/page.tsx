import { Navigation } from '@/components/navigation'
import { PortfolioCard } from '@/components/portfolio-card'
import { PortfolioYieldHistory } from '@/components/portfolio-yield-history'
import { TokenTransferCard } from '@/components/token-transfer-card'

/**
 * Task 17: Token Holder Portfolio Page
 * - Connected wallet token balance, ownership %, yields
 * - Token transfer to whitelisted addresses
 */
export default function PortfolioPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold tracking-tight">My Portfolio</h1>
          <p className="mt-2 text-muted-foreground">
            Track your property token holdings and yield earnings
          </p>
        </div>

        <div className="space-y-6">
          <PortfolioCard />
          <TokenTransferCard />
          <PortfolioYieldHistory />
        </div>
      </main>
    </div>
  )
}
