import { Navigation } from '@/components/navigation'
import { RecommendationCard } from '@/components/recommendation-card'
import { RecommendationHistory } from '@/components/recommendation-history'

/**
 * Task 15: AI Recommendations Page
 * Requirements: 9.2, 9.5
 * - Latest price recommendation with reasoning
 * - Confidence score
 * - Accept/Reject (property manager only)
 * - Historical recommendations table
 */
export default function RecommendationsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            AI Price Recommendations
          </h1>
          <p className="mt-2 text-muted-foreground">
            Review and manage AI-powered rental price recommendations
          </p>
        </div>

        <div className="space-y-6">
          <RecommendationCard />
          <RecommendationHistory />
        </div>
      </main>
    </div>
  )
}
