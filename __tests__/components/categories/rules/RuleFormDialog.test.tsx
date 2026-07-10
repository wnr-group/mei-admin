// __tests__/components/categories/rules/RuleFormDialog.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/services/category-rules', () => ({
  createCategoryRule: vi.fn().mockResolvedValue({ id: '1', category_id: 'c1', field: 'name', operator: 'contains', value: 'lehenga' }),
  updateCategoryRule: vi.fn().mockResolvedValue({ id: '1', category_id: 'c1', field: 'name', operator: 'contains', value: 'lehenga' }),
  getCategoryRules: vi.fn().mockResolvedValue([]),
  deleteCategoryRule: vi.fn(),
}))

const { default: RuleFormDialog } = await import('@/components/categories/rules/RuleFormDialog')

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, {
    client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  }, children)
}

describe('RuleFormDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <RuleFormDialog categoryId="c1" open={false} onClose={() => {}} />,
      { wrapper }
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows Field, Operator, and Value inputs when open', () => {
    render(<RuleFormDialog categoryId="c1" open={true} onClose={() => {}} />, { wrapper })
    expect(screen.getByLabelText('Field')).toBeInTheDocument()
    expect(screen.getByLabelText('Operator')).toBeInTheDocument()
    expect(screen.getByLabelText('Value')).toBeInTheDocument()
  })

  it('restricts operator options to those valid for the selected field', () => {
    render(<RuleFormDialog categoryId="c1" open={true} onClose={() => {}} />, { wrapper })
    fireEvent.change(screen.getByLabelText('Field'), { target: { value: 'price' } })
    const operatorSelect = screen.getByLabelText('Operator') as HTMLSelectElement
    const optionValues = Array.from(operatorSelect.options).map((o) => o.value)
    expect(optionValues).toEqual(['is', 'greater_than', 'less_than'])
  })

  it('calls onClose when Cancel clicked', () => {
    const onClose = vi.fn()
    render(<RuleFormDialog categoryId="c1" open={true} onClose={onClose} />, { wrapper })
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows Edit Condition title when initialRule provided', () => {
    render(
      <RuleFormDialog
        categoryId="c1"
        open={true}
        onClose={() => {}}
        initialRule={{ id: '1', category_id: 'c1', field: 'name', operator: 'contains', value: 'lehenga', created_at: '', updated_at: '' }}
      />,
      { wrapper }
    )
    expect(screen.getByText('Edit Condition')).toBeInTheDocument()
  })
})
