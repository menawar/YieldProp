import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RecommendationHistory } from '@/components/recommendation-history'
import { useReadContract } from 'wagmi'

describe('RecommendationHistory', () => {
  const mockHistory = [
    {
      id: BigInt(1),
      recommendedPrice: BigInt(2000000000),
      confidenceScore: BigInt(80),
      reasoning: 'Initial analysis',
      timestamp: BigInt(1704067200),
      accepted: true,
      rejected: false,
      submitter: '0x1234' as `0x${string}`,
    },
    {
      id: BigInt(2),
      recommendedPrice: BigInt(2200000000),
      confidenceScore: BigInt(85),
      reasoning: 'Market demand',
      timestamp: BigInt(1706745600),
      accepted: false,
      rejected: false,
      submitter: '0x1234' as `0x${string}`,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render history table', async () => {
    vi.mocked(useReadContract).mockReturnValue({ data: mockHistory, isLoading: false } as any)

    render(<RecommendationHistory />)

    await waitFor(() => {
      expect(screen.getByText('Recommendation History')).toBeInTheDocument()
      expect(screen.getByText('#1')).toBeInTheDocument()
      expect(screen.getByText('#2')).toBeInTheDocument()
    })
  })

  it('should display prices correctly', async () => {
    vi.mocked(useReadContract).mockReturnValue({ data: mockHistory, isLoading: false } as any)

    render(<RecommendationHistory />)

    await waitFor(() => {
      expect(screen.getByText('$2,000.00')).toBeInTheDocument()
      expect(screen.getByText('$2,200.00')).toBeInTheDocument()
    })
  })

  it('should show empty state', () => {
    vi.mocked(useReadContract).mockReturnValue({ data: [], isLoading: false } as any)

    render(<RecommendationHistory />)

    expect(screen.getByText('No history yet')).toBeInTheDocument()
  })

  it('should show loading state', () => {
    vi.mocked(useReadContract).mockReturnValue({ data: undefined, isLoading: true } as any)

    render(<RecommendationHistory />)

    expect(screen.getByText('Recommendation History')).toBeInTheDocument()
  })
})
