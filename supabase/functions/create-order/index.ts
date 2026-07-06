import { createClient } from 'jsr:@supabase/supabase-js@2';
import { logNotification } from '../_shared/log.ts';
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
    const bypass = Deno.env.get('ENABLE_PAYMENT_BYPASS') === 'true';
    log('environment check', {
      bypass_enabled: bypass,
      has_supabase_url: !!Deno.env.get('SUPABASE_URL'),
      has_service_role: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      has_razorpay_secret: !!Deno.env.get('RAZORPAY_KEY_SECRET')
    });
    // Handle bypass mode early - no signature verification or database access needed
    if (bypass) {
      log('bypass mode — signature verification and database calls skipped');
      return jsonResponse({
        success: true,
        order_id: crypto.randomUUID(),
        order_number: `BYPASS-${Date.now()}`,
        total: body.items.reduce((sum, item)=>sum + (Number(item.quantity) || 0), 0)
      }, 200, {
        'x-request-id': requestId
      });
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
    // Enqueue notifications (idempotent — safe to call even for already_exists)
    if (!data.already_exists) {
      const adminEmail = Deno.env.get('ADMIN_EMAIL');
      const adminUrl = Deno.env.get('ADMIN_URL') ?? '';
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
        const customerPayload = {
          correlationId: requestId,
          customerName: body.customer.name,
          orderNumber: data.order_number,
          items: body.items.map((i)=>({
              name: i.name,
              quantity: i.quantity
            })),
          total: Number(data.total)
        };
        const adminPayload = {
          correlationId: requestId,
          customerName: body.customer.name,
          customerEmail: body.customer.email,
          customerPhone: body.customer.phone ?? null,
          orderNumber: data.order_number,
          total: Number(data.total),
          adminOrderUrl: `${adminUrl}/orders/${data.order_id}`
        };
        const customerKey = `ORDER_CONFIRMATION_CUSTOMER:${data.order_id}`;
        const adminKey = `ORDER_CONFIRMATION_ADMIN:${data.order_id}`;
        const enqueueFields = {
          correlation_id: requestId,
          order_id: String(data.order_id),
          order_number: data.order_number,
          customer_email: body.customer.email,
          customer_phone: body.customer.phone ?? null,
          provider: 'queue'
        };
        logNotification('create-order', {
          event: 'notification_enqueue_started',
          ...enqueueFields,
          notification_type: 'ORDER_CONFIRMATION_CUSTOMER'
        });
        // Direct table insert instead of supabase.rpc('enqueue_notification') to avoid
        // a PostgREST limitation: the RPC has a `notification_type` ENUM parameter, and
        // PostgREST passes JSON strings as `text`, which PostgreSQL cannot implicitly cast
        // to a user-defined ENUM for function argument resolution. Table upsert uses the
        // column's own type context (assignment cast), which accepts text → ENUM correctly.
        const enqueueCustomer = supabase.from('notification_jobs').upsert({
          idempotency_key: customerKey,
          type: 'ORDER_CONFIRMATION_CUSTOMER',
          recipient_email: body.customer.email,
          payload: customerPayload,
          priority: 1
        }, {
          onConflict: 'idempotency_key',
          ignoreDuplicates: true
        }).then(({ error })=>{
          if (error) {
            logNotification('create-order', {
              event: 'notification_enqueue_failed',
              ...enqueueFields,
              notification_type: 'ORDER_CONFIRMATION_CUSTOMER',
              error_message: error.message,
              error_code: error.code ?? null
            });
          } else {
            logNotification('create-order', {
              event: 'notification_enqueue_success',
              ...enqueueFields,
              notification_type: 'ORDER_CONFIRMATION_CUSTOMER'
            });
          }
        });
        let enqueueAdmin;
        if (adminEmail) {
          logNotification('create-order', {
            event: 'notification_enqueue_started',
            ...enqueueFields,
            notification_type: 'ORDER_CONFIRMATION_ADMIN'
          });
          enqueueAdmin = supabase.from('notification_jobs').upsert({
            idempotency_key: adminKey,
            type: 'ORDER_CONFIRMATION_ADMIN',
            recipient_email: adminEmail,
            payload: adminPayload,
            priority: 1
          }, {
            onConflict: 'idempotency_key',
            ignoreDuplicates: true
          }).then(({ error })=>{
            if (error) {
              logNotification('create-order', {
                event: 'notification_enqueue_failed',
                ...enqueueFields,
                notification_type: 'ORDER_CONFIRMATION_ADMIN',
                error_message: error.message,
                error_code: error.code ?? null
              });
            } else {
              logNotification('create-order', {
                event: 'notification_enqueue_success',
                ...enqueueFields,
                notification_type: 'ORDER_CONFIRMATION_ADMIN'
              });
            }
          });
        } else {
          enqueueAdmin = Promise.resolve();
        }
        // Await enqueue before returning — Edge Function isolate is killed when the response
        // is sent, so fire-and-forget fetch() calls are dropped before they complete.
        await Promise.allSettled([
          enqueueCustomer,
          enqueueAdmin
        ]).then((results)=>{
          results.forEach((r, i)=>{
            if (r.status === 'rejected') log('enqueue_settled_error', {
              index: i,
              reason: String(r.reason)
            });
          });
        });
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
