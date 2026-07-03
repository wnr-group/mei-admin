// Shared structured logger for the notification pipeline (Phase 6).
export function buildLogLine(service: string, fields: Record<string, unknown>) {
  const required = {
    order_id: null,
    order_number: null,
    customer_id: null,
    customer_email: null,
    customer_phone: null,
    notification_type: null,
    provider: null,
    provider_message_id: null,
    error_code: null,
    error_message: null
  };
  return JSON.stringify({
    service,
    environment: Deno.env.get('ENVIRONMENT') ?? 'unknown',
    ts: new Date().toISOString(),
    ...required,
    ...fields
  });
}
export function logNotification(service: string, fields: Record<string, unknown>) {
  console.log(buildLogLine(service, fields));
}
