import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockVerifySig = vi.fn()
const mockFetchPayment = vi.fn()
const mockLookup = vi.fn()
const mockCompute = vi.fn()
const mockCreateOrder = vi.fn()

vi.mock('@/lib/services/razorpay', () => ({ verifyPaymentSignature: mockVerifySig, fetchPayment: mockFetchPayment }))
vi.mock('@/lib/services/payment-orders', () => ({
  lookupProductPrices: mockLookup,
  computeTotal: mockCompute,
  createOrderWithPayment: mockCreateOrder,
}))

const customer = { name: 'Priya', email: 'p@t.com', phone: '+91 9999999999', city: 'Mumbai', address_line1: '1 MG Rd', state: 'MH', pincode: '400001', country: 'India' }
const validBody = { razorpay_order_id: 'order_abc', razorpay_payment_id: 'pay_xyz', razorpay_signature: 'sig', customer, cart_items: [{ product_id: 'p1', quantity: 1 }], currency: 'INR' }

function makeReq(body: unknown, secret = 'shared_secret') {
  return new NextRequest('http://localhost/api/payments/complete-order', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${secret}` }, body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.STOREFRONT_API_SECRET = 'shared_secret'
  mockVerifySig.mockReturnValue(true)
  mockFetchPayment.mockResolvedValue({ id: 'pay_xyz', amount: 315000, status: 'captured', method: 'upi', order_id: 'order_abc' })
  mockLookup.mockResolvedValue(new Map([['p1', { name: 'Lehenga', price: 3000 }]]))
  mockCompute.mockReturnValue({ subtotal: 3000, shipping: 150, total: 3150 })
  mockCreateOrder.mockResolvedValue({ order_id: 'uuid-1', order_number: 'MEI-100001' })
  vi.resetModules()
})

describe('POST /api/payments/complete-order', () => {
  it('returns order_number on success', async () => {
    const { POST } = await import('@/app/api/payments/complete-order/route')
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(200)
    expect((await res.json()).order_number).toBe('MEI-100001')
  })

  it('returns 401 without Authorization', async () => {
    const { POST } = await import('@/app/api/payments/complete-order/route')
    const req = new NextRequest('http://localhost/api/payments/complete-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(validBody) })
    expect((await POST(req)).status).toBe(401)
  })

  it('returns 400 for invalid signature', async () => {
    mockVerifySig.mockReturnValue(false)
    const { POST } = await import('@/app/api/payments/complete-order/route')
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/signature/i)
  })

  it('returns 400 when payment not captured', async () => {
    mockFetchPayment.mockResolvedValue({ id: 'pay_xyz', amount: 315000, status: 'failed', method: 'upi', order_id: 'order_abc' })
    const { POST } = await import('@/app/api/payments/complete-order/route')
    expect((await POST(makeReq(validBody))).status).toBe(400)
  })

  it('returns 400 when payment amount mismatches server total', async () => {
    mockFetchPayment.mockResolvedValue({ id: 'pay_xyz', amount: 100000, status: 'captured', method: 'upi', order_id: 'order_abc' })
    const { POST } = await import('@/app/api/payments/complete-order/route')
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/amount/i)
  })

  it('returns 400 for non-INR currency', async () => {
    const { POST } = await import('@/app/api/payments/complete-order/route')
    expect((await POST(makeReq({ ...validBody, currency: 'USD' }))).status).toBe(400)
  })
})
