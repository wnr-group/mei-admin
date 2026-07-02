import { assertEquals } from 'jsr:@std/assert@1';
import { buildLogLine } from './log.ts';

Deno.test('buildLogLine always includes every required field, defaulting to null', () => {
  const line = buildLogLine('notification-worker', {
    event: 'provider_request_success',
    correlation_id: 'corr-1',
    notification_type: 'ORDER_CONFIRMATION_CUSTOMER',
    provider: 'mailgun',
    provider_message_id: 'abc@mg',
  });
  const obj = JSON.parse(line);
  for (const k of [
    'order_id', 'order_number', 'customer_id', 'customer_email', 'customer_phone',
    'notification_type', 'provider', 'provider_message_id', 'error_code',
    'error_message', 'correlation_id', 'event', 'service', 'ts',
  ]) {
    assertEquals(k in obj, true, `missing field ${k}`);
  }
  assertEquals(obj.order_id, null);
  assertEquals(obj.provider_message_id, 'abc@mg');
  assertEquals(obj.event, 'provider_request_success');
});
