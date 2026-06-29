import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockIs = vi.fn()
const mockEq = vi.fn()
const mockIn = vi.fn()
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockSingle = vi.fn()
const mockFrom = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}))

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc_key'
  vi.resetModules()
})

describe('computeTotal', () => {
  it('charges flat shipping when subtotal < 5000', async () => {
    const { computeTotal } = await import('@/lib/services/payment-orders')
    const priceMap = new Map([['p1', { name: 'Lehenga', price: 3000 }]])
    const r = computeTotal([{ product_id: 'p1', quantity: 1 }], priceMap)
    expect(r.subtotal).toBe(3000)
    expect(r.shipping).toBe(150)
    expect(r.total).toBe(3150)
  })

  it('gives free shipping when subtotal >= 5000', async () => {
    const { computeTotal } = await import('@/lib/services/payment-orders')
    const priceMap = new Map([['p1', { name: 'Saree', price: 6000 }]])
    const r = computeTotal([{ product_id: 'p1', quantity: 1 }], priceMap)
    expect(r.shipping).toBe(0)
    expect(r.total).toBe(6000)
  })

  it('throws when product_id missing from priceMap', async () => {
    const { computeTotal } = await import('@/lib/services/payment-orders')
    expect(() => computeTotal([{ product_id: 'missing', quantity: 1 }], new Map())).toThrow('Product missing not found')
  })

  it('multiplies quantity across multiple items', async () => {
    const { computeTotal } = await import('@/lib/services/payment-orders')
    const priceMap = new Map([['a', { name: 'A', price: 2000 }], ['b', { name: 'B', price: 1500 }]])
    const r = computeTotal([{ product_id: 'a', quantity: 2 }, { product_id: 'b', quantity: 1 }], priceMap)
    expect(r.subtotal).toBe(5500)
    expect(r.shipping).toBe(0)
  })
})

describe('lookupProductPrices', () => {
  it('returns Map of id → {name, price}', async () => {
    mockFrom.mockReturnValue({
      select: mockSelect.mockReturnValue({
        in: mockIn.mockReturnValue({
          eq: mockEq.mockReturnValue({
            is: mockIs.mockResolvedValue({ data: [{ id: 'p1', name: 'Lehenga', price: 3000 }], error: null }),
          }),
        }),
      }),
    })
    const { lookupProductPrices } = await import('@/lib/services/payment-orders')
    const m = await lookupProductPrices([{ product_id: 'p1', quantity: 1 }])
    expect(m.get('p1')).toEqual({ name: 'Lehenga', price: 3000 })
  })

  it('throws on Supabase error', async () => {
    mockFrom.mockReturnValue({
      select: mockSelect.mockReturnValue({
        in: mockIn.mockReturnValue({
          eq: mockEq.mockReturnValue({
            is: mockIs.mockResolvedValue({ data: null, error: { message: 'DB error' } }),
          }),
        }),
      }),
    })
    const { lookupProductPrices } = await import('@/lib/services/payment-orders')
    await expect(lookupProductPrices([{ product_id: 'p1', quantity: 1 }])).rejects.toThrow('Failed to look up product prices')
  })
})
