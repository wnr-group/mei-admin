// __tests__/components/products/colors/ColorFormDialog.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/services/product-colors', () => ({
  createColor: vi.fn().mockResolvedValue({ id: '1', label: 'Red', product_id: 'p1', sort_order: 0, created_at: '' }),
  updateColor: vi.fn().mockResolvedValue({ id: '1', label: 'Red', product_id: 'p1', sort_order: 0, created_at: '' }),
  getProductColors: vi.fn().mockResolvedValue([]),
  deleteColor: vi.fn(),
}))

const { default: ColorFormDialog } = await import('@/components/products/colors/ColorFormDialog')

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, {
    client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  }, children)
}

describe('ColorFormDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <ColorFormDialog productId="p1" open={false} onClose={() => {}} />,
      { wrapper }
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows dialog with Label field when open', () => {
    render(
      <ColorFormDialog productId="p1" open={true} onClose={() => {}} />,
      { wrapper }
    )
    expect(screen.getByLabelText('Label')).toBeInTheDocument()
    expect(screen.getByLabelText('Hex Code')).toBeInTheDocument()
    expect(screen.getByLabelText('Swatch Image URL')).toBeInTheDocument()
  })

  it('calls onClose when Cancel clicked', () => {
    const onClose = vi.fn()
    render(
      <ColorFormDialog productId="p1" open={true} onClose={onClose} />,
      { wrapper }
    )
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows Edit Color title when initialColor provided', () => {
    render(
      <ColorFormDialog
        productId="p1"
        open={true}
        onClose={() => {}}
        initialColor={{ id: '1', label: 'Red', hex_code: '#ff0000', product_id: 'p1', sort_order: 0, created_at: '' }}
      />,
      { wrapper }
    )
    expect(screen.getByText('Edit Color')).toBeInTheDocument()
  })
})
