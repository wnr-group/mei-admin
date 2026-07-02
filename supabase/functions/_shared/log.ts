// Shared structured logger for the notification pipeline (Phase 6).
export type NotificationEvent =
  | 'notification_enqueue_started'
  | 'notification_enqueue_success'
  | 'notification_enqueue_failed'
  | 'provider_request_started'
  | 'provider_request_success'
  | 'provider_request_failed';

export interface NotificationLogFields {
  event: NotificationEvent;
  correlation_id: string;
  order_id?: string | null;
  order_number?: string | null;
  customer_id?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  notification_type?: string | null;
  provider?: string | null;
  provider_message_id?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  [k: string]: unknown;
}

export function buildLogLine(service: string, fields: NotificationLogFields): string {
  const required = {
    order_id: null as unknown,
    order_number: null as unknown,
    customer_id: null as unknown,
    customer_email: null as unknown,
    customer_phone: null as unknown,
    notification_type: null as unknown,
    provider: null as unknown,
    provider_message_id: null as unknown,
    error_code: null as unknown,
    error_message: null as unknown,
  };
  return JSON.stringify({
    service,
    environment: Deno.env.get('ENVIRONMENT') ?? 'unknown',
    ts: new Date().toISOString(),
    ...required,
    ...fields,
  });
}

export function logNotification(service: string, fields: NotificationLogFields): void {
  console.log(buildLogLine(service, fields));
}
