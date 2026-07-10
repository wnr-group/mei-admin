/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { verifyWebhookSignature } from '@/lib/services/razorpay'

let supabaseInstance: SupabaseClient | null = null

function getServiceClient(): SupabaseClient {
  if (!supabaseInstance) {
    supabaseInstance = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  }
  return supabaseInstance
}

type PaymentEntity = { id?: string; order_id?: string; method?: string }
type RefundEntity = { id?: string; payment_id?: string }
type WebhookPayload = { payment?: { entity?: PaymentEntity }; refund?: { entity?: RefundEntity } }

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-razorpay-signature') ?? ''

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let event: { event: string; payload: WebhookPayload }
  try { event = JSON.parse(rawBody) } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const supabase = getServiceClient()

  switch (event.event) {
    case 'payment.captured': {
      const p = event.payload.payment?.entity
      if (!p?.order_id) break
      const { data: existing } = (await (supabase.from('orders') as any)
        .select('id, webhook_verified')
        .eq('razorpay_order_id', p.order_id)
        .maybeSingle()) as { data: { id: string; webhook_verified: boolean } | null; error: unknown }
      if (existing?.webhook_verified) break
      await supabase
        .from('orders')
        .update({ payment_status: 'captured', webhook_verified: true, razorpay_payment_id: p.id ?? null, payment_method: p.method ?? null, payment_captured_at: new Date().toISOString() })
        .eq('razorpay_order_id', p.order_id)
      break
    }
    case 'payment.failed': {
      const p = event.payload.payment?.entity
      if (!p?.order_id) break
      await supabase
        .from('orders')
        .update({ payment_status: 'failed', webhook_verified: true })
        .eq('razorpay_order_id', p.order_id)
      break
    }
    case 'refund.created': {
      const r = event.payload.refund?.entity
      if (!r?.payment_id) break
      await supabase
        .from('orders')
        .update({ reconciliation_status: 'refund_initiated' })
        .eq('razorpay_payment_id', r.payment_id)
      break
    }
    case 'refund.processed': {
      const r = event.payload.refund?.entity
      if (!r?.payment_id) break
      await supabase
        .from('orders')
        .update({ reconciliation_status: 'refund_processed' })
        .eq('razorpay_payment_id', r.payment_id)
      break
    }
    default:
      console.log(`[webhook] Unhandled event: ${event.event}`)
  }

  return NextResponse.json({ received: true })
}
