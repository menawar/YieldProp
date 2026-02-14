import { Navigation } from '@/components/navigation'
import { YieldMetrics } from '@/components/yield-metrics'
import { YieldChart } from '@/components/yield-chart'
import { DistributionSchedule } from '@/components/distribution-schedule'
import { YieldHistoryTable } from '@/components/yield-history-table'

/**
 * Task 16: Yield Dashboard Page
 * Requirements: 9.3
 * - Distribution history chart
 * - Annualized yield percentage
 * - Next distribution date / pool status
 * - Per-token yield metrics
 */
export default function YieldsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Yield Dashboard
          </h1>
          <p className="mt-2 text-muted-foreground">
            Track rental income distributions and yield performance over time
          </p>
        </div>

        <div className="space-y-6">
          <YieldMetrics />
          <YieldChart />
          <div className="grid gap-6 lg:grid-cols-2">
            <DistributionSchedule />
            <YieldHistoryTable />
          </div>
        </div>
      </main>
    </div>
  )
}
