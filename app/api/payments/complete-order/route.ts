import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { verifyPaymentSignature, fetchPayment } from '@/lib/services/razorpay'
import { lookupProductPrices, computeTotal, createOrderWithPayment, type CustomerInput, type CartItemInput } from '@/lib/services/payment-orders'

function verifyStorefrontAuth(request: NextRequest): boolean {
  const auth = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${process.env.STOREFRONT_API_SECRET ?? ''}`
  if (auth.length !== expected.length) return false
  try { return timingSafeEqual(Buffer.from(expected), Buffer.from(auth)) } catch { return false }
}

export async function POST(request: NextRequest) {
  if (!verifyStorefrontAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string; customer: CustomerInput; cart_items: CartItemInput[]; currency: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, customer, cart_items, currency } = body
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return NextResponse.json({ error: 'Missing payment fields' }, { status: 400 })
  if (!customer?.name || !customer?.email) return NextResponse.json({ error: 'Missing customer fields' }, { status: 400 })
  if (!Array.isArray(cart_items) || cart_items.length === 0) return NextResponse.json({ error: 'cart_items required' }, { status: 400 })
  if (currency !== 'INR') return NextResponse.json({ error: 'Only INR supported' }, { status: 400 })

  if (!verifyPaymentSignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature })) {
    return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
  }

  let payment: Awaited<ReturnType<typeof fetchPayment>>
  try { payment = await fetchPayment(razorpay_payment_id) } catch {
    return NextResponse.json({ error: 'Failed to fetch payment from Razorpay' }, { status: 502 })
  }

  if (payment.status !== 'captured') return NextResponse.json({ error: `Payment not captured: ${payment.status}` }, { status: 400 })

  let priceMap: Map<string, { name: string; price: number }>
  try { priceMap = await lookupProductPrices(cart_items) } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Product lookup failed' }, { status: 400 })
  }

  const { total: totalINR } = computeTotal(cart_items, priceMap)
  const expectedPaise = Math.round(totalINR * 100)
  if (payment.amount !== expectedPaise) {
    return NextResponse.json({ error: `Amount mismatch: expected ${expectedPaise}, got ${payment.amount}` }, { status: 400 })
  }

  try {
    const result = await createOrderWithPayment({ customer, cartItems: cart_items, priceMap, razorpayOrderId: razorpay_order_id, razorpayPaymentId: razorpay_payment_id, paymentMethod: payment.method, totalINR })
    return NextResponse.json({ order_number: result.order_number })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to create order' }, { status: 500 })
  }
}
