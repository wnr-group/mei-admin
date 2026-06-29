import Razorpay from 'razorpay'
import { createHmac, timingSafeEqual } from 'crypto'

let _instance: Razorpay | null = null

function getInstance(): Razorpay {
  if (!_instance) {
    _instance = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID!, key_secret: process.env.RAZORPAY_KEY_SECRET! })
  }
  return _instance
}

export async function createRazorpayOrder(params: {
  amount_paise: number
  currency: 'INR'
  receipt: string
}): Promise<{ razorpay_order_id: string; amount: number; currency: string }> {
  const order = await getInstance().orders.create({ amount: params.amount_paise, currency: params.currency, receipt: params.receipt })
  return {
    razorpay_order_id: order.id,
    amount: typeof order.amount === 'string' ? parseInt(order.amount, 10) : order.amount,
    currency: order.currency,
  }
}

export type RazorpayPayment = { id: string; amount: number; status: string; method: string; order_id: string }

export async function fetchPayment(paymentId: string): Promise<RazorpayPayment> {
  const p = await getInstance().payments.fetch(paymentId)
  return {
    id: p.id,
    amount: typeof p.amount === 'string' ? parseInt(p.amount, 10) : (p.amount as number),
    status: p.status as string,
    method: p.method as string,
    order_id: (p as unknown as { order_id: string }).order_id,
  }
}

export function verifyPaymentSignature(params: {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}): boolean {
  const expected = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(`${params.razorpay_order_id}|${params.razorpay_payment_id}`)
    .digest('hex')
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(params.razorpay_signature, 'hex'))
  } catch {
    return false
  }
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const expected = createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest('hex')
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))
  } catch {
    return false
  }
}
