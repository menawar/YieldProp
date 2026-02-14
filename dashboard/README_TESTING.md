# Dashboard Testing Guide

This guide covers testing for the YieldProp MVP dashboard components.

## Test Setup

The dashboard uses Vitest for unit testing with React Testing Library.

### Dependencies

All testing dependencies are included in `package.json`:

```json
{
  "@testing-library/jest-dom": "^6.6.3",
  "@testing-library/react": "^16.1.0",
  "@testing-library/user-event": "^14.5.2",
  "@vitejs/plugin-react": "^4.3.4",
  "@vitest/ui": "^3.0.0",
  "jsdom": "^26.0.0",
  "vitest": "^3.0.0"
}
```

### Installation

```bash
cd dashboard
npm install
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm test -- --watch
```

### Run tests with UI
```bash
npm run test:ui
```

### Run tests with coverage
```bash
npm run test:coverage
```

## Test Structure

```
dashboard/
├── __tests__/
│   └── components/
│       ├── PropertyCard.test.tsx
│       ├── RecommendationCard.test.tsx
│       └── RecommendationHistory.test.tsx
├── vitest.config.ts
└── vitest.setup.ts
```

## Test Coverage

### PropertyCard Component

Tests cover:
- ✅ Rendering with property data
- ✅ Loading state display
- ✅ Error state handling
- ✅ Currency formatting
- ✅ Contract address display
- ✅ Zero valuation handling
- ✅ Different property types
- ✅ Icon rendering

### RecommendationCard Component

Tests cover:
- ✅ Rendering recommendation data
- ✅ Accept/reject button visibility based on role
- ✅ Button click handling
- ✅ Transaction state management
- ✅ Loading states
- ✅ Empty state (no recommendations)
- ✅ Status badges (accepted/rejected/pending)
- ✅ Wallet connection prompts
- ✅ Button disabling during transactions

### RecommendationHistory Component

Tests cover:
- ✅ Rendering history table
- ✅ Price formatting
- ✅ Confidence score display
- ✅ Status badges
- ✅ Loading state
- ✅ Empty state
- ✅ Long text truncation
- ✅ Date formatting
- ✅ Table headers
- ✅ Confidence bars
- ✅ Single recommendation handling

## Writing New Tests

### Example Test Structure

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { YourComponent } from '@/components/your-component'
import { useReadContract } from 'wagmi'

// Mock wagmi
vi.mock('wagmi', () => ({
  useReadContract: vi.fn(),
}))

describe('YourComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render correctly', async () => {
    vi.mocked(useReadContract).mockReturnValue({
      data: mockData,
      isLoading: false,
    } as any)

    render(<YourComponent />)

    await waitFor(() => {
      expect(screen.getByText('Expected Text')).toBeInTheDocument()
    })
  })
})
```

### Best Practices

1. **Mock External Dependencies**: Always mock wagmi hooks and external APIs
2. **Test User Interactions**: Use `fireEvent` or `userEvent` for interactions
3. **Wait for Async Updates**: Use `waitFor` for async state changes
4. **Test Edge Cases**: Include tests for loading, error, and empty states
5. **Clear Mocks**: Always clear mocks in `beforeEach`
6. **Descriptive Test Names**: Use clear, descriptive test names

## Mocking Wagmi Hooks

### useReadContract

```typescript
vi.mocked(useReadContract).mockReturnValue({
  data: yourMockData,
  isLoading: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
} as any)
```

### useWriteContract

```typescript
vi.mocked(useWriteContract).mockReturnValue({
  writeContract: vi.fn(),
  data: undefined,
  isPending: false,
  error: null,
} as any)
```

### useAccount

```typescript
vi.mocked(useAccount).mockReturnValue({
  address: '0x1234...',
  isConnected: true,
} as any)
```

## Common Issues

### Issue: "Cannot find module '@/components/...'"

**Solution**: Check that `vitest.config.ts` has the correct path alias:

```typescript
resolve: {
  alias: {
    '@': path.resolve(__dirname, './'),
  },
}
```

### Issue: "ReferenceError: vi is not defined"

**Solution**: Add `globals: true` to `vitest.config.ts`:

```typescript
test: {
  globals: true,
  // ...
}
```

### Issue: Tests fail with "document is not defined"

**Solution**: Ensure `environment: 'jsdom'` is set in `vitest.config.ts`:

```typescript
test: {
  environment: 'jsdom',
  // ...
}
```

## Continuous Integration

To run tests in CI:

```bash
# Install dependencies
npm ci

# Run tests
npm test -- --run

# Generate coverage report
npm run test:coverage
```

## Coverage Goals

Target coverage metrics:
- Statements: > 80%
- Branches: > 75%
- Functions: > 80%
- Lines: > 80%

## Next Steps

1. Add integration tests for complete user flows
2. Add E2E tests with Playwright or Cypress
3. Add visual regression tests
4. Set up CI/CD pipeline with automated testing

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Wagmi Testing Guide](https://wagmi.sh/react/guides/testing)
