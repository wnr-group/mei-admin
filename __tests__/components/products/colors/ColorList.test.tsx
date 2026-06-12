import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/services/product-colors', () => ({
  getProductColors: vi.fn(),
  createColor: vi.fn(),
  updateColor: vi.fn(),
  deleteColor: vi.fn(),
}))

const { getProductColors } = await import('@/services/product-colors')
const { default: ColorList } = await import('@/components/products/colors/ColorList')

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, {
    client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  }, children)
}

describe('ColorList', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows empty state when no colors', async () => {
    vi.mocked(getProductColors).mockResolvedValue([])
    render(<ColorList productId="p1" />, { wrapper })
    expect(await screen.findByText(/no colors/i)).toBeInTheDocument()
  })

  it('shows Add Color button', () => {
    vi.mocked(getProductColors).mockResolvedValue([])
    render(<ColorList productId="p1" />, { wrapper })
    expect(screen.getByText('Add Color')).toBeInTheDocument()
  })

  it('renders color cards when data exists', async () => {
    vi.mocked(getProductColors).mockResolvedValue([
      { id: '1', product_id: 'p1', label: 'Ivory White', hex_code: '#FFFFF0', sort_order: 0, created_at: '' },
    ])
    render(<ColorList productId="p1" />, { wrapper })
    expect(await screen.findByText('Ivory White')).toBeInTheDocument()
  })
})
