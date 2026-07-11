// __tests__/components/settings/ShippingSettingsPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/services/shipping', () => ({
  getShippingRates: vi.fn().mockResolvedValue([
    { id: 'r1', state: 'Tamil Nadu', charge: 300, updated_at: '' },
    { id: 'r2', state: 'Karnataka', charge: 350, updated_at: '' },
  ]),
  createShippingRate: vi.fn().mockResolvedValue({ id: 'r3', state: 'Puducherry', charge: 400, updated_at: '' }),
  updateShippingRate: vi.fn().mockResolvedValue({ id: 'r1', state: 'Tamil Nadu', charge: 350, updated_at: '' }),
  deleteShippingRate: vi.fn().mockResolvedValue(undefined),
  getShippingSettings: vi.fn().mockResolvedValue({ id: 1, free_shipping_enabled: true, free_shipping_threshold: 5000, updated_at: '' }),
  updateShippingSettings: vi.fn().mockResolvedValue({ id: 1, free_shipping_enabled: true, free_shipping_threshold: 5000, updated_at: '' }),
}))

const { default: ShippingSettingsPage } = await import('@/app/(app)/settings/shipping/page')
const { createShippingRate, updateShippingRate, deleteShippingRate } = await import('@/services/shipping')

let currentClient: QueryClient
function wrapper({ children }: { children: React.ReactNode }) {
  currentClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return React.createElement(QueryClientProvider, { client: currentClient }, children)
}

describe('ShippingSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders only the states that have configured rates', async () => {
    render(<ShippingSettingsPage />, { wrapper })
    expect(await screen.findByDisplayValue('Tamil Nadu')).toBeInTheDocument()
    expect(await screen.findByDisplayValue('Karnataka')).toBeInTheDocument()
  })

  it('pre-fills the charge input for a configured state', async () => {
    render(<ShippingSettingsPage />, { wrapper })
    const input = (await screen.findByLabelText('Shipping charge for Tamil Nadu')) as HTMLInputElement
    expect(input.value).toBe('300')
  })

  it('saves an edited charge by row id when its Save button is clicked', async () => {
    render(<ShippingSettingsPage />, { wrapper })
    const input = (await screen.findByLabelText('Shipping charge for Tamil Nadu')) as HTMLInputElement
    fireEvent.change(input, { target: { value: '350' } })
    const row = input.closest('tr')!
    fireEvent.click(within(row).getByText('Save'))

    await waitFor(() => {
      expect(updateShippingRate).toHaveBeenCalledWith('r1', { state: 'Tamil Nadu', charge: 350 })
    })
  })

  it('renames a state via its row Save button', async () => {
    render(<ShippingSettingsPage />, { wrapper })
    const nameInput = (await screen.findByLabelText('State name for Tamil Nadu')) as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'Tamil Nadu (South)' } })
    const row = nameInput.closest('tr')!
    fireEvent.click(within(row).getByText('Save'))

    await waitFor(() => {
      expect(updateShippingRate).toHaveBeenCalledWith('r1', { state: 'Tamil Nadu (South)', charge: 300 })
    })
  })

  it('adds a new state through the Add State form', async () => {
    render(<ShippingSettingsPage />, { wrapper })
    fireEvent.change(await screen.findByLabelText('State / Region'), { target: { value: 'Puducherry' } })
    fireEvent.change(screen.getByLabelText('Charge (₹)'), { target: { value: '400' } })
    fireEvent.click(screen.getByText('Add State'))

    await waitFor(() => {
      expect(createShippingRate).toHaveBeenCalledWith({ state: 'Puducherry', charge: 400 })
    })
  })

  it('rejects adding a state with no name', async () => {
    render(<ShippingSettingsPage />, { wrapper })
    fireEvent.change(await screen.findByLabelText('Charge (₹)'), { target: { value: '400' } })
    fireEvent.click(screen.getByText('Add State'))

    await waitFor(() => {
      expect(screen.getByText(/state name is required/i)).toBeInTheDocument()
    })
    expect(createShippingRate).not.toHaveBeenCalled()
  })

  it('rejects an invalid charge on add without calling createShippingRate', async () => {
    render(<ShippingSettingsPage />, { wrapper })
    fireEvent.change(await screen.findByLabelText('State / Region'), { target: { value: 'Goa' } })
    fireEvent.change(screen.getByLabelText('Charge (₹)'), { target: { value: 'abc' } })
    fireEvent.click(screen.getByText('Add State'))

    await waitFor(() => {
      expect(screen.getByText(/charge must be a number between 0 and 100000/i)).toBeInTheDocument()
    })
    expect(createShippingRate).not.toHaveBeenCalled()
  })

  it('deletes a state after confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<ShippingSettingsPage />, { wrapper })
    const row = (await screen.findByDisplayValue('Karnataka')).closest('tr')!
    fireEvent.click(within(row).getByText('Delete'))

    await waitFor(() => {
      expect(deleteShippingRate).toHaveBeenCalledWith('r2')
    })
    confirmSpy.mockRestore()
  })

  it('does not delete when the confirmation is dismissed', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<ShippingSettingsPage />, { wrapper })
    const row = (await screen.findByDisplayValue('Karnataka')).closest('tr')!
    fireEvent.click(within(row).getByText('Delete'))

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled()
    })
    expect(deleteShippingRate).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('rejects a negative charge on a row without calling updateShippingRate', async () => {
    render(<ShippingSettingsPage />, { wrapper })
    const input = (await screen.findByLabelText('Shipping charge for Tamil Nadu')) as HTMLInputElement
    fireEvent.change(input, { target: { value: '-50' } })
    const row = input.closest('tr')!
    fireEvent.click(within(row).getByText('Save'))

    await waitFor(() => {
      expect(screen.getByText(/charge must be a number between 0 and 100000/i)).toBeInTheDocument()
    })
    expect(updateShippingRate).not.toHaveBeenCalled()
  })

  it('shows the free shipping threshold from settings', async () => {
    render(<ShippingSettingsPage />, { wrapper })
    expect(await screen.findByDisplayValue('5000')).toBeInTheDocument()
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

  it('preserves an unsaved edit in one row when a background refetch reflects a genuine change in a different row', async () => {
    const { getShippingRates } = await import('@/services/shipping')
    vi.mocked(getShippingRates)
      .mockResolvedValueOnce([
        { id: 'r1', state: 'Tamil Nadu', charge: 300, updated_at: '' },
        { id: 'r2', state: 'Karnataka', charge: 350, updated_at: '' },
      ])
      .mockResolvedValueOnce([
        { id: 'r1', state: 'Tamil Nadu', charge: 320, updated_at: '' },
        { id: 'r2', state: 'Karnataka', charge: 350, updated_at: '' },
      ])

    render(<ShippingSettingsPage />, { wrapper })
    const kaInput = (await screen.findByLabelText('Shipping charge for Karnataka')) as HTMLInputElement
    const tnInput = (await screen.findByLabelText('Shipping charge for Tamil Nadu')) as HTMLInputElement

    // Admin types into Karnataka but hasn't clicked its Save button yet.
    fireEvent.change(kaInput, { target: { value: '999' } })

    // Simulate a background refetch unrelated to this admin's own save.
    await currentClient.invalidateQueries({ queryKey: ['shipping', 'rates'] })

    // The refetch's genuine change to Tamil Nadu should still land...
    await waitFor(() => {
      expect(tnInput.value).toBe('320')
    })
    // ...but Karnataka's unsaved edit must not be silently wiped.
    expect(kaInput.value).toBe('999')
  })
})
