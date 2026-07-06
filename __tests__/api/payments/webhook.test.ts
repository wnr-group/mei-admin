import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockVerifyWebhook = vi.fn()
const mockMaybeSingle = vi.fn()
const mockUpdateEq = vi.fn()
const mockUpdate = vi.fn()
const mockEq = vi.fn()
const mockSelect = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/services/razorpay', () => ({ verifyWebhookSignature: mockVerifyWebhook }))
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ from: mockFrom })) }))

function makeReq(body: unknown, sig = 'valid_sig') {
  return new NextRequest('http://localhost/api/payments/webhook', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': sig }, body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc_key'
  mockVerifyWebhook.mockReturnValue(true)
  mockMaybeSingle.mockResolvedValue({ data: { id: 'ord-uuid', webhook_verified: false }, error: null })
  mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockUpdateEq.mockResolvedValue({ error: null })
  mockUpdate.mockReturnValue({ eq: mockUpdateEq })
  mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate })
  vi.resetModules()
})

describe('POST /api/payments/webhook', () => {
  it('returns 400 for invalid signature', async () => {
    mockVerifyWebhook.mockReturnValue(false)
    const { POST } = await import('@/app/api/payments/webhook/route')
    expect((await POST(makeReq({ event: 'payment.captured' }, 'bad'))).status).toBe(400)
  })

  it('returns 200 with received:true for payment.captured', async () => {
    const { POST } = await import('@/app/api/payments/webhook/route')
    const payload = { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_xyz', order_id: 'order_rzp', method: 'upi' } } } }
    const res = await POST(makeReq(payload))
    expect(res.status).toBe(200)
    expect((await res.json()).received).toBe(true)
  })

  it('returns 200 for payment.failed', async () => {
    const { POST } = await import('@/app/api/payments/webhook/route')
    expect((await POST(makeReq({ event: 'payment.failed', payload: { payment: { entity: { id: 'pay_xyz', order_id: 'ord_rzp' } } } }))).status).toBe(200)
  })

  it('skips DB update when webhook_verified already true (idempotency)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: 'ord-uuid', webhook_verified: true }, error: null })
    const { POST } = await import('@/app/api/payments/webhook/route')
    const payload = { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_xyz', order_id: 'ord_rzp', method: 'upi' } } } }
    await POST(makeReq(payload))
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns 200 for unknown event types', async () => {
    const { POST } = await import('@/app/api/payments/webhook/route')
    expect((await POST(makeReq({ event: 'order.paid', payload: {} }))).status).toBe(200)
  })
})
