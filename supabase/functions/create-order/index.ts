import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-request-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(data: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extra },
  });
}

async function verifyRazorpaySignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    enc.encode(`${razorpayOrderId}|${razorpayPaymentId}`)
  );
  const hex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hex === signature;
}

interface OrderItem {
  product_id: string;
  name: string;
  quantity: number;
}

interface PaymentInfo {
  provider: string;
  payment_id: string;
  order_id: string;
  signature: string;
}

interface CreateOrderRequest {
  customer: { name: string; email: string; phone: string; city: string };
  items: OrderItem[];
  shipping_address: Record<string, string>;
  payment: PaymentInfo;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'METHOD_NOT_ALLOWED' }, 405);
  }

  const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID();
  const log = (msg: string, data?: Record<string, unknown>) =>
    console.log(JSON.stringify({ requestId, msg, ...(data ?? {}) }));

  log('create-order started');

  try {
    log('request received');

    const body = (await req.json()) as CreateOrderRequest;
    log('payload parsed', { has_customer: !!body.customer, has_items: !!body.items, has_payment: !!body.payment });

    if (!body.customer?.email || !body.items?.length || !body.payment?.payment_id) {
      log('invalid payload');
      return jsonResponse({ success: false, error: 'INVALID_PAYLOAD' }, 400);
    }

    const bypass = Deno.env.get('ENABLE_PAYMENT_BYPASS') === 'true';
    log('environment check', {
      bypass_enabled: bypass,
      has_supabase_url: !!Deno.env.get('SUPABASE_URL'),
      has_service_role: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      has_razorpay_secret: !!Deno.env.get('RAZORPAY_KEY_SECRET'),
    });

    // Handle bypass mode early - no signature verification or database access needed
    if (bypass) {
      log('bypass mode — signature verification and database calls skipped');
      return jsonResponse(
        {
          success: true,
          order_id: crypto.randomUUID(),
          order_number: `BYPASS-${Date.now()}`,
          total: body.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
        },
        200,
        { 'x-request-id': requestId }
      );
    }

    // Production mode: verify signature
    const secret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!secret) {
      log('RAZORPAY_KEY_SECRET not configured');
      return jsonResponse({
        success: false,
        error: 'SERVER_MISCONFIGURED',
        detail: 'RAZORPAY_KEY_SECRET not set'
      }, 500);
    }

    const valid = await verifyRazorpaySignature(
      body.payment.order_id,
      body.payment.payment_id,
      body.payment.signature,
      secret
    );
    if (!valid) {
      log('HMAC verification failed', { payment_id: body.payment.payment_id });
      return jsonResponse({ success: false, error: 'PAYMENT_VERIFICATION_FAILED' }, 400);
    }
    log('HMAC verified', { payment_id: body.payment.payment_id });

    // Production mode: verify Supabase credentials
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      log('missing supabase credentials', {
        url_missing: !supabaseUrl,
        key_missing: !serviceRoleKey,
      });
      return jsonResponse({
        success: false,
        error: 'SERVER_MISCONFIGURED',
        detail: `Missing: ${!supabaseUrl ? 'SUPABASE_URL ' : ''}${!serviceRoleKey ? 'SUPABASE_SERVICE_ROLE_KEY' : ''}`.trim(),
      }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    log('supabase client created');

    const { data, error } = await supabase.rpc('create_order_txn', {
      p_customer: body.customer,
      p_items: body.items,
      p_shipping_address: body.shipping_address,
      p_payment_id: body.payment.payment_id,
      p_payment_provider: body.payment.provider,
      p_payment_metadata: {
        razorpay_order_id: body.payment.order_id,
        razorpay_signature: body.payment.signature,
        request_id: requestId,
      },
    });

    if (error) {
      log('RPC error', {
        message: error.message,
        code: (error as any).code,
        details: (error as any).details,
      });
      if (error.message?.includes('PRODUCT_NOT_FOUND')) {
        return jsonResponse({ success: false, error: 'PRODUCT_NOT_FOUND' }, 400);
      }
      return jsonResponse({
        success: false,
        error: 'ORDER_CREATION_FAILED',
        detail: error.message,
      }, 500);
    }

    log('order created', {
      order_id: String(data.order_id),
      already_exists: String(data.already_exists),
    });

    return jsonResponse(
      {
        success: true,
        order_id: data.order_id,
        order_number: data.order_number,
        total: data.total,
      },
      200,
      { 'x-request-id': requestId }
    );
  } catch (err) {
    log('unhandled error', { message: String(err) });
    return jsonResponse({ success: false, error: 'INTERNAL_ERROR' }, 500);
  }
});
