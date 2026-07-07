import { createClient } from 'jsr:@supabase/supabase-js@2';
import { logNotification } from '../_shared/log.ts';
import { createEmailProvider } from '../_shared/email-provider.ts';
import { renderTemplate } from '../_shared/email-templates.ts';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
function jsonResponse(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...extra
    }
  });
}
async function verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, signature, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), {
    name: 'HMAC',
    hash: 'SHA-256'
  }, false, [
    'sign'
  ]);
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${razorpayOrderId}|${razorpayPaymentId}`));
  const hex = Array.from(new Uint8Array(mac)).map((b)=>b.toString(16).padStart(2, '0')).join('');
  return hex === signature;
}
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') return new Response('ok', {
    headers: corsHeaders
  });
  if (req.method !== 'POST') {
    return jsonResponse({
      success: false,
      error: 'METHOD_NOT_ALLOWED'
    }, 405);
  }
  const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID();
  const log = (msg, data)=>console.log(JSON.stringify({
      requestId,
      msg,
      ...data ?? {}
    }));
  log('create-order started');
  try {
    log('request received');
    const body = await req.json();
    log('payload parsed', {
      has_customer: !!body.customer,
      has_items: !!body.items,
      has_payment: !!body.payment
    });
    if (!body.customer?.email || !body.items?.length || !body.payment?.payment_id) {
      log('invalid payload');
      return jsonResponse({
        success: false,
        error: 'INVALID_PAYLOAD'
      }, 400);
    }
    log('environment check', {
      has_supabase_url: !!Deno.env.get('SUPABASE_URL'),
      has_service_role: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      has_razorpay_secret: !!Deno.env.get('RAZORPAY_KEY_SECRET')
    });
    // Verify Razorpay payment signature
    const secret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!secret) {
      log('RAZORPAY_KEY_SECRET not configured');
      return jsonResponse({
        success: false,
        error: 'SERVER_MISCONFIGURED',
        detail: 'RAZORPAY_KEY_SECRET not set'
      }, 500);
    }
    const valid = await verifyRazorpaySignature(body.payment.order_id, body.payment.payment_id, body.payment.signature, secret);
    if (!valid) {
      log('HMAC verification failed', {
        payment_id: body.payment.payment_id
      });
      return jsonResponse({
        success: false,
        error: 'PAYMENT_VERIFICATION_FAILED'
      }, 400);
    }
    log('HMAC verified', {
      payment_id: body.payment.payment_id
    });
    // Production mode: verify Supabase credentials.
    // MEI_DB_URL / MEI_SERVICE_KEY are custom vars used in local dev to point at the hosted
    // project, because Supabase CLI always overrides SUPABASE_URL with the local kong URL.
    const supabaseUrl = Deno.env.get('MEI_DB_URL') ?? Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('MEI_SERVICE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      log('missing supabase credentials', {
        url_missing: !supabaseUrl,
        key_missing: !serviceRoleKey
      });
      return jsonResponse({
        success: false,
        error: 'SERVER_MISCONFIGURED',
        detail: `Missing: ${!supabaseUrl ? 'SUPABASE_URL ' : ''}${!serviceRoleKey ? 'SUPABASE_SERVICE_ROLE_KEY' : ''}`.trim()
      }, 500);
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    log('supabase client created', {
      supabase_url: supabaseUrl
    });
    // Phase 1 diagnostic: log exact payload reaching RPC
    log('rpc payload', {
      item_count: body.items.length,
      product_ids: body.items.map((i)=>i.product_id),
      quantities: body.items.map((i)=>i.quantity)
    });
    const { data, error } = await supabase.rpc('create_order_txn', {
      p_customer: body.customer,
      p_items: body.items,
      p_shipping_address: body.shipping_address,
      p_payment_id: body.payment.payment_id,
      p_payment_provider: body.payment.provider,
      p_payment_metadata: {
        razorpay_order_id: body.payment.order_id,
        razorpay_signature: body.payment.signature,
        request_id: requestId
      }
    });
    if (error) {
      log('RPC error', {
        message: error.message,
        code: error.code,
        details: error.details
      });
      if (error.message?.includes('PRODUCT_NOT_FOUND')) {
        // Extract the failing product_id from the exception message (format: PRODUCT_NOT_FOUND:<uuid>)
        const failingId = error.message.split(':').slice(1).join(':').trim();
        log('product not found', {
          failing_product_id: failingId,
          supabase_url: supabaseUrl
        });
        return jsonResponse({
          success: false,
          error: 'PRODUCT_NOT_FOUND',
          product_id: failingId
        }, 400);
      }
      return jsonResponse({
        success: false,
        error: 'ORDER_CREATION_FAILED',
        detail: error.message
      }, 500);
    }
    log('order created', {
      order_id: String(data.order_id),
      already_exists: String(data.already_exists)
    });
    // Send confirmation emails transactionally (idempotency handled by create_order_txn —
    // already_exists means the order + emails were processed on a prior attempt).
    if (!data.already_exists) {
      const adminEmail = Deno.env.get('ADMIN_EMAIL');
      const adminUrl = Deno.env.get('ADMIN_URL') ?? '';
      const storefrontUrl = Deno.env.get('STOREFRONT_URL') ?? '';
      const enabled = Deno.env.get('NOTIFICATIONS_ENABLED') === 'true';
      log('notifications_config', {
        enabled,
        has_admin_email: !!adminEmail,
        order_id: String(data.order_id),
        order_number: data.order_number,
        customer_email: body.customer.email,
        customer_phone: body.customer.phone ?? null
      });
      if (enabled) {
        const provider = createEmailProvider();
        const baseFields = {
          correlation_id: requestId,
          order_id: String(data.order_id),
          order_number: data.order_number,
          customer_email: body.customer.email,
          customer_phone: body.customer.phone ?? null,
          provider: 'mailgun'
        };

        const sends = [
          {
            type: 'ORDER_CONFIRMATION_CUSTOMER',
            to: body.customer.email,
            payload: {
              customerName: body.customer.name,
              orderNumber: data.order_number,
              items: body.items.map((i)=>({ name: i.name, quantity: i.quantity })),
              total: Number(data.total),
              orderUrl: storefrontUrl ? `${storefrontUrl}/orders/${data.order_id}` : undefined
            }
          }
        ];
        if (adminEmail) {
          sends.push({
            type: 'ORDER_CONFIRMATION_ADMIN',
            to: adminEmail,
            payload: {
              customerName: body.customer.name,
              customerEmail: body.customer.email,
              customerPhone: body.customer.phone ?? null,
              orderNumber: data.order_number,
              total: Number(data.total),
              adminOrderUrl: `${adminUrl}/orders/${data.order_id}`
            }
          });
        }

        // Send sequentially — the Mailgun sandbox rejects concurrent requests with a
        // spurious 401, and for two emails there's no latency benefit to parallelism.
        // Await before returning: the isolate is killed once the response is sent.
        for (const s of sends) {
          logNotification('create-order', {
            event: 'provider_request_started',
            ...baseFields,
            notification_type: s.type
          });
          try {
            const { subject, html } = renderTemplate(s.type, s.payload);
            const messageId = await provider.send({ to: s.to, subject, html });
            logNotification('create-order', {
              event: 'provider_request_success',
              ...baseFields,
              notification_type: s.type,
              provider_message_id: messageId
            });
          } catch (err) {
            logNotification('create-order', {
              event: 'provider_request_failed',
              ...baseFields,
              notification_type: s.type,
              error_message: err instanceof Error ? err.message : String(err)
            });
          }
        }
      }
    }
    return jsonResponse({
      success: true,
      order_id: data.order_id,
      order_number: data.order_number,
      total: data.total
    }, 200, {
      'x-request-id': requestId
    });
  } catch (err) {
    log('unhandled error', {
      message: String(err)
    });
    return jsonResponse({
      success: false,
      error: 'INTERNAL_ERROR'
    }, 500);
  }
});
