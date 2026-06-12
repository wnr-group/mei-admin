// __tests__/components/products/variants/VariantFormDialog.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/services/product-variants', () => ({
  getProductVariants: vi.fn().mockResolvedValue([]),
  createVariant: vi.fn().mockResolvedValue({ id: '1' }),
  updateVariant: vi.fn().mockResolvedValue({ id: '1' }),
  deleteVariant: vi.fn(),
}))
vi.mock('@/services/product-colors', () => ({
  getProductColors: vi.fn().mockResolvedValue([]),
  createColor: vi.fn(),
  updateColor: vi.fn(),
  deleteColor: vi.fn(),
}))

const { default: VariantFormDialog } = await import('@/components/products/variants/VariantFormDialog')

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, {
    client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  }, children)
}

describe('VariantFormDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<VariantFormDialog productId="p1" open={false} onClose={() => {}} />, { wrapper })
    expect(container.firstChild).toBeNull()
  })

  it('shows customization type select when open', () => {
    render(<VariantFormDialog productId="p1" open={true} onClose={() => {}} />, { wrapper })
    expect(screen.getByLabelText('Customization Type')).toBeInTheDocument()
  })

  it('shows size label input when open', () => {
    render(<VariantFormDialog productId="p1" open={true} onClose={() => {}} />, { wrapper })
    expect(screen.getByLabelText('Size Label')).toBeInTheDocument()
  })

  it('calls onClose when Cancel clicked', () => {
    const onClose = vi.fn()
    render(<VariantFormDialog productId="p1" open={true} onClose={onClose} />, { wrapper })
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })
})
