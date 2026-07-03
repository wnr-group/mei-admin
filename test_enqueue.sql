-- Test the enqueue_notification RPC directly
SELECT public.enqueue_notification(
  p_idempotency_key := 'TEST_DEBUG_001',
  p_type := 'ORDER_CONFIRMATION_CUSTOMER'::public.notification_type,
  p_recipient_email := 'eshwarpaygude@gmail.com',
  p_payload := jsonb_build_object(
    'customerName', 'Debug Test',
    'orderNumber', 'DEBUG-001',
    'items', jsonb_build_array(
      jsonb_build_object('name', 'Test Item', 'quantity', 1)
    ),
    'total', 1000
  ),
  p_priority := 1
);

-- Check if job was created
SELECT id, status, recipient_email, type, created_at
FROM notification_jobs
WHERE idempotency_key = 'TEST_DEBUG_001';
