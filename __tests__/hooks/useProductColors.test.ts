import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/services/product-colors', () => ({
  getProductColors: vi.fn(),
  createColor: vi.fn(),
  updateColor: vi.fn(),
  deleteColor: vi.fn(),
}))

const { useProductColors, useCreateColor, useUpdateColor, useDeleteColor } = await import('@/hooks/use-product-colors')

function createWrapper() {
  const queryClient = new QueryClient()
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  Wrapper.displayName = 'Wrapper'
  return Wrapper
}

describe('useProductColors', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should have data property', () => {
    const { result } = renderHook(() => useProductColors('test-product-id'), {
      wrapper: createWrapper(),
    })
    expect(result.current).toHaveProperty('data')
  })

  it('should have isLoading property', () => {
    const { result } = renderHook(() => useProductColors('test-product-id'), {
      wrapper: createWrapper(),
    })
    expect(result.current).toHaveProperty('isLoading')
  })

  it('should have error property', () => {
    const { result } = renderHook(() => useProductColors('test-product-id'), {
      wrapper: createWrapper(),
    })
    expect(result.current).toHaveProperty('error')
  })
})

describe('useCreateColor', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should be a mutation hook', () => {
    const { result } = renderHook(() => useCreateColor('test-product-id'), {
      wrapper: createWrapper(),
    })
    expect(result.current).toHaveProperty('mutate')
  })
})

describe('useUpdateColor', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should be a mutation hook', () => {
    const { result } = renderHook(() => useUpdateColor('test-product-id'), {
      wrapper: createWrapper(),
    })
    expect(result.current).toHaveProperty('mutate')
  })
})

describe('useDeleteColor', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should be a mutation hook', () => {
    const { result } = renderHook(() => useDeleteColor('test-product-id'), {
      wrapper: createWrapper(),
    })
    expect(result.current).toHaveProperty('mutate')
  })
})
