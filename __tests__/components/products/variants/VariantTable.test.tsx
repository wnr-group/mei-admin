import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/services/product-variants', () => ({
  getProductVariants: vi.fn(),
  createVariant: vi.fn(),
  updateVariant: vi.fn(),
  deleteVariant: vi.fn(),
}))
vi.mock('@/services/product-colors', () => ({
  getProductColors: vi.fn().mockResolvedValue([]),
  createColor: vi.fn(), updateColor: vi.fn(), deleteColor: vi.fn(),
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    functions: { invoke: vi.fn() },
    from: () => ({ select: () => ({ eq: () => ({ order: () => ({ data: [], error: null }) }) }) }),
  }),
}))

const { getProductVariants } = await import('@/services/product-variants')
const { default: VariantTable } = await import('@/components/products/variants/VariantTable')

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, {
    client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  }, children)
}

describe('VariantTable', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows empty state when no variants', async () => {
    vi.mocked(getProductVariants).mockResolvedValue([])
    render(<VariantTable productId="p1" />, { wrapper })
    expect(await screen.findByText(/no variants/i)).toBeInTheDocument()
  })

  it('shows Add Variant button', () => {
    vi.mocked(getProductVariants).mockResolvedValue([])
    render(<VariantTable productId="p1" />, { wrapper })
    expect(screen.getByText('Add Variant')).toBeInTheDocument()
  })

  it('renders variant row when data exists', async () => {
    vi.mocked(getProductVariants).mockResolvedValue([{
      id: 'v1', product_id: 'p1', customization_type: 'STANDARD_SIZE', sku: 'TEST-38-ST',
      stock_quantity: 10, track_inventory: false, allow_backorder: true,
      low_stock_threshold: 5, is_available: true, sort_order: 0, created_at: '', updated_at: '',
    }])
    render(<VariantTable productId="p1" />, { wrapper })
    expect(await screen.findByText('STANDARD_SIZE')).toBeInTheDocument()
  })
})
