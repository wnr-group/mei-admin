import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'crypto'

vi.mock('razorpay', () => {
  class MockRazorpay {
    orders = {
      create: vi.fn().mockResolvedValue({ id: 'order_test123', amount: 100000, currency: 'INR' }),
    }
    payments = {
      fetch: vi.fn().mockResolvedValue({
        id: 'pay_test456', amount: 100000, status: 'captured', method: 'upi', order_id: 'order_test123',
      }),
    }
  }
  return { default: MockRazorpay }
})

beforeEach(() => {
  process.env.RAZORPAY_KEY_ID = 'rzp_test_key'
  process.env.RAZORPAY_KEY_SECRET = 'test_secret_abc'
  process.env.RAZORPAY_WEBHOOK_SECRET = 'webhook_secret_xyz'
  vi.resetModules()
})

describe('createRazorpayOrder', () => {
  it('returns razorpay_order_id from SDK', async () => {
    const { createRazorpayOrder } = await import('@/lib/services/razorpay')
    const result = await createRazorpayOrder({ amount_paise: 100000, currency: 'INR', receipt: 'rcpt_1' })
    expect(result.razorpay_order_id).toBe('order_test123')
    expect(result.amount).toBe(100000)
  })
})

describe('fetchPayment', () => {
  it('returns normalised payment object', async () => {
    const { fetchPayment } = await import('@/lib/services/razorpay')
    const p = await fetchPayment('pay_test456')
    expect(p.status).toBe('captured')
    expect(p.amount).toBe(100000)
    expect(p.method).toBe('upi')
  })
})

describe('verifyPaymentSignature', () => {
  it('returns true for correct HMAC', async () => {
    const { verifyPaymentSignature } = await import('@/lib/services/razorpay')
    const sig = createHmac('sha256', 'test_secret_abc')
      .update('order_test123|pay_test456')
      .digest('hex')
    expect(verifyPaymentSignature({ razorpay_order_id: 'order_test123', razorpay_payment_id: 'pay_test456', razorpay_signature: sig })).toBe(true)
  })

  it('returns false for tampered signature', async () => {
    const { verifyPaymentSignature } = await import('@/lib/services/razorpay')
    expect(verifyPaymentSignature({ razorpay_order_id: 'order_test123', razorpay_payment_id: 'pay_test456', razorpay_signature: 'deadbeef00' })).toBe(false)
  })

  it('returns false for wrong-length / non-hex signature', async () => {
    const { verifyPaymentSignature } = await import('@/lib/services/razorpay')
    expect(verifyPaymentSignature({ razorpay_order_id: 'x', razorpay_payment_id: 'y', razorpay_signature: 'short' })).toBe(false)
  })
})

describe('verifyWebhookSignature', () => {
  it('returns true for valid webhook HMAC', async () => {
    const { verifyWebhookSignature } = await import('@/lib/services/razorpay')
    const body = '{"event":"payment.captured"}'
    const sig = createHmac('sha256', 'webhook_secret_xyz').update(body).digest('hex')
    expect(verifyWebhookSignature(body, sig)).toBe(true)
  })

  it('returns false for invalid signature', async () => {
    const { verifyWebhookSignature } = await import('@/lib/services/razorpay')
    expect(verifyWebhookSignature('{}', 'badsig')).toBe(false)
  })
})
