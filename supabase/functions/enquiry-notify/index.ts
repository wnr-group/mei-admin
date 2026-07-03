import { createClient } from 'jsr:@supabase/supabase-js@2';
import { logNotification } from '../_shared/log.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-storefront-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ success: false, error: 'METHOD_NOT_ALLOWED' }, 405);

  const correlationId = req.headers.get('x-request-id') ?? crypto.randomUUID();

  const log = (event: string, extra?: Record<string, unknown>) =>
    logNotification('enquiry-notify', { event, correlation_id: correlationId, ...extra });

  const storefrontSecret = Deno.env.get('STOREFRONT_API_SECRET');
  const callerSecret = req.headers.get('x-storefront-secret');
  if (!storefrontSecret || callerSecret !== storefrontSecret) {
    log('auth_failed', { reason: 'invalid_secret' });
    return json({ success: false, error: 'UNAUTHORIZED' }, 401);
  }

  const body = await req.json().catch(() => null);
  if (!body?.enquiry_id) {
    log('validation_failed', { reason: 'missing_enquiry_id' });
    return json({ success: false, error: 'INVALID_PAYLOAD' }, 400);
  }

  const enabled = Deno.env.get('NOTIFICATIONS_ENABLED') === 'true';
  if (!enabled) {
    log('notifications_disabled', { enquiry_id: body.enquiry_id });
    return json({ success: true });
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: enquiry, error } = await db
    .from('enquiries')
    .select('name, email, phone, message, occasion, budget')
    .eq('id', body.enquiry_id)
    .single();

  if (error || !enquiry) {
    log('enquiry_not_found', { enquiry_id: body.enquiry_id, error: error?.message });
    return json({ success: false, error: 'ENQUIRY_NOT_FOUND' }, 404);
  }

  log('enquiry_fetched', { enquiry_id: body.enquiry_id, customer_email: enquiry.email });

  const adminEmail = Deno.env.get('ADMIN_EMAIL');
  const adminUrl = Deno.env.get('ADMIN_URL') ?? '';

  // Direct upsert — avoids PostgREST text→ENUM casting failure that affects RPC calls.
  // See create-order/index.ts for the documented explanation of this pattern.

  const customerPayload = {
    correlationId,
    name: enquiry.name,
    message: enquiry.message,
  };

  logNotification('enquiry-notify', {
    event: 'notification_enqueue_started',
    correlation_id: correlationId,
    notification_type: 'ENQUIRY_RECEIPT_CUSTOMER',
    customer_email: enquiry.email,
  });

  const { error: customerError } = await db
    .from('notification_jobs')
    .upsert(
      {
        idempotency_key: `ENQUIRY_RECEIPT_CUSTOMER:${body.enquiry_id}`,
        type: 'ENQUIRY_RECEIPT_CUSTOMER',
        recipient_email: enquiry.email,
        payload: customerPayload,
        priority: 1,
      },
      { onConflict: 'idempotency_key', ignoreDuplicates: true }
    );

  if (customerError) {
    logNotification('enquiry-notify', {
      event: 'notification_enqueue_failed',
      correlation_id: correlationId,
      notification_type: 'ENQUIRY_RECEIPT_CUSTOMER',
      customer_email: enquiry.email,
      error_message: customerError.message,
      error_code: customerError.code ?? null,
    });
  } else {
    logNotification('enquiry-notify', {
      event: 'notification_enqueue_success',
      correlation_id: correlationId,
      notification_type: 'ENQUIRY_RECEIPT_CUSTOMER',
      customer_email: enquiry.email,
    });
  }

  if (adminEmail) {
    const adminPayload = {
      correlationId,
      name: enquiry.name,
      email: enquiry.email,
      phone: enquiry.phone ?? null,
      message: enquiry.message,
      occasion: enquiry.occasion ?? null,
      budget: enquiry.budget ?? null,
      adminEnquiryUrl: `${adminUrl}/enquiries/${body.enquiry_id}`,
    };

    logNotification('enquiry-notify', {
      event: 'notification_enqueue_started',
      correlation_id: correlationId,
      notification_type: 'ENQUIRY_ADMIN_NOTIFICATION',
      customer_email: adminEmail,
    });

    const { error: adminError } = await db
      .from('notification_jobs')
      .upsert(
        {
          idempotency_key: `ENQUIRY_ADMIN_NOTIFICATION:${body.enquiry_id}`,
          type: 'ENQUIRY_ADMIN_NOTIFICATION',
          recipient_email: adminEmail,
          payload: adminPayload,
          priority: 1,
        },
        { onConflict: 'idempotency_key', ignoreDuplicates: true }
      );

    if (adminError) {
      logNotification('enquiry-notify', {
        event: 'notification_enqueue_failed',
        correlation_id: correlationId,
        notification_type: 'ENQUIRY_ADMIN_NOTIFICATION',
        customer_email: adminEmail,
        error_message: adminError.message,
        error_code: adminError.code ?? null,
      });
    } else {
      logNotification('enquiry-notify', {
        event: 'notification_enqueue_success',
        correlation_id: correlationId,
        notification_type: 'ENQUIRY_ADMIN_NOTIFICATION',
        customer_email: adminEmail,
      });
    }
  }

  log('enquiry_notify_complete', { enquiry_id: body.enquiry_id });
  return json({ success: true });
});
