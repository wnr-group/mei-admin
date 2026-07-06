# Task 9 Brief — Production Rollout + Definition of Done

**Plan:** docs/superpowers/plans/2026-07-02-email-notification-stabilization.md § Task 9

**Scope:** Final verification. Place one authorized real order (or authorized test order) and verify end-to-end delivery through the entire pipeline: order creation → queue enqueue → worker processing → Mailgun delivery → inbox delivery.

**Definition of Done (from the plan):**
Only mark complete when:
- ✅ Root cause identified with evidence (Task 1: Cause #4 — sandbox domain restriction)
- ✅ Email queue verified (Task 7 TEST 1/2/5/6)
- ✅ Email delivery verified (Task 5: real Mailgun id assigned)
- ✅ Idempotency verified (Task 7 TEST 5)
- ✅ Retry logic verified (Task 7 TEST 2)
- ✅ No duplicate notifications (Task 7 TEST 5)
- ✅ No regressions (Task 8: all features PASS)
- ✅ Logs verified (Task 6: Phase-6 structured logging + correlation_id)
- ✅ Database verified (notification_jobs table state)
- ✅ Provider responses verified (Mailgun logs)
- ✅ End-to-end tests pass (THIS TASK)

---

## Task 9 Steps

### Step 1: Confirm Production Secrets

Verify all required secrets are set and correct in Supabase project `hjhqemsyufsifmgespur`:

```bash
supabase secrets list --project-ref hjhqemsyufsifmgespur | grep -E "NOTIFICATIONS_ENABLED|ENVIRONMENT|MAILGUN|ADMIN|WORKER"
```

Expected values:
- ✅ `NOTIFICATIONS_ENABLED=true`
- ✅ `ENVIRONMENT=production`
- ✅ `MAILGUN_API_KEY` present
- ✅ `MAILGUN_DOMAIN` set to verified sandbox domain
- ✅ `MAILGUN_FROM` set correctly
- ✅ `ADMIN_EMAIL` set
- ✅ `ADMIN_URL` set
- ✅ `WORKER_SECRET` present (matches `app.worker_secret` GUC)

### Step 2: Confirm Cron is Live

Verify pg_cron is running every 2 minutes and returning 200:

```sql
SELECT status_code, status, return_message, created
FROM net._http_response
ORDER BY created DESC LIMIT 5;
```

Expected: all 5 recent responses have `status_code=200`.

### Step 3: End-to-End Production Test

**Place ONE real authorized order:**

Option A (via storefront): Go to `../mei` storefront, add product to cart, checkout with **authorized payment** (or use bypass if available).

Option B (authorized test email): Use `eshwarpaygude@gmail.com` as customer email (confirmed authorized in Mailgun sandbox).

**Expected order response:**
```json
{
  "success": true,
  "order_id": "...",
  "order_number": "...",
  "total": ...
}
```

**Note the:** `order_id`, `order_number`, and timestamp.

### Step 4: Verify Queue Created

Run within 5 minutes of order placement:

```sql
SELECT id, type, recipient_email, status, provider_message_id, created_at
FROM notification_jobs
WHERE order_id = '<order_id_from_step_3>' OR order_number = '<order_number_from_step_3>'
  OR (payload->>'orderNumber')::text = '<order_number_from_step_3>'
ORDER BY created_at DESC LIMIT 5;
```

Expected: 2 rows (CUSTOMER + ADMIN), both initially `status='PENDING'` or `status='SENT'` (depending on worker invocation timing).

**Record:**
- Customer job ID: [id]
- Admin job ID: [id]
- Both have `type` = ORDER_CONFIRMATION_CUSTOMER / ORDER_CONFIRMATION_ADMIN

### Step 5: Verify Worker Processed Jobs

Wait up to 2 minutes for cron to invoke worker (every 2 min), or invoke manually:

```bash
curl -X POST https://hjhqemsyufsifmgespur.supabase.co/functions/v1/notification-worker \
  -H "Content-Type: application/json" \
  -H "x-worker-secret: testing-secret-12345" \
  -d '{}'
```

Expected: `{"processed":>=2,"sent":>=2,"failed":0,...}` (at least 2 jobs sent).

Re-run the query from Step 4:

```sql
SELECT id, status, provider_message_id, sent_at
FROM notification_jobs
WHERE order_id = '<order_id_from_step_3>' OR (payload->>'orderNumber')::text = '<order_number_from_step_3>'
ORDER BY created_at DESC LIMIT 5;
```

Expected: both jobs now `status='SENT'`, both have real Mailgun `provider_message_id` (like `20260702...@sandbox...mailgun.org`), `sent_at` filled.

**Record:**
- Customer message_id: [value]
- Admin message_id: [value]

### Step 6: Verify Worker Logs Show Success

Check worker logs for Phase-6 structured events:

```bash
supabase functions logs notification-worker --project-ref hjhqemsyufsifmgespur
```

Expected: two `provider_request_success` events with:
- `correlation_id` = the order's request ID (threaded through payload)
- `notification_type` = ORDER_CONFIRMATION_CUSTOMER, ORDER_CONFIRMATION_ADMIN
- `provider_message_id` = real Mailgun ids
- No errors

**Record:** copy/paste 2 success event lines (one per job).

### Step 7: Verify Mailgun Delivered

Go to Mailgun Dashboard → Sending → Logs. Filter by recipient email (customer email from order).

**Expected states:**
- Customer email: `delivered` or `accepted` (not `failed`, `bounced`, `suppressed`)
- Admin email (ADMIN_EMAIL): `delivered` or `accepted`

**Record:** status and timestamp for each.

### Step 8: Verify Inbox Delivery

**Check the actual inboxes:**
- Customer email inbox: does it contain the order confirmation email from MEI Bridal Couture?
- Admin email inbox (ADMIN_EMAIL): does it contain the order notification from MEI Bridal Couture?

**Expected subject lines:**
- Customer: "Order confirmed — [order_number]"
- Admin: "New order [order_number] from [customer_name]"

**Record:** YES if both emails received, NO if either missing.

### Step 9: Final Verification Query

```sql
SELECT
  nj.id,
  nj.type,
  nj.status,
  nj.attempts,
  nj.provider_message_id,
  CASE
    WHEN ne.event_type = 'delivered' THEN 'delivered'
    WHEN ne.event_type IS NULL THEN 'no_event_yet'
    ELSE ne.event_type
  END AS mailgun_event
FROM notification_jobs nj
LEFT JOIN notification_events ne ON ne.job_id = nj.id AND ne.event_type = 'delivered'
WHERE (nj.payload->>'orderNumber')::text = '<order_number_from_step_3>'
ORDER BY nj.created_at DESC LIMIT 5;
```

Expected: 2 rows (CUSTOMER + ADMIN), both `status='SENT'`, `attempts=1`, `provider_message_id` filled, `mailgun_event='delivered'` (if webhooks processed) or NULL (if webhooks not yet received).

---

## Report Template

Create `.superpowers/sdd/task-9-report.md`:

```markdown
# Task 9 Report — Production Rollout + Definition of Done

## Production Secrets Verified

- NOTIFICATIONS_ENABLED: true ✅
- ENVIRONMENT: production ✅
- MAILGUN_DOMAIN: [domain] ✅
- MAILGUN_FROM: [value] ✅
- ADMIN_EMAIL: [email] ✅
- ADMIN_URL: [url] ✅
- WORKER_SECRET: present ✅

## Cron Live

Last 5 HTTP responses to cron: all status_code=200 ✅

## End-to-End Test Order

**Order created:**
- Order ID: [id]
- Order number: [number]
- Customer: [name] / [email]
- Total: [amount]
- Timestamp: [time]

## Queue Verified

**Notification jobs created:**
- Customer job ID: [id], type: ORDER_CONFIRMATION_CUSTOMER, status: SENT
- Admin job ID: [id], type: ORDER_CONFIRMATION_ADMIN, status: SENT

**Mailgun message IDs assigned:**
- Customer: [20260702...@mailgun.org]
- Admin: [20260702...@mailgun.org]

## Worker Logs

**provider_request_success events (2):**
```json
{
  "event": "provider_request_success",
  "notification_type": "ORDER_CONFIRMATION_CUSTOMER",
  "provider_message_id": "[customer_id]",
  "correlation_id": "[request_id]",
  ...
}
```

```json
{
  "event": "provider_request_success",
  "notification_type": "ORDER_CONFIRMATION_ADMIN",
  "provider_message_id": "[admin_id]",
  "correlation_id": "[request_id]",
  ...
}
```

## Mailgun Delivery

**Customer email:** delivered ✅
**Admin email:** delivered ✅

## Inbox Delivery

**Customer inbox:** received "Order confirmed — [order_number]" ✅
**Admin inbox:** received "New order [order_number] from [customer_name]" ✅

## Database Final State

```sql
SELECT nj.type, nj.status, nj.attempts, nj.provider_message_id, ne.event_type
FROM notification_jobs nj
LEFT JOIN notification_events ne ON ne.job_id = nj.id
WHERE (nj.payload->>'orderNumber')::text = '[order_number]'
```

Result:
- Customer: status=SENT, attempts=1, message_id=[real_id], event=delivered
- Admin: status=SENT, attempts=1, message_id=[real_id], event=delivered

## Definition of Done Checklist

- [x] Root cause identified (Cause #4: Mailgun sandbox domain)
- [x] Email queue verified (Task 7)
- [x] Email delivery verified (Task 5 + this task)
- [x] WhatsApp out of scope (Plan B)
- [x] Idempotency verified (Task 7 TEST 5)
- [x] Retry logic verified (Task 7 TEST 2)
- [x] No duplicate notifications (Task 7 TEST 5)
- [x] No regressions (Task 8)
- [x] Logs verified (Task 6 + this task)
- [x] Database verified (this task)
- [x] Provider responses verified (this task)
- [x] End-to-end tests pass (this task)

## Summary

**PRODUCTION READY:** Email notification pipeline verified end-to-end in production. Real order → queue → worker → Mailgun → delivered. All success criteria met.
```

---

## Commit Pattern

```bash
docs(notifications): Task 9 complete — end-to-end production verification (Definition of Done)
```

## Status Report

Reply with:
- **DONE:** [one-line summary: order placed, both emails delivered to inboxes]
- **BLOCKED:** [if any step failed]
- **DONE_WITH_CONCERNS:** [observations]
