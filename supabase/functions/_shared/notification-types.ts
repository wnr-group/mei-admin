export type NotificationJobStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SENT'
  | 'RETRYING'
  | 'DEAD'
  | 'CANCELLED';

export type NotificationType =
  | 'ORDER_CONFIRMATION_CUSTOMER'
  | 'ORDER_CONFIRMATION_ADMIN'
  | 'ORDER_STATUS_UPDATE_CUSTOMER'
  | 'ENQUIRY_RECEIPT_CUSTOMER'
  | 'ENQUIRY_ADMIN_NOTIFICATION';

export interface NotificationJob {
  id: string;
  idempotency_key: string;
  type: NotificationType;
  recipient_email: string;
  payload: Record<string, unknown>;
  status: NotificationJobStatus;
  priority: number;
  attempts: number;
  max_attempts: number;
  next_attempt_at: string;
  last_error: string | null;
  provider_message_id: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EnqueueResult {
  enqueued: boolean;
  reason?: 'RATE_LIMITED' | 'DUPLICATE';
  job_id?: string;
}

export interface SendOptions {
  to: string;
  subject: string;
  html: string;
}

export interface EmailProvider {
  /** Send an email. Returns the provider-assigned message ID. */
  send(opts: SendOptions): Promise<string>;
}
