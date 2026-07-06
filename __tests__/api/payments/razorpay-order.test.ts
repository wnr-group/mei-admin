import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/services/razorpay', () => ({
  createRazorpayOrder: vi.fn().mockResolvedValue({ razorpay_order_id: 'order_abc', amount: 315000, currency: 'INR' }),
}))
vi.mock('@/lib/services/payment-orders', () => ({
  lookupProductPrices: vi.fn().mockResolvedValue(new Map([['p1', { name: 'Lehenga', price: 3000 }]])),
  computeTotal: vi.fn().mockReturnValue({ subtotal: 3000, shipping: 150, total: 3150 }),
}))

function makeReq(body: unknown, secret = 'shared_secret') {
  return new NextRequest('http://localhost/api/payments/razorpay-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${secret}` },
    body: JSON.stringify(body),
  })
}

beforeEach(() => { process.env.STOREFRONT_API_SECRET = 'shared_secret'; vi.resetModules() })

describe('POST /api/payments/razorpay-order', () => {
  it('returns razorpay_order_id and amount_paise', async () => {
    const { POST } = await import('@/app/api/payments/razorpay-order/route')
    const res = await POST(makeReq({ cart_items: [{ product_id: 'p1', quantity: 1 }], currency: 'INR' }))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.razorpay_order_id).toBe('order_abc')
    expect(data.amount_paise).toBe(315000)
  })

  it('returns 401 without Authorization', async () => {
    const { POST } = await import('@/app/api/payments/razorpay-order/route')
    const req = new NextRequest('http://localhost/api/payments/razorpay-order', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cart_items: [{ product_id: 'p1', quantity: 1 }], currency: 'INR' }),
    })
    expect((await POST(req)).status).toBe(401)
  })

  it('returns 401 with wrong secret', async () => {
    const { POST } = await import('@/app/api/payments/razorpay-order/route')
    expect((await POST(makeReq({ cart_items: [{ product_id: 'p1', quantity: 1 }], currency: 'INR' }, 'wrong'))).status).toBe(401)
  })

  it('returns 400 for non-INR currency', async () => {
    const { POST } = await import('@/app/api/payments/razorpay-order/route')
    expect((await POST(makeReq({ cart_items: [{ product_id: 'p1', quantity: 1 }], currency: 'USD' }))).status).toBe(400)
  })

  it('returns 400 for empty cart_items', async () => {
    const { POST } = await import('@/app/api/payments/razorpay-order/route')
    expect((await POST(makeReq({ cart_items: [], currency: 'INR' }))).status).toBe(400)
  })
})
