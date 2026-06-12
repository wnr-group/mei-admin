import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    functions: { invoke: vi.fn().mockResolvedValue({ data: [], error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ order: () => ({ data: [], error: null }) }) }) }),
  }),
}))

const { useBulkCreateVariants } = await import('@/hooks/use-bulk-create-variants')

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, {
    client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  }, children)
}

describe('useBulkCreateVariants', () => {
  it('returns a mutation hook', () => {
    const { result } = renderHook(() => useBulkCreateVariants('p1'), { wrapper })
    expect(result.current).toHaveProperty('mutate')
    expect(result.current).toHaveProperty('isPending')
  })
})
