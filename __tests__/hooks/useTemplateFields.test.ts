import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ order: () => ({ data: [], error: null }) }) }),
      upsert: () => ({ select: () => ({ single: () => ({ data: null, error: null }) }) }),
      delete: () => ({ eq: () => ({ error: null }) }),
    }),
  }),
}))

const { useTemplateFields, useUpsertTemplateField, useDeleteTemplateField } = await import('@/hooks/use-template-fields')

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, {
    client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  }, children)
}

describe('useTemplateFields', () => {
  it('returns data, isLoading, error', () => {
    const { result } = renderHook(() => useTemplateFields('t1'), { wrapper })
    expect(result.current).toHaveProperty('data')
  })

  it('useUpsertTemplateField is a mutation', () => {
    const { result } = renderHook(() => useUpsertTemplateField('t1'), { wrapper })
    expect(result.current).toHaveProperty('mutate')
  })

  it('useDeleteTemplateField is a mutation', () => {
    const { result } = renderHook(() => useDeleteTemplateField('t1'), { wrapper })
    expect(result.current).toHaveProperty('mutate')
  })
})
