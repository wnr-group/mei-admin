import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createEmailProvider } from '../_shared/email-provider.ts';
import { renderTemplate } from '../_shared/email-templates.ts';
import type { NotificationJob } from '../_shared/notification-types.ts';
import { logNotification } from '../_shared/log.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-worker-secret',
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
    service: 'notification-worker',
    environment: Deno.env.get('ENVIRONMENT') ?? 'unknown',
    ts: new Date().toISOString(),
    ...fields,
  }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  // Note: verify_jwt is enabled on this function, so Supabase already validates JWT tokens.
  // If using custom x-worker-secret header from pg_cron, we'll accept it here too.
  const callerSecret = req.headers.get('x-worker-secret');
  const workerSecret = Deno.env.get('WORKER_SECRET');

  if (!workerSecret) {
    structuredLog({ event: 'config_error', error: 'WORKER_SECRET not set' });
    return json({ error: 'SERVER_MISCONFIGURED' }, 500);
  }

  // Reject if header is missing or doesn't match: null !== 'secret' is true, so unauthenticated requests fail
  if (callerSecret !== workerSecret) {
    structuredLog({ event: 'auth_failed', reason: 'invalid_worker_secret', has_header: callerSecret !== null });
    return json({ error: 'UNAUTHORIZED' }, 401);
  }

  const runId = crypto.randomUUID();
  const batchSize = parseInt(Deno.env.get('WORKER_BATCH_SIZE') ?? '20', 10);

  structuredLog({ event: 'worker_start', runId, batchSize });

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Claim jobs atomically (SELECT FOR UPDATE SKIP LOCKED)
  const { data: jobs, error: claimError } = await db.rpc('claim_notification_jobs', {
    p_batch_size: batchSize,
  });

  if (claimError) {
    structuredLog({ event: 'claim_failed', runId, error: claimError.message });
    return json({ error: 'CLAIM_FAILED', detail: claimError.message }, 500);
  }

  const claimed = (jobs ?? []) as NotificationJob[];
  structuredLog({ event: 'claimed', runId, count: claimed.length });

  if (claimed.length === 0) {
    return json({ processed: 0, runId });
  }

  const provider = createEmailProvider();
  const results: Array<{ jobId: string; status: 'sent' | 'failed'; error?: string }> = [];

  for (const job of claimed) {
    const jobLog = (event: string, extra?: Record<string, unknown>) =>
      structuredLog({ event, runId, jobId: job.id, type: job.type, attempt: job.attempts + 1, ...extra });

    const start = Date.now();
    const correlationId = (job.payload?.correlationId as string) ?? job.id;
    const baseFields = {
      correlation_id: correlationId,
      notification_type: job.type,
      customer_email: job.recipient_email,
      order_id: (job.payload?.orderId as string) ?? null,
      order_number: (job.payload?.orderNumber as string) ?? null,
      customer_id: (job.payload?.customerId as string) ?? null,
      customer_phone: (job.payload?.customerPhone as string) ?? null,
      provider: 'mailgun',
    };

    logNotification('notification-worker', { event: 'provider_request_started', ...baseFields });

    try {
      const { subject, html } = renderTemplate(job.type, job.payload);
      const messageId = await provider.send({ to: job.recipient_email, subject, html });

      await db.rpc('complete_notification_job', {
        p_job_id: job.id,
        p_provider_message_id: messageId,
      });

      logNotification('notification-worker', {
        event: 'provider_request_success',
        ...baseFields,
        provider_message_id: messageId,
      });
      jobLog('job_sent', { messageId, durationMs: Date.now() - start });
      results.push({ jobId: job.id, status: 'sent' });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await db.rpc('fail_notification_job', { p_job_id: job.id, p_error: errMsg });

      logNotification('notification-worker', {
        event: 'provider_request_failed',
        ...baseFields,
        error_message: errMsg,
        error_code: errMsg.match(/Mailgun (\d{3})/)?.[1] ?? null,
      });
      jobLog('job_failed', { error: errMsg, durationMs: Date.now() - start });
      results.push({ jobId: job.id, status: 'failed', error: errMsg });
    }
  }

  const sent = results.filter((r) => r.status === 'sent').length;
  const failed = results.filter((r) => r.status === 'failed').length;

  structuredLog({ event: 'worker_complete', runId, sent, failed, total: claimed.length });

  return json({ processed: claimed.length, sent, failed, runId });
});
