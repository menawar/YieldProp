import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock wagmi - provide essentials so lib/wagmi loads
vi.mock('wagmi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('wagmi')>()
  return {
    ...actual,
    createConfig: vi.fn(() => ({})),
    useReadContract: vi.fn(() => ({ data: undefined, isLoading: false, isError: false })),
    useWriteContract: vi.fn(),
    useWaitForTransactionReceipt: vi.fn(),
    useAccount: vi.fn(() => ({ address: undefined, isConnected: false })),
    useWatchContractEvent: vi.fn(),
  }
})

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))
