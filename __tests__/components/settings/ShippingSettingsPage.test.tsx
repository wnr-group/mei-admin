// __tests__/components/settings/ShippingSettingsPage.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/services/shipping', () => ({
  getShippingRates: vi.fn().mockResolvedValue([
    { id: 'r1', state: 'Tamil Nadu', charge: 300, updated_at: '' },
  ]),
  upsertShippingRate: vi.fn().mockResolvedValue({ id: 'r1', state: 'Tamil Nadu', charge: 300, updated_at: '' }),
  getShippingSettings: vi.fn().mockResolvedValue({ id: 1, free_shipping_enabled: true, free_shipping_threshold: 5000, updated_at: '' }),
  updateShippingSettings: vi.fn().mockResolvedValue({ id: 1, free_shipping_enabled: true, free_shipping_threshold: 5000, updated_at: '' }),
}))

const { default: ShippingSettingsPage } = await import('@/app/(app)/settings/shipping/page')
const { upsertShippingRate } = await import('@/services/shipping')

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, {
    client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  }, children)
}

describe('ShippingSettingsPage', () => {
  it('renders every canonical Indian state as a row', async () => {
    render(<ShippingSettingsPage />, { wrapper })
    expect(await screen.findByText('Karnataka')).toBeInTheDocument()
    expect(await screen.findByText('Tamil Nadu')).toBeInTheDocument()
  })

  it('pre-fills the charge input for a configured state', async () => {
    render(<ShippingSettingsPage />, { wrapper })
    const row = (await screen.findByText('Tamil Nadu')).closest('tr')!
    const input = row.querySelector('input') as HTMLInputElement
    expect(input.value).toBe('300')
  })

  it('saves an edited charge when Save All Changes is clicked', async () => {
    render(<ShippingSettingsPage />, { wrapper })
    const row = (await screen.findByText('Tamil Nadu')).closest('tr')!
    const input = row.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '350' } })
    fireEvent.click(screen.getByText('Save All Changes'))

    await waitFor(() => {
      expect(upsertShippingRate).toHaveBeenCalledWith({ state: 'Tamil Nadu', charge: 350 })
    })
  })

  it('shows the free shipping threshold from settings', async () => {
    render(<ShippingSettingsPage />, { wrapper })
    expect(await screen.findByDisplayValue('5000')).toBeInTheDocument()
  })

  it('rejects a negative charge without calling upsertShippingRate, and shows an inline error', async () => {
    render(<ShippingSettingsPage />, { wrapper })
    const row = (await screen.findByText('Tamil Nadu')).closest('tr')!
    const input = row.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '-50' } })
    fireEvent.click(screen.getByText('Save All Changes'))

    await waitFor(() => {
      expect(screen.getByText(/enter a number between 0 and 100000/i)).toBeInTheDocument()
    })
    expect(upsertShippingRate).not.toHaveBeenCalled()
  })

  it('rejects a non-numeric charge without calling upsertShippingRate', async () => {
    render(<ShippingSettingsPage />, { wrapper })
    const row = (await screen.findByText('Karnataka')).closest('tr')!
    const input = row.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'abc' } })
    fireEvent.click(screen.getByText('Save All Changes'))

    await waitFor(() => {
      expect(screen.getByText(/enter a number between 0 and 100000/i)).toBeInTheDocument()
    })
    expect(upsertShippingRate).not.toHaveBeenCalled()
  })

  it('labels every charge input accessibly by state name', async () => {
    render(<ShippingSettingsPage />, { wrapper })
    expect(await screen.findByLabelText('Shipping charge for Tamil Nadu')).toBeInTheDocument()
    expect(await screen.findByLabelText('Shipping charge for Karnataka')).toBeInTheDocument()
  })

  it('labels the free shipping threshold input accessibly', async () => {
    render(<ShippingSettingsPage />, { wrapper })
    expect(await screen.findByLabelText('Threshold (₹)')).toBeInTheDocument()
  })
})
