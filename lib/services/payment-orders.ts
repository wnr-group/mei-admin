import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export const FREE_SHIPPING_THRESHOLD = 5000
export const SHIPPING_FLAT_RATE = 150

function getServiceClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export type CartItemInput = { product_id: string; quantity: number }

export type CustomerInput = {
  name: string; email: string; phone: string; city: string
  address_line1: string; address_line2?: string
  state: string; pincode: string; country: string
}

type ProductRow = { id: string; name: string; price: number }

export async function lookupProductPrices(cartItems: CartItemInput[]): Promise<Map<string, { name: string; price: number }>> {
  const { data, error } = await getServiceClient()
    .from('products')
    .select('id, name, price')
    .in('id', cartItems.map((i) => i.product_id))
    .eq('status', 'PUBLISHED')
    .is('deleted_at', null) as { data: ProductRow[] | null; error: { message: string } | null }

  if (error || !data) throw new Error('Failed to look up product prices')
  const map = new Map<string, { name: string; price: number }>()
  for (const p of data) map.set(p.id, { name: p.name, price: p.price })
  return map
}

export function computeTotal(
  cartItems: CartItemInput[],
  priceMap: Map<string, { name: string; price: number }>
): { subtotal: number; shipping: number; total: number } {
  const subtotal = cartItems.reduce((sum, item) => {
    const product = priceMap.get(item.product_id)
    if (!product) throw new Error(`Product ${item.product_id} not found or not available`)
    return sum + product.price * item.quantity
  }, 0)
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT_RATE
  return { subtotal, shipping, total: subtotal + shipping }
}

export async function createOrderWithPayment(params: {
  customer: CustomerInput
  cartItems: CartItemInput[]
  priceMap: Map<string, { name: string; price: number }>
  razorpayOrderId: string
  razorpayPaymentId: string
  paymentMethod: string
  totalINR: number
}): Promise<{ order_id: string; order_number: string }> {
  const supabase = getServiceClient()
  const { customer, cartItems, priceMap, razorpayOrderId, razorpayPaymentId, paymentMethod, totalINR } = params

  const { data: customerData, error: customerError } = await supabase
    .from('customers')
    .insert([{ name: customer.name, email: customer.email, phone: customer.phone, city: customer.city }] as never)
    .select('id')
    .single()
  if (customerError || !customerData) throw new Error('Failed to create customer')
  const customerRow = customerData as { id: string }

  const notes = JSON.stringify({
    shipping: { line1: customer.address_line1, line2: customer.address_line2 ?? null, state: customer.state, pincode: customer.pincode, country: customer.country },
  })

  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .insert([{
      customer_id: customerRow.id,
      total: totalINR,
      status: 'CONFIRMED' as const,
      notes,
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      payment_method: paymentMethod,
      payment_status: 'captured',
      payment_captured_at: new Date().toISOString(),
      webhook_verified: false,
    }] as never)
    .select('id, order_number')
    .single()
  if (orderError || !orderData) throw new Error('Failed to create order')
  const order = orderData as { id: string; order_number: string }

  const itemsToInsert = cartItems.map((item) => {
    const product = priceMap.get(item.product_id)!
    return {
      order_id: order.id,
      product_id: item.product_id,
      product_name: product.name,
      quantity: item.quantity,
      unit_price: product.price,
    }
  })
  const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert as never)
  if (itemsError) throw new Error('Failed to create order items')

  return { order_id: order.id, order_number: order.order_number }
}
