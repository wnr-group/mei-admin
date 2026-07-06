import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: rows, error } = await db
    .from('notification_health')
    .select('status, count');

  if (error) {
    return json({ error: 'DB_ERROR', detail: error.message }, 500);
  }

  const counts: Record<string, number> = {};
  for (const row of rows ?? []) {
    counts[row.status as string] = Number(row.count);
  }

  const deadCount    = counts['DEAD']       ?? 0;
  const retryCount   = counts['RETRYING']   ?? 0;
  const pendingCount = counts['PENDING']     ?? 0;
  const sentCount    = counts['SENT']        ?? 0;

  const systemStatus =
    deadCount > 0   ? 'critical' :
    retryCount > 5  ? 'degraded' :
    'ok';

  return json({
    status:        systemStatus,
    dead_count:    deadCount,
    retrying_count: retryCount,
    pending_count:  pendingCount,
    sent_24h:      sentCount,
    ts:            new Date().toISOString(),
  });
});
