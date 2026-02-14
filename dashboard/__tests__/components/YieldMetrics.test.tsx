import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { YieldMetrics } from '@/components/yield-metrics'
import { useReadContract } from 'wagmi'

describe('YieldMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render all metric cards', async () => {
    vi.mocked(useReadContract).mockImplementation((config: any) => {
      if (config.functionName === 'getTotalYieldsDistributed') return { data: BigInt(4200000000), isLoading: false } as any
      if (config.functionName === 'getAnnualizedYield') return { data: BigInt(500), isLoading: false } as any
      if (config.functionName === 'getDistributionPool') return { data: BigInt(0), isLoading: false } as any
      return {} as any
    })

    render(<YieldMetrics />)

    await waitFor(() => {
      expect(screen.getByText('Annualized Yield')).toBeInTheDocument()
      expect(screen.getByText('Total Distributed')).toBeInTheDocument()
      expect(screen.getByText('Pending Pool')).toBeInTheDocument()
    })
  })

  it('should display total distributed correctly', async () => {
    vi.mocked(useReadContract).mockImplementation((config: any) => {
      if (config.functionName === 'getTotalYieldsDistributed') return { data: BigInt(4200000000), isLoading: false } as any
      if (config.functionName === 'getAnnualizedYield') return { data: BigInt(500), isLoading: false } as any
      if (config.functionName === 'getDistributionPool') return { data: BigInt(0), isLoading: false } as any
      return {} as any
    })

    render(<YieldMetrics />)

    await waitFor(() => {
      expect(screen.getByText('$4,200.00')).toBeInTheDocument()
    })
  })

  it('should display annualized yield', async () => {
    vi.mocked(useReadContract).mockImplementation((config: any) => {
      if (config.functionName === 'getTotalYieldsDistributed') return { data: BigInt(0), isLoading: false } as any
      if (config.functionName === 'getAnnualizedYield') return { data: BigInt(550), isLoading: false } as any
      if (config.functionName === 'getDistributionPool') return { data: BigInt(0), isLoading: false } as any
      return {} as any
    })

    render(<YieldMetrics />)

    await waitFor(() => {
      expect(screen.getByText('5.50%')).toBeInTheDocument()
    })
  })
})
