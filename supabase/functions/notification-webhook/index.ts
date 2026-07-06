import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function structuredLog(fields: Record<string, unknown>) {
  console.log(JSON.stringify({
    service: 'notification-webhook',
    ts: new Date().toISOString(),
    ...fields,
  }));
}

// Mailgun webhook signature verification.
// Docs: https://documentation.mailgun.com/docs/mailgun/user-manual/tracking-messages/#securing-webhooks
async function verifyMailgunSignature(
  signingKey: string,
  timestamp: string,
  token: string,
  signature: string
): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(signingKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(timestamp + token));
  const hex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hex === signature;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  const signingKey = Deno.env.get('MAILGUN_WEBHOOK_SIGNING_KEY');
  if (!signingKey) {
    structuredLog({ event: 'config_error', error: 'MAILGUN_WEBHOOK_SIGNING_KEY not set' });
    return json({ error: 'SERVER_MISCONFIGURED' }, 500);
  }

  // Mailgun webhooks send multipart/form-data
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: 'INVALID_CONTENT_TYPE' }, 400);
  }

  const timestamp = form.get('timestamp') as string ?? '';
  const token     = form.get('token')     as string ?? '';
  const signature = form.get('signature') as string ?? '';

  if (!timestamp || !token || !signature) {
    structuredLog({ event: 'missing_signature_fields' });
    return json({ error: 'MISSING_SIGNATURE_FIELDS' }, 400);
  }

  // Reject stale webhooks (> 5 minutes old)
  const webhookAge = Date.now() / 1000 - parseInt(timestamp, 10);
  if (webhookAge > 300) {
    structuredLog({ event: 'stale_webhook', ageSeconds: Math.round(webhookAge) });
    return json({ error: 'STALE_WEBHOOK' }, 400);
  }

  const valid = await verifyMailgunSignature(signingKey, timestamp, token, signature);
  if (!valid) {
    structuredLog({ event: 'signature_invalid' });
    return json({ error: 'INVALID_SIGNATURE' }, 401);
  }

  // Extract event fields
  // Mailgun sends event data in different fields depending on legacy vs new webhooks.
  // We support both: top-level fields and nested event-data JSON.
  const eventType      = form.get('event')      as string ?? '';
  const messageId      = (form.get('Message-Id') as string ?? '').replace(/^<|>$/g, '');
  const recipientEmail = form.get('recipient')   as string ?? '';

  // Collect all form fields as the event_data payload
  const eventData: Record<string, string> = {};
  form.forEach((value, key) => {
    if (typeof value === 'string') eventData[key] = value;
  });

  structuredLog({ event: 'webhook_received', eventType, messageId, recipientEmail });

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Find the matching notification job by provider_message_id
  let jobId: string | null = null;
  if (messageId) {
    const { data: job } = await db
      .from('notification_jobs')
      .select('id')
      .eq('provider_message_id', messageId)
      .maybeSingle();
    jobId = job?.id ?? null;
  }

  // Insert delivery event
  const { error: insertError } = await db.from('notification_events').insert({
    job_id:              jobId,
    provider_message_id: messageId || null,
    event_type:          eventType,
    event_data:          eventData,
  });

  if (insertError) {
    structuredLog({ event: 'event_insert_failed', error: insertError.message });
    // Return 200 anyway — Mailgun will retry on non-200, causing duplicate events
  }

  structuredLog({ event: 'webhook_processed', eventType, jobId, messageId });
  return json({ received: true });
});
