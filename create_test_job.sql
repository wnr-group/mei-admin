-- Create a fresh test notification job
SELECT public.enqueue_notification(
  p_idempotency_key := 'TEST_FINAL_' || gen_random_uuid(),
  p_type := 'ORDER_CONFIRMATION_CUSTOMER'::public.notification_type,
  p_recipient_email := 'eshwarpaygude@gmail.com',
  p_payload := jsonb_build_object(
    'customerName', 'Test Final',
    'orderNumber', 'TEST-FINAL',
    'items', jsonb_build_array(jsonb_build_object('name', 'Test Item', 'quantity', 1)),
    'total', 5000
  ),
  p_priority := 1
);
