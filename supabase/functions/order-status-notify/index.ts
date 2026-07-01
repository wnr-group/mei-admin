import { createClient } from 'jsr:@supabase/supabase-js@2';

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

function structuredLog(fields: Record<string, unknown>) {
  console.log(JSON.stringify({
    service: 'order-status-notify',
    ts: new Date().toISOString(),
    ...fields,
  }));
}

async function verifyJWT(token: string): Promise<{ sub: string } | null> {
  try {
    const secret = Deno.env.get('JWT_SECRET');
    if (!secret) {
      structuredLog({ event: 'jwt_config_error', error: 'JWT_SECRET not set' });
      return null;
    }

    const encoder = new TextEncoder();
    const secretKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const payload = await jwtVerify(token, secretKey);
    return payload as { sub: string };
  } catch (err) {
    structuredLog({ event: 'jwt_verification_failed', error: String(err) });
    return null;
  }
}

interface NotifyRequest {
  order_id: string;
  new_status: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  const requestId = crypto.randomUUID();
  const log = (event: string, extra?: Record<string, unknown>) =>
    structuredLog({ requestId, event, ...extra });

  log('order_status_notify_started');

  try {
    // Verify JWT
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      log('missing_auth_header');
      return json({ success: false, error: 'MISSING_AUTH_HEADER' }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyJWT(token);
    if (!payload) {
      log('jwt_verification_failed');
      return json({ success: false, error: 'INVALID_AUTH' }, 401);
    }

    log('jwt_verified', { user_id: payload.sub });

    // Parse body
    const body = (await req.json()) as NotifyRequest;
    log('request_parsed', { order_id: body.order_id, new_status: body.new_status });

    if (!body.order_id || !body.new_status) {
      log('invalid_payload');
      return json({ success: false, error: 'INVALID_PAYLOAD' }, 400);
    }

    // Skip PENDING status
    if (body.new_status === 'PENDING' || !NOTIFY_STATUSES.has(body.new_status)) {
      log('status_not_notifiable', { status: body.new_status });
      return json({ success: true, enqueued: false, detail: 'Status does not require notification' });
    }

    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      log('missing_supabase_config');
      return json({
        success: false,
        error: 'SERVER_MISCONFIGURED',
        detail: 'Supabase credentials not configured',
      }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, customer_id, status')
      .eq('id', body.order_id)
      .is('deleted_at', null)
      .single();

    if (orderError || !order) {
      log('order_not_found', { error: orderError?.message });
      return json({
        success: false,
        error: 'ORDER_NOT_FOUND',
        detail: 'Order does not exist',
      }, 404);
    }

    // Fetch customer email
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('name, email')
      .eq('id', order.customer_id)
      .single();

    if (customerError || !customer) {
      log('customer_not_found', { error: customerError?.message });
      return json({
        success: false,
        error: 'CUSTOMER_NOT_FOUND',
        detail: 'Customer not found for this order',
      }, 404);
    }

    // Enqueue notification
    const idempotencyKey = `ORDER_STATUS_UPDATE_CUSTOMER:${body.order_id}:${body.new_status}`;
    const payload_data = {
      customerName: customer.name,
      orderNumber: order.order_number,
      newStatus: body.new_status,
    };

    const { data: enqueueResult, error: enqueueError } = await supabase.rpc(
      'enqueue_notification',
      {
        p_idempotency_key: idempotencyKey,
        p_type: 'ORDER_STATUS_UPDATE_CUSTOMER',
        p_recipient_email: customer.email,
        p_payload: payload_data,
        p_priority: 1,
      }
    );

    if (enqueueError) {
      log('enqueue_failed', { error: enqueueError.message });
      return json({
        success: true,
        enqueued: false,
        detail: enqueueError.message,
      });
    }

    log('notification_enqueued', { job_id: enqueueResult?.job_id });
    return json({ success: true, enqueued: true });
  } catch (err) {
    log('unhandled_error', { error: String(err) });
    return json({ success: false, error: 'INTERNAL_ERROR' }, 500);
  }
});
