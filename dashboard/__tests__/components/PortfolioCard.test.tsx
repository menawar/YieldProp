import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PortfolioCard } from '@/components/portfolio-card'
import { useAccount, useReadContract } from 'wagmi'

vi.mock('@/components/connect-button', () => ({
  ConnectButton: () => <button>Connect Wallet</button>,
}))

describe('PortfolioCard', () => {
  const mockAddress = '0x1234567890123456789012345678901234567890'
  const mockBalance = BigInt(50) * BigInt(10 ** 18)
  const mockOwnershipPct = BigInt(5000) // 50% in basis points
  const mockHolderYields = BigInt(1000000000) // $1,000 USDC

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should prompt wallet connection when not connected', () => {
    vi.mocked(useAccount).mockReturnValue({ address: undefined, isConnected: false } as any)

    render(<PortfolioCard />)

    expect(screen.getByText('Connect Your Wallet')).toBeInTheDocument()
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument()
  })

  it('should render portfolio stats when connected', async () => {
    vi.mocked(useAccount).mockReturnValue({ address: mockAddress, isConnected: true } as any)
    vi.mocked(useReadContract).mockImplementation((config: any) => {
      if (config.functionName === 'balanceOf') return { data: mockBalance, isLoading: false } as any
      if (config.functionName === 'getOwnershipPercentage') return { data: mockOwnershipPct, isLoading: false } as any
      if (config.functionName === 'getHolderYields') return { data: mockHolderYields, isLoading: false } as any
      return {} as any
    })

    render(<PortfolioCard />)

    await waitFor(() => {
      expect(screen.getByText('My Portfolio')).toBeInTheDocument()
      expect(screen.getByText('Token Balance')).toBeInTheDocument()
      expect(screen.getByText('Ownership')).toBeInTheDocument()
      expect(screen.getByText('Total Yields Earned')).toBeInTheDocument()
    })
  })

  it('should display ownership percentage correctly', async () => {
    vi.mocked(useAccount).mockReturnValue({ address: mockAddress, isConnected: true } as any)
    vi.mocked(useReadContract).mockImplementation((config: any) => {
      if (config.functionName === 'balanceOf') return { data: mockBalance, isLoading: false } as any
      if (config.functionName === 'getOwnershipPercentage') return { data: mockOwnershipPct, isLoading: false } as any
      if (config.functionName === 'getHolderYields') return { data: mockHolderYields, isLoading: false } as any
      return {} as any
    })

    render(<PortfolioCard />)

    await waitFor(() => {
      expect(screen.getByText('50.00%')).toBeInTheDocument()
    })
  })

  it('should format yields correctly', async () => {
    vi.mocked(useAccount).mockReturnValue({ address: mockAddress, isConnected: true } as any)
    vi.mocked(useReadContract).mockImplementation((config: any) => {
      if (config.functionName === 'balanceOf') return { data: mockBalance, isLoading: false } as any
      if (config.functionName === 'getOwnershipPercentage') return { data: mockOwnershipPct, isLoading: false } as any
      if (config.functionName === 'getHolderYields') return { data: mockHolderYields, isLoading: false } as any
      return {} as any
    })

    render(<PortfolioCard />)

    await waitFor(() => {
      expect(screen.getByText('$1,000.00')).toBeInTheDocument()
    })
  })
})
