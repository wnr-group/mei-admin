import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/services/product-variants', () => ({
  getProductVariants: vi.fn(),
  createVariant: vi.fn(),
  updateVariant: vi.fn(),
  deleteVariant: vi.fn(),
  getEffectivePrice: vi.fn(),
}))

const { useProductVariants, useCreateVariant, useUpdateVariant, useDeleteVariant } = await import('@/hooks/use-product-variants')

function createWrapper() {
  const queryClient = new QueryClient()
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useProductVariants', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should have data property', () => {
    const { result } = renderHook(() => useProductVariants('test-product-id'), {
      wrapper: createWrapper(),
    })
    expect(result.current).toHaveProperty('data')
  })

  it('should have isLoading property', () => {
    const { result } = renderHook(() => useProductVariants('test-product-id'), {
      wrapper: createWrapper(),
    })
    expect(result.current).toHaveProperty('isLoading')
  })

  it('should have error property', () => {
    const { result } = renderHook(() => useProductVariants('test-product-id'), {
      wrapper: createWrapper(),
    })
    expect(result.current).toHaveProperty('error')
  })
})

describe('useCreateVariant', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should be a mutation hook', () => {
    const { result } = renderHook(() => useCreateVariant('test-product-id'), {
      wrapper: createWrapper(),
    })
    expect(result.current).toHaveProperty('mutate')
  })
})

describe('useUpdateVariant', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should be a mutation hook', () => {
    const { result } = renderHook(() => useUpdateVariant('test-product-id'), {
      wrapper: createWrapper(),
    })
    expect(result.current).toHaveProperty('mutate')
  })
})

describe('useDeleteVariant', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should be a mutation hook', () => {
    const { result } = renderHook(() => useDeleteVariant('test-product-id'), {
      wrapper: createWrapper(),
    })
    expect(result.current).toHaveProperty('mutate')
  })
})
