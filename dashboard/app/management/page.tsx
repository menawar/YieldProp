'use client'

import { useState, useEffect } from 'react'
import { Navigation } from '@/components/navigation'
import { WhitelistManager } from '@/components/whitelist-manager'
import { HolderRegistration } from '@/components/holder-registration'
import { SaleOfferingCard } from '@/components/sale-offering-card'
import { RentalPaymentForm } from '@/components/rental-payment-form'
import { Card, CardContent } from '@/components/ui/card'
import { useAccount, useReadContract } from 'wagmi'
import { usePropertyContracts } from '@/lib/property-context'
import { ABIS } from '@/lib/contracts'
import { Shield } from 'lucide-react'

/**
 * Management page - Property Manager and Payment Processor functions
 */
export default function ManagementPage() {
  const { address, isConnected } = useAccount()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const contracts = usePropertyContracts()

  const { data: ptManagerRole } = useReadContract({
    address: contracts.PropertyToken,
    abi: ABIS.PropertyToken,
    functionName: 'PROPERTY_MANAGER_ROLE',
  })
  const { data: ydManagerRole } = useReadContract({
    address: contracts.YieldDistributor,
    abi: ABIS.YieldDistributor,
    functionName: 'PROPERTY_MANAGER_ROLE',
  })
  const { data: paymentProcessorRole } = useReadContract({
    address: contracts.YieldDistributor,
    abi: ABIS.YieldDistributor,
    functionName: 'PAYMENT_PROCESSOR_ROLE',
  })

  const { data: isPTManager } = useReadContract({
    address: contracts.PropertyToken,
    abi: ABIS.PropertyToken,
    functionName: 'hasRole',
    args: address && ptManagerRole ? [ptManagerRole, address] : undefined,
  })
  const { data: isYDManager } = useReadContract({
    address: contracts.YieldDistributor,
    abi: ABIS.YieldDistributor,
    functionName: 'hasRole',
    args: address && ydManagerRole ? [ydManagerRole, address] : undefined,
  })
  const { data: isPaymentProcessor } = useReadContract({
    address: contracts.YieldDistributor,
    abi: ABIS.YieldDistributor,
    functionName: 'hasRole',
    args: address && paymentProcessorRole ? [paymentProcessorRole, address] : undefined,
  })

  const hasAccess = isPTManager || isYDManager || isPaymentProcessor

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold tracking-tight">Property Management</h1>
          <p className="mt-2 text-muted-foreground">
            Whitelist management, holder registration, and rental payment submission.
          </p>
        </div>

        {mounted && isConnected && !hasAccess && (
          <Card className="mb-6 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Shield className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-center text-sm text-muted-foreground">
                Connect with a Property Manager or Payment Processor wallet to access management tools.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <WhitelistManager />
          <HolderRegistration />
          <SaleOfferingCard />
          <div className="lg:col-span-2">
            <RentalPaymentForm />
          </div>
        </div>
      </main>
    </div>
  )
}
