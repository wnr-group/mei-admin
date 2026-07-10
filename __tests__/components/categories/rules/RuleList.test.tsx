// __tests__/components/categories/rules/RuleList.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/services/category-rules', () => ({
  getCategoryRules: vi.fn().mockResolvedValue([
    { id: '1', category_id: 'c1', field: 'name', operator: 'contains', value: 'lehenga', created_at: '', updated_at: '' },
  ]),
  createCategoryRule: vi.fn(),
  updateCategoryRule: vi.fn(),
  deleteCategoryRule: vi.fn(),
}))
vi.mock('@/services/product-categories', () => ({
  reevaluateAllProducts: vi.fn().mockResolvedValue({ evaluated: 0 }),
}))

const { default: RuleList } = await import('@/components/categories/rules/RuleList')

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, {
    client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  }, children)
}

describe('RuleList', () => {
  it('renders existing rules once loaded', async () => {
    render(<RuleList categoryId="c1" matchType="ALL" onMatchTypeChange={() => {}} />, { wrapper })
    expect(await screen.findByText(/lehenga/)).toBeInTheDocument()
  })

  it('shows the Add Condition button', async () => {
    render(<RuleList categoryId="c1" matchType="ALL" onMatchTypeChange={() => {}} />, { wrapper })
    expect(await screen.findByText('Add Condition')).toBeInTheDocument()
  })

  it('shows the Re-evaluate All Products action', async () => {
    render(<RuleList categoryId="c1" matchType="ALL" onMatchTypeChange={() => {}} />, { wrapper })
    expect(await screen.findByText('Re-evaluate All Products')).toBeInTheDocument()
  })
})
