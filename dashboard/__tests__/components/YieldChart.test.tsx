import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { YieldChart } from '@/components/yield-chart'
import { useReadContract } from 'wagmi'

vi.mock('recharts', () => ({
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  CartesianGrid: () => null,
}))

describe('YieldChart', () => {
  const mockHistory = [
    { id: BigInt(1), totalAmount: BigInt(2000000000), amountPerToken: BigInt(2e16), timestamp: BigInt(1704067200), recipientCount: BigInt(10) },
    { id: BigInt(2), totalAmount: BigInt(2200000000), amountPerToken: BigInt(2.2e16), timestamp: BigInt(1706745600), recipientCount: BigInt(12) },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render chart with data', async () => {
    vi.mocked(useReadContract).mockReturnValue({ data: mockHistory, isLoading: false } as any)

    render(<YieldChart />)

    await waitFor(() => {
      expect(screen.getByText('Distribution History')).toBeInTheDocument()
      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    })
  })

  it('should show empty state', () => {
    vi.mocked(useReadContract).mockReturnValue({ data: [], isLoading: false } as any)

    render(<YieldChart />)

    expect(screen.getByText('No distributions yet')).toBeInTheDocument()
  })

  it('should show loading state', () => {
    vi.mocked(useReadContract).mockReturnValue({ data: undefined, isLoading: true } as any)

    render(<YieldChart />)

    expect(screen.getByText('Distribution History')).toBeInTheDocument()
  })
})
