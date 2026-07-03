import { createClient } from 'jsr:@supabase/supabase-js@2';
import { logNotification } from '../_shared/log.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const NOTIFY_STATUSES = new Set(['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface NotifyRequest {
  order_id: string;
  new_status: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  // JWT validation is enforced at the Supabase platform level — this function is deployed
  // without --no-verify-jwt, so only authenticated admin sessions reach this handler.

  const correlationId = req.headers.get('x-request-id') ?? crypto.randomUUID();

  const log = (event: string, extra?: Record<string, unknown>) =>
    logNotification('order-status-notify', { event, correlation_id: correlationId, ...extra });

  log('order_status_notify_started');

  try {
    const body = (await req.json()) as NotifyRequest;
    log('request_parsed', { order_id: body.order_id, new_status: body.new_status });

    if (!body.order_id || !body.new_status) {
      log('invalid_payload');
      return json({ success: false, error: 'INVALID_PAYLOAD' }, 400);
    }

    if (body.new_status === 'PENDING' || !NOTIFY_STATUSES.has(body.new_status)) {
      log('status_not_notifiable', { status: body.new_status });
      return json({ success: true, enqueued: false, detail: 'Status does not require notification' });
    }

    const enabled = Deno.env.get('NOTIFICATIONS_ENABLED') === 'true';
    if (!enabled) {
      log('notifications_disabled');
      return json({ success: true, enqueued: false, detail: 'Notifications disabled' });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      log('missing_supabase_config');
      return json({ success: false, error: 'SERVER_MISCONFIGURED' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, customer_id, status')
      .eq('id', body.order_id)
      .is('deleted_at', null)
      .single();

    if (orderError || !order) {
      log('order_not_found', { error: orderError?.message });
      return json({ success: false, error: 'ORDER_NOT_FOUND' }, 404);
    }

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('name, email')
      .eq('id', order.customer_id)
      .single();

    if (customerError || !customer) {
      log('customer_not_found', { error: customerError?.message });
      return json({ success: false, error: 'CUSTOMER_NOT_FOUND' }, 404);
    }

    const idempotencyKey = `ORDER_STATUS_UPDATE_CUSTOMER:${body.order_id}:${body.new_status}`;
    const payload_data = {
      correlationId,
      customerName: customer.name,
      orderNumber: order.order_number,
      newStatus: body.new_status,
    };

    logNotification('order-status-notify', {
      event: 'notification_enqueue_started',
      correlation_id: correlationId,
      notification_type: 'ORDER_STATUS_UPDATE_CUSTOMER',
      customer_email: customer.email,
      order_id: body.order_id,
      order_number: order.order_number,
    });

    // Direct upsert — avoids PostgREST text→ENUM casting failure that affects RPC calls.
    // See create-order/index.ts for the documented explanation of this pattern.
    const { error: enqueueError } = await supabase
      .from('notification_jobs')
      .upsert(
        {
          idempotency_key: idempotencyKey,
          type: 'ORDER_STATUS_UPDATE_CUSTOMER',
          recipient_email: customer.email,
          payload: payload_data,
          priority: 1,
        },
        { onConflict: 'idempotency_key', ignoreDuplicates: true }
      );

    if (enqueueError) {
      logNotification('order-status-notify', {
        event: 'notification_enqueue_failed',
        correlation_id: correlationId,
        notification_type: 'ORDER_STATUS_UPDATE_CUSTOMER',
        customer_email: customer.email,
        error_message: enqueueError.message,
        error_code: enqueueError.code ?? null,
      });
      log('enqueue_failed', { error: enqueueError.message });
      return json({ success: true, enqueued: false, detail: enqueueError.message });
    }

    logNotification('order-status-notify', {
      event: 'notification_enqueue_success',
      correlation_id: correlationId,
      notification_type: 'ORDER_STATUS_UPDATE_CUSTOMER',
      customer_email: customer.email,
      order_id: body.order_id,
      order_number: order.order_number,
    });

    log('notification_enqueued');
    return json({ success: true, enqueued: true });
  } catch (err) {
    log('unhandled_error', { error: String(err) });
    return json({ success: false, error: 'INTERNAL_ERROR' }, 500);
  }
});
