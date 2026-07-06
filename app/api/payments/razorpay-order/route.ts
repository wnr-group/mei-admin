import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createRazorpayOrder } from '@/lib/services/razorpay'
import { lookupProductPrices, computeTotal, type CartItemInput } from '@/lib/services/payment-orders'

function verifyStorefrontAuth(request: NextRequest): boolean {
  const auth = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${process.env.STOREFRONT_API_SECRET ?? ''}`
  if (auth.length !== expected.length) return false
  try { return timingSafeEqual(Buffer.from(expected), Buffer.from(auth)) } catch { return false }
}

export async function POST(request: NextRequest) {
  if (!verifyStorefrontAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { cart_items: CartItemInput[]; currency: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { cart_items, currency } = body
  if (!Array.isArray(cart_items) || cart_items.length === 0) return NextResponse.json({ error: 'cart_items required' }, { status: 400 })
  if (currency !== 'INR') return NextResponse.json({ error: 'Only INR supported' }, { status: 400 })

  try {
    const priceMap = await lookupProductPrices(cart_items)
    const { total } = computeTotal(cart_items, priceMap)
    const amount_paise = Math.round(total * 100)
    const order = await createRazorpayOrder({ amount_paise, currency: 'INR', receipt: `rcpt_${Date.now()}` })
    return NextResponse.json({ razorpay_order_id: order.razorpay_order_id, amount_paise, currency: 'INR' })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
