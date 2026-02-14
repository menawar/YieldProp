import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PropertyCard } from '@/components/property-card'
import { useReadContract } from 'wagmi'

describe('PropertyCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render with property data', async () => {
    vi.mocked(useReadContract).mockReturnValue({
      data: [
        '123 Main St, San Francisco, CA',
        'Single Family',
        BigInt(500000) * BigInt(1e18),
        BigInt(100),
      ],
      isLoading: false,
      isError: false,
      error: null,
    } as any)

    render(<PropertyCard />)

    await waitFor(() => {
      expect(screen.getByText('Property Details')).toBeInTheDocument()
      expect(screen.getByText('123 Main St, San Francisco, CA')).toBeInTheDocument()
      expect(screen.getByText('Single Family')).toBeInTheDocument()
      expect(screen.getByText('$500,000')).toBeInTheDocument()
    })
  })

  it('should show loading state', () => {
    vi.mocked(useReadContract).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as any)

    render(<PropertyCard />)

    expect(screen.getByText('Property Details')).toBeInTheDocument()
  })

  it('should show error state', () => {
    vi.mocked(useReadContract).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Failed'),
    } as any)

    render(<PropertyCard />)

    expect(screen.getByText(/Failed to load property data/)).toBeInTheDocument()
  })

  it('should display Token Contract section', () => {
    vi.mocked(useReadContract).mockReturnValue({
      data: ['123 Main St', 'Single Family', BigInt(500000) * BigInt(1e18), BigInt(100)],
      isLoading: false,
      isError: false,
      error: null,
    } as any)

    render(<PropertyCard />)

    expect(screen.getByText('Token Contract')).toBeInTheDocument()
  })
})
