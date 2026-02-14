import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RecommendationCard } from '@/components/recommendation-card'
import { useReadContract, useWriteContract, useAccount, useWaitForTransactionReceipt } from 'wagmi'

vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))

describe('RecommendationCard', () => {
  const mockRec = {
    id: BigInt(1),
    recommendedPrice: BigInt(2200000000),
    confidenceScore: BigInt(85),
    reasoning: 'Market analysis shows strong demand.',
    timestamp: BigInt(Math.floor(Date.now() / 1000)),
    accepted: false,
    rejected: false,
    submitter: '0x1234567890123456789012345678901234567890' as `0x${string}`,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAccount).mockReturnValue({ address: '0x1234', isConnected: true } as any)
    vi.mocked(useWriteContract).mockReturnValue({
      writeContract: vi.fn(),
      data: undefined,
      isPending: false,
      error: null,
    } as any)
    vi.mocked(useWaitForTransactionReceipt).mockReturnValue({ isLoading: false } as any)
  })

  it('should render recommendation correctly', async () => {
    vi.mocked(useReadContract).mockImplementation((config: any) => {
      if (config.functionName === 'getLatestRecommendation') return { data: mockRec, isLoading: false } as any
      if (config.functionName === 'PROPERTY_MANAGER_ROLE') return { data: '0x11' } as any
      if (config.functionName === 'hasRole') return { data: true } as any
      return {} as any
    })

    render(<RecommendationCard />)

    await waitFor(() => {
      expect(screen.getByText('Latest Price Recommendation')).toBeInTheDocument()
      expect(screen.getByText('$2,200.00')).toBeInTheDocument()
      expect(screen.getByText(/85/)).toBeInTheDocument()
      expect(screen.getByText(/Market analysis shows strong demand/)).toBeInTheDocument()
    })
  })

  it('should show Accept and Reject buttons for property manager', async () => {
    vi.mocked(useReadContract).mockImplementation((config: any) => {
      if (config.functionName === 'getLatestRecommendation') return { data: mockRec, isLoading: false } as any
      if (config.functionName === 'PROPERTY_MANAGER_ROLE') return { data: '0x11' } as any
      if (config.functionName === 'hasRole') return { data: true } as any
      return {} as any
    })

    render(<RecommendationCard />)

    await waitFor(() => {
      expect(screen.getByText('Accept')).toBeInTheDocument()
      expect(screen.getByText('Reject')).toBeInTheDocument()
    })
  })

  it('should not show buttons for non-manager', async () => {
    vi.mocked(useReadContract).mockImplementation((config: any) => {
      if (config.functionName === 'getLatestRecommendation') return { data: mockRec, isLoading: false } as any
      if (config.functionName === 'PROPERTY_MANAGER_ROLE') return { data: '0x11' } as any
      if (config.functionName === 'hasRole') return { data: false } as any
      return {} as any
    })

    render(<RecommendationCard />)

    await waitFor(() => {
      expect(screen.queryByText('Accept')).not.toBeInTheDocument()
      expect(screen.queryByText('Reject')).not.toBeInTheDocument()
    })
  })

  it('should show no recommendations message', () => {
    vi.mocked(useReadContract).mockImplementation((config: any) => {
      if (config.functionName === 'getLatestRecommendation') return { data: { ...mockRec, id: BigInt(0) }, isLoading: false } as any
      return {} as any
    })

    render(<RecommendationCard />)

    expect(screen.getByText(/No recommendations yet/)).toBeInTheDocument()
  })

  it('should show Accepted badge', async () => {
    vi.mocked(useReadContract).mockImplementation((config: any) => {
      if (config.functionName === 'getLatestRecommendation') return { data: { ...mockRec, accepted: true }, isLoading: false } as any
      if (config.functionName === 'PROPERTY_MANAGER_ROLE') return { data: '0x11' } as any
      if (config.functionName === 'hasRole') return { data: true } as any
      return {} as any
    })

    render(<RecommendationCard />)

    await waitFor(() => {
      expect(screen.getByText('Accepted')).toBeInTheDocument()
    })
  })
})








