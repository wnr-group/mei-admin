# Task 7 Brief — Email Test Matrix (TEST 1/2/5/6)

**Plan:** docs/superpowers/plans/2026-07-02-email-notification-stabilization.md § Task 7

**Scope:** Verify email queue and delivery across 4 test scenarios (TEST 1, 2, 5, 6).
- TEST 3, 4, 7 (WhatsApp) → out of scope for Plan A
- TEST 1: authorized recipient, full path ✅ (already verified in Task 5, but re-verify)
- TEST 2: unauthorized recipient → DEAD after retries
- TEST 5: idempotency / duplicate
- TEST 6: Mailgun unavailable, failure isolated

---

## TEST 1: Authorized Recipient, Full Path

**Expected:** Queue created → Worker executed → Email delivered

**Steps:**

1. Create a test job to `eshwarpaygude@gmail.com` (authorized):

```sql
SELECT public.enqueue_notification(
  p_idempotency_key := 'TEST1_' || gen_random_uuid(),
  p_type            := 'ORDER_CONFIRMATION_CUSTOMER'::public.notification_type,
  p_recipient_email := 'eshwarpaygude@gmail.com',
  p_payload         := jsonb_build_object(
    'customerName','Test One','orderNumber','TEST-1',
    'items',jsonb_build_array(jsonb_build_object('name','Item','quantity',1)),
    'total',5000,'correlationId','test-1'),
  p_priority := 1
);
```

Note the returned `job_id`.

2. Invoke the worker:

```bash
curl -X POST https://hjhqemsyufsifmgespur.supabase.co/functions/v1/notification-worker \
  -H "Content-Type: application/json" \
  -H "x-worker-secret: testing-secret-12345" \
  -d '{}'
```

Expected response: `{"processed":1,"sent":1,"failed":0,...}`

3. Verify job is SENT:

```sql
SELECT id, status, provider_message_id, last_error, created_at, sent_at
FROM notification_jobs
WHERE idempotency_key LIKE 'TEST1_%'
ORDER BY created_at DESC LIMIT 1;
```

Expected: `status='SENT'`, `provider_message_id` = real Mailgun id (like `20260702...@sandbox...mailgun.org`), `last_error=NULL`, `sent_at` filled.

4. Check worker logs for `provider_request_success` event with correlationId='test-1'.

5. **PASS if:** job is SENT with real id, no errors, logs show success.

---

## TEST 2: Unauthorized Recipient → DEAD After Retries

**Expected:** Queue created → Worker tried 3 times → Job marked DEAD with error

**Steps:**

1. Create a test job to an unauthorized email (Mailgun will reject with 403):

```sql
SELECT public.enqueue_notification(
  p_idempotency_key := 'TEST2_' || gen_random_uuid(),
  p_type            := 'ORDER_CONFIRMATION_CUSTOMER'::public.notification_type,
  p_recipient_email := 'unauthorized@example.com',
  p_payload         := jsonb_build_object(
    'customerName','Test Two','orderNumber','TEST-2',
    'items',jsonb_build_array(jsonb_build_object('name','Item','quantity',1)),
    'total',5000,'correlationId','test-2'),
  p_priority := 1
);
```

Note the job_id.

2. Invoke the worker 3 times (to exhaust max_attempts=3):

```bash
curl -X POST https://hjhqemsyufsifmgespur.supabase.co/functions/v1/notification-worker \
  -H "Content-Type: application/json" \
  -H "x-worker-secret: testing-secret-12345" \
  -d '{}'
```

(First invoke: attempts → 1, next_attempt_at = now + 30s)
(Second invoke: attempts → 2, next_attempt_at = now + 60s)
(Third invoke: attempts → 3, status → DEAD)

To speed up retries, optionally update the job's `next_attempt_at` to past before each invoke:

```sql
UPDATE notification_jobs
SET next_attempt_at = now() - INTERVAL '1 minute'
WHERE idempotency_key LIKE 'TEST2_%' AND status = 'RETRYING';
```

3. After 3 attempts, verify job is DEAD:

```sql
SELECT id, status, attempts, last_error, created_at
FROM notification_jobs
WHERE idempotency_key LIKE 'TEST2_%'
ORDER BY created_at DESC LIMIT 1;
```

Expected: `status='DEAD'`, `attempts=3`, `last_error` contains "Mailgun 403" (Unauthorized recipient).

4. Check worker logs: should show 3 `provider_request_failed` events with `error_code: "403"`.

5. **PASS if:** job reaches DEAD after 3 attempts with Mailgun 403 error.

---

## TEST 5: Idempotency / Duplicate

**Expected:** Enqueue same job twice → only 1 row created, no duplicate emails

**Steps:**

1. Create the same job twice (same idempotency_key):

```sql
SELECT public.enqueue_notification(
  p_idempotency_key := 'TEST5_DUP',
  p_type            := 'ORDER_CONFIRMATION_CUSTOMER'::public.notification_type,
  p_recipient_email := 'eshwarpaygude@gmail.com',
  p_payload         := jsonb_build_object('customerName','Test Five','orderNumber','TEST-5','correlationId','test-5'),
  p_priority := 1
);
```

Result 1: `{"enqueued":true,"job_id":"..."}`

```sql
SELECT public.enqueue_notification(
  p_idempotency_key := 'TEST5_DUP',
  p_type            := 'ORDER_CONFIRMATION_CUSTOMER'::public.notification_type,
  p_recipient_email := 'eshwarpaygude@gmail.com',
  p_payload         := jsonb_build_object('customerName','Test Five','orderNumber','TEST-5','correlationId','test-5'),
  p_priority := 1
);
```

Result 2 (expected): `{"enqueued":false,"reason":"DUPLICATE"}`

2. Verify only 1 row in queue:

```sql
SELECT COUNT(*) FROM notification_jobs WHERE idempotency_key = 'TEST5_DUP';
```

Expected: `count=1`

3. Invoke the worker and confirm only 1 email sent (no duplicates):

```bash
curl -X POST https://hjhqemsyufsifmgespur.supabase.co/functions/v1/notification-worker \
  -H "Content-Type: application/json" \
  -H "x-worker-secret: testing-secret-12345" \
  -d '{}'
```

Check worker logs: should show exactly 1 `provider_request_success` for this job.

4. **PASS if:** second enqueue returns DUPLICATE, only 1 row created, 1 email sent.

---

## TEST 6: Mailgun Unavailable, Failure Isolated

**Expected:** Temporarily break Mailgun → order creation succeeds, notification job fails gracefully, no impact on checkout/payment

**Steps:**

1. Temporarily set an invalid MAILGUN_BASE_URL:

```bash
supabase secrets set MAILGUN_BASE_URL=https://api.invalid.mailgun.test --project-ref hjhqemsyufsifmgespur
supabase functions deploy notification-worker --project-ref hjhqemsyufsifmgespur
```

2. Create a test job:

```sql
SELECT public.enqueue_notification(
  p_idempotency_key := 'TEST6_' || gen_random_uuid(),
  p_type            := 'ORDER_CONFIRMATION_CUSTOMER'::public.notification_type,
  p_recipient_email := 'eshwarpaygude@gmail.com',
  p_payload         := jsonb_build_object('customerName','Test Six','orderNumber','TEST-6','correlationId','test-6'),
  p_priority := 1
);
```

3. Invoke the worker (job will fail to reach Mailgun):

```bash
curl -X POST https://hjhqemsyufsifmgespur.supabase.co/functions/v1/notification-worker \
  -H "Content-Type: application/json" \
  -H "x-worker-secret: testing-secret-12345" \
  -d '{}'
```

Expected: `{"processed":1,"sent":0,"failed":1,...}`

4. Verify job went to RETRYING (not SENT):

```sql
SELECT id, status, attempts, last_error
FROM notification_jobs
WHERE idempotency_key LIKE 'TEST6_%'
ORDER BY created_at DESC LIMIT 1;
```

Expected: `status='RETRYING'` (or `DEAD` after max retries), `last_error` contains connection error.

5. Restore the correct MAILGUN_BASE_URL:

```bash
supabase secrets set MAILGUN_BASE_URL=https://api.mailgun.net --project-ref hjhqemsyufsifmgespur
supabase functions deploy notification-worker --project-ref hjhqemsyufsifmgespur
```

6. **PASS if:** Mailgun outage → job fails gracefully, order creation is unaffected (no payment failures, no checkout breakage).

---

## Report Template

Create `.superpowers/sdd/task-7-report.md` with:

```markdown
# Task 7 Report — Email Test Matrix

## TEST 1: Authorized Recipient

**Job ID:** [from query result]
**Status after worker invocation:** [SENT or other]
**Provider Message ID:** [real Mailgun id or error]
**Log event:** provider_request_success [yes/no]

**PASS/FAIL:** [PASS if status=SENT with real Mailgun id]

---

## TEST 2: Unauthorized Recipient → DEAD

**Job ID:** [from query result]
**Status after 3 attempts:** [DEAD or other]
**Attempts:** [should be 3]
**Last Error:** [Mailgun 403 or other]
**Log events:** provider_request_failed (count: 3) [yes/no]

**PASS/FAIL:** [PASS if status=DEAD, attempts=3, error contains 403]

---

## TEST 5: Idempotency

**First enqueue result:** enqueued=true, job_id=[id]
**Second enqueue result:** enqueued=false, reason=DUPLICATE

**Job count in queue:** [should be 1]
**Emails sent (from worker log):** [should be 1]

**PASS/FAIL:** [PASS if duplicate rejected, only 1 job, 1 email]

---

## TEST 6: Mailgun Unavailable, Isolated

**Job created:** [job_id]
**Worker response when Mailgun invalid:** processed=1, sent=0, failed=1
**Job status after worker:** RETRYING or DEAD
**Last error contains connection error:** yes/no

**PASS/FAIL:** [PASS if job fails gracefully, error message shows connection issue, no impact on checkout]

---

## Summary

TEST 1: [PASS/FAIL]
TEST 2: [PASS/FAIL]
TEST 5: [PASS/FAIL]
TEST 6: [PASS/FAIL]

**Overall:** [ALL PASS / SOME FAIL / describe issues]
```

---

## Report File

`.superpowers/sdd/task-7-report.md`

## Commit Pattern

```bash
test(notifications): Task 7 complete — email test matrix verified (1/2/5/6 PASS)
```

## Status Report

Reply with:
- **DONE:** [brief summary of test results]
- **BLOCKED:** [test(s) that failed]
- **DONE_WITH_CONCERNS:** [tests passed but observations]
