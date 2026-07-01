import { createClient } from 'jsr:@supabase/supabase-js@2';

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

function structuredLog(fields: Record<string, unknown>) {
  console.log(JSON.stringify({
    service: 'enquiry-notify',
    ts: new Date().toISOString(),
    ...fields,
  }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ success: false, error: 'METHOD_NOT_ALLOWED' }, 405);

  const enquiryId = crypto.randomUUID();

  // Verify storefront secret
  const storefrontSecret = Deno.env.get('STOREFRONT_API_SECRET');
  const callerSecret = req.headers.get('x-storefront-secret');
  if (!storefrontSecret || callerSecret !== storefrontSecret) {
    structuredLog({ event: 'auth_failed', enquiry_id: enquiryId, reason: 'invalid_secret' });
    return json({ success: false, error: 'UNAUTHORIZED' }, 401);
  }

  const body = await req.json().catch(() => null);
  if (!body?.enquiry_id) {
    structuredLog({ event: 'validation_failed', reason: 'missing_enquiry_id' });
    return json({ success: false, error: 'INVALID_PAYLOAD' }, 400);
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
    structuredLog({ event: 'enquiry_not_found', enquiry_id: body.enquiry_id, error: error?.message });
    return json({ success: false, error: 'ENQUIRY_NOT_FOUND' }, 404);
  }

  structuredLog({ event: 'enquiry_fetched', enquiry_id: body.enquiry_id, customer_email: enquiry.email });

  const adminEmail = Deno.env.get('ADMIN_EMAIL');
  const adminUrl = Deno.env.get('ADMIN_URL') ?? '';

  // Enqueue customer receipt notification
  const customerPayload = {
    name: enquiry.name,
    message: enquiry.message,
  };

  const { data: customerResult, error: customerError } = await db.rpc('enqueue_notification', {
    p_idempotency_key: `ENQUIRY_RECEIPT_CUSTOMER:${body.enquiry_id}`,
    p_type: 'ENQUIRY_RECEIPT_CUSTOMER',
    p_recipient_email: enquiry.email,
    p_payload: customerPayload,
  });

  if (customerError) {
    structuredLog({
      event: 'customer_enqueue_failed',
      enquiry_id: body.enquiry_id,
      error: customerError.message
    });
  } else {
    structuredLog({
      event: 'customer_enqueued',
      enquiry_id: body.enquiry_id,
      job_id: (customerResult as Record<string, unknown>)?.job_id,
      enqueued: (customerResult as Record<string, unknown>)?.enqueued,
    });
  }

  // Enqueue admin notification if admin email is set
  let adminResult = null;
  let adminError = null;

  if (adminEmail) {
    const adminPayload = {
      name: enquiry.name,
      email: enquiry.email,
      phone: enquiry.phone ?? null,
      message: enquiry.message,
      occasion: enquiry.occasion ?? null,
      budget: enquiry.budget ?? null,
      adminEnquiryUrl: `${adminUrl}/enquiries/${body.enquiry_id}`,
    };

    const result = await db.rpc('enqueue_notification', {
      p_idempotency_key: `ENQUIRY_ADMIN_NOTIFICATION:${body.enquiry_id}`,
      p_type: 'ENQUIRY_ADMIN_NOTIFICATION',
      p_recipient_email: adminEmail,
      p_payload: adminPayload,
    });

    adminResult = result.data;
    adminError = result.error;
  }

  if (adminError) {
    structuredLog({
      event: 'admin_enqueue_failed',
      enquiry_id: body.enquiry_id,
      error: adminError.message
    });
  } else if (adminEmail) {
    structuredLog({
      event: 'admin_enqueued',
      enquiry_id: body.enquiry_id,
      job_id: (adminResult as Record<string, unknown>)?.job_id,
      enqueued: (adminResult as Record<string, unknown>)?.enqueued,
    });
  }

  structuredLog({
    event: 'enquiry_notify_complete',
    enquiry_id: body.enquiry_id,
    customer_queued: !customerError,
    admin_queued: !adminError || !adminEmail,
  });

  return json({ success: true });
});
