import { createClient } from 'jsr:@supabase/supabase-js@2';
import { logNotification } from '../_shared/log.ts';
import { createEmailProvider } from '../_shared/email-provider.ts';
import { renderTemplate } from '../_shared/email-templates.ts';

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
  const provider = createEmailProvider();

  const sends: Array<{ type: string; to: string; payload: Record<string, unknown> }> = [
    {
      type: 'ENQUIRY_RECEIPT_CUSTOMER',
      to: enquiry.email,
      payload: {
        correlationId,
        name: enquiry.name,
        message: enquiry.message,
      },
    },
  ];

  if (adminEmail) {
    sends.push({
      type: 'ENQUIRY_ADMIN_NOTIFICATION',
      to: adminEmail,
      payload: {
        correlationId,
        name: enquiry.name,
        email: enquiry.email,
        phone: enquiry.phone ?? null,
        message: enquiry.message,
        occasion: enquiry.occasion ?? null,
        budget: enquiry.budget ?? null,
        adminEnquiryUrl: `${adminUrl}/enquiries/${body.enquiry_id}`,
      },
    });
  }

  // Send sequentially — the Mailgun sandbox rejects concurrent requests with a
  // spurious 401. Await before returning: the isolate is killed once the response is sent.
  for (const s of sends) {
    logNotification('enquiry-notify', {
      event: 'provider_request_started',
      correlation_id: correlationId,
      notification_type: s.type,
      customer_email: s.to,
    });
    try {
      const { subject, html } = renderTemplate(s.type, s.payload);
      const messageId = await provider.send({ to: s.to, subject, html });
      logNotification('enquiry-notify', {
        event: 'provider_request_success',
        correlation_id: correlationId,
        notification_type: s.type,
        customer_email: s.to,
        provider_message_id: messageId,
      });
    } catch (err) {
      logNotification('enquiry-notify', {
        event: 'provider_request_failed',
        correlation_id: correlationId,
        notification_type: s.type,
        customer_email: s.to,
        error_message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  log('enquiry_notify_complete', { enquiry_id: body.enquiry_id });
  return json({ success: true });
});
