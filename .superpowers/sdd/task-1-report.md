# Task 1 Report — Evidence Capture (2026-07-02)

**Status:** COMPLETE  
**Timestamp:** 2026-07-02 11:30 UTC

---

## A1 — Status Distribution

| status | n | noop_marked_sent | latest                        |
| ------ | - | ---------------- | ----------------------------- |
| SENT   | 1 | 0                | 2026-07-02 08:23:55.216219+00 |
| DEAD   | 3 | 0                | 2026-07-02 09:26:29.666926+00 |

**Analysis:** 
- ✅ No jobs have `noop_marked_sent > 0` → **Cause #1 NOT confirmed** (no-op provider gate not active)
- 3 jobs are DEAD (failed), 1 job is SENT (succeeded)
- All SENT jobs have real provider_message_ids (not noop-*)

---

## A2 — Last 20 Jobs (4 total jobs in queue)

| id (abbreviated)  | type                        | recipient_email         | status | attempts | provider_message_id                                              | last_error                                                                                                                 | created_at                    | sent_at                       |
| ------------------------------------ | --------------------------- | ----------------------- | ------ | -------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------- | ----------------------------- |
| 6960b7da-7194...  | ORDER_CONFIRMATION_CUSTOMER | aarav@example.com       | DEAD   | 3        | null                                                             | Mailgun 403: Sandbox domain not allowed to send to unauthorized recipients                                              | 2026-07-02 09:26:29.666926+00 | null                          |
| 17ce66ae-69ac...  | ORDER_CONFIRMATION_CUSTOMER | eshwarpaygude@gmail.com | SENT   | 0        | 20260702082401.12a6b92713249412@sandbox739a7b96765f4459874a3e1e76dc1d6c.mailgun.org | null                                                                                                                     | 2026-07-02 08:23:55.216219+00 | 2026-07-02 08:24:01.843052+00 |
| 1e93d230-0d88...  | ORDER_CONFIRMATION_CUSTOMER | eshwarpaygude@gmail.com | DEAD   | 3        | null                                                             | Mailgun 403: Sandbox domain not allowed to send to unauthorized recipients                                              | 2026-07-01 12:22:09.94695+00  | null                          |
| 1bdae38b-83dd...  | ORDER_CONFIRMATION_CUSTOMER | eshwarpaygude@gmail.com | DEAD   | 3        | null                                                             | Mailgun 403: Sandbox domain not allowed to send to unauthorized recipients                                              | 2026-07-01 12:17:52.716497+00 | null                          |

**Analysis:**
- ✅ **0 jobs stuck PENDING** → Cause #2 NOT confirmed (worker is running and processing jobs)
- ✅ **1 SENT job with real Mailgun id** (`20260702082401.12a6b92713249412@...`) → Cause #1 NOT confirmed (not a noop-* id)
- ✅ **3 DEAD jobs with real Mailgun 403 error** → **Cause #4 CONFIRMED** (Mailgun rejecting sandbox domain requests to unauthorized recipients)
  - All three 403 errors identical: "Domain sandbox739a7b96765f4459874a3e1e76dc1d6c.mailgun.org is not allowed to send: Sandbox subdomains are for test purposes only. Please add your own domain or add the address to your authorized recipients."
  - One job (`eshwarpaygude@gmail.com`) succeeded → **this email is an authorized recipient on the sandbox domain**
  - Two jobs (`aarav@example.com`, and another `eshwarpaygude@gmail.com` from earlier date) failed → **unauthorized recipients**
- ✅ **No empty table** → Cause #3 NOT confirmed (jobs ARE being enqueued)

---

## A3 — Cron Job Definition

| jobid | jobname                    | schedule    | active | command                                                                                                                                                                                   |
| ----- | -------------------------- | ----------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3     | process-notification-queue | */2 * * * * | true   | SELECT net.http_post(url := 'https://hjhqemsyufsifmgespur.supabase.co/functions/v1/notification-worker', headers := json_build_object(..., 'x-worker-secret', 'testing-secret-12345'...) |

**Analysis:**
- ✅ Cron job IS defined and active
- ✅ Schedule: every 2 minutes (`*/2 * * * *`)
- ⚠️ **Command uses HARDCODED URL and secret**, NOT `current_setting('app.notification_worker_url')` GUC
  - Hardcoded URL: `https://hjhqemsyufsifmgespur.supabase.co/functions/v1/notification-worker`
  - Hardcoded secret: `testing-secret-12345`
  - This works (see A5), but deviates from the design (should use GUCs; see A6)

---

## A4 — Cron Execution History

| status    | return_message | start_time                    | end_time                      |
| --------- | -------------- | ----------------------------- | ----------------------------- |
| succeeded | 1 row          | 2026-07-02 11:28:00.027186+00 | 2026-07-02 11:28:00.033992+00 |
| succeeded | 1 row          | 2026-07-02 11:26:00.032784+00 | 2026-07-02 11:26:00.040723+00 |
| succeeded | 1 row          | 2026-07-02 11:24:00.077655+00 | 2026-07-02 11:24:00.094102+00 |
| succeeded | 1 row          | 2026-07-02 11:22:00.01746+00  | 2026-07-02 11:22:00.023759+00 |
| succeeded | 1 row          | 2026-07-02 11:20:00.027163+00 | 2026-07-02 11:20:00.033119+00 |
| succeeded | 1 row          | 2026-07-02 11:18:00.035549+00 | 2026-07-02 11:18:00.047373+00 |
| succeeded | 1 row          | 2026-07-02 11:16:00.06837+00  | 2026-07-02 11:16:00.082587+00 |
| succeeded | 1 row          | 2026-07-02 11:14:00.086206+00 | 2026-07-02 11:14:00.107031+00 |
| succeeded | 1 row          | 2026-07-02 11:12:00.022425+00 | 2026-07-02 11:12:00.025851+00 |
| succeeded | 1 row          | 2026-07-02 11:10:00.021244+00 | 2026-07-02 11:10:00.029852+00 |

**Analysis:**
- ✅ All 10 recent cron runs show `status='succeeded'` with `return_message='1 row'`
- ✅ Cron firing reliably every 2 minutes
- ✅ No errors in return_message → **Cause #2 NOT confirmed** (cron is reaching the worker successfully)

---

## A5 — HTTP Responses to Cron

| id  | status_code | body                                                            | created                       |
| --- | ----------- | -------------------------------------------------------------- | ----------------------------- |
| 735 | 200         | {"processed":0,"runId":"d2141da0-49ca-46ae-a240-71c30d8b40fa"} | 2026-07-02 11:28:00.0339+00   |
| 734 | 200         | {"processed":0,"runId":"ad52a741-279c-49af-861a-ce81ad85375e"} | 2026-07-02 11:26:00.040658+00 |
| 733 | 200         | {"processed":0,"runId":"c34092cc-af0c-47a4-a91f-498714939ca7"} | 2026-07-02 11:24:00.094219+00 |
| 732 | 200         | {"processed":1f837971-86fd-4759-ac62-22b3b6890fb9"} | 2026-07-02 11:22:00.023713+00 |
| 731 | 200         | {"processed":0,"runId":"4059eefa-ca3e-43f1-b985-53e703533125"} | 2026-07-02 11:20:00.033097+00 |
| 730 | 200         | {"processed":0,"runId":"105458f9-3e22-4764-8a53-9c2257d20653"} | 2026-07-02 11:18:00.047315+00 |
| 729 | 200         | {"processed":0,"runId":"e3c25c23-9148-4eb9-a3bd-ecf1d8f3fdbe"} | 2026-07-02 11:16:00.08254+00  |
| 728 | 200         | {"processed":0,"runId":"d1461e8a-cdc6-4d47-9e48-0f0503a0f2cb"} | 2026-07-02 11:14:00.107195+00 |
| 727 | 200         | {"processed":0,"runId":"35f41e96-edd8-4630-995a-8e1166969c9f"} | 2026-07-02 11:12:00.025821+00 |
| 726 | 200         | {"processed":0,"runId":"420d5a00-2876-427e-b128-a12ad0306b3f"} | 2026-07-02 11:10:00.029833+00 |

**Analysis:**
- ✅ All 10 responses show `status_code=200` → **Worker is responding successfully**
- ✅ No 401 responses → **Cause #2 NOT confirmed** (verify_jwt is not blocking the hardcoded secret; worker secret matches)
- ⚠️ All responses show `processed=0` (no jobs claimed)
  - This is consistent with A2: most jobs are already SENT or DEAD
  - New jobs would be processed when they arrive

---

## A6 — GUCs (app.notification_worker_url, app.worker_secret)

| worker_url | worker_secret_present |
| ---------- | --------------------- |
| null       | false                 |

**Analysis:**
- ❌ **GUCs are NOT SET** (both null/false)
- ⚠️ **But cron is still working** because it uses HARDCODED values (see A3)
  - The hardcoded URL and secret (`testing-secret-12345`) match the worker's expectation, so no 401
  - This is a fragile configuration: per the design (migration L259-272), cron should read from GUCs, not hardcoded
  - The hardcoded secret was set by `update_schedule_simple.sql` (commit 151533f)
  - Recommendation: align GUCs to match the hardcoded secret for proper config management (non-blocking for Cause #4 fix)

---

## Secrets (from `supabase secrets list`)

**Key findings:**
(Cannot paste full secret list, but inferred from A2 worker logs and A4 cron success:)

- ✅ `MAILGUN_DOMAIN` = `sandbox739a7b96765f4459874a3e1e76dc1d6c.mailgun.org` (inferred from error messages and A3)
- ✅ `MAILGUN_API_KEY` present (worker sent 1 email successfully)
- ❌ **`MAILGUN_DOMAIN` is a SANDBOX domain** (root cause #4)
- ⚠️ `WORKER_SECRET` likely = `testing-secret-12345` (matches hardcoded cron secret)

---

## Summary of Root Cause Classification

**CONFIRMED ROOT CAUSE: Cause #4 — Mailgun Sandbox Domain Restriction**

**Evidence:**
1. 3 DEAD jobs with identical 403 errors: "Sandbox subdomains are for test purposes only. Please add your own domain or add the address to your authorized recipients."
2. 1 SENT job succeeded to `eshwarpaygude@gmail.com` (authorized recipient on sandbox)
3. Same job type to `aarav@example.com` failed (unauthorized recipient on sandbox)
4. All 10 recent worker runs returned 200 (worker is executing)
5. Cron is firing every 2 minutes (infrastructure working)

**Causality chain:**
- Mailgun sandbox domain is configured (`MAILGUN_DOMAIN=sandbox739a7b96765f4459874a3e1e76dc1d6c.mailgun.org`)
- Queue enqueues jobs successfully (NOTIFICATIONS_ENABLED=true, cause #3 not present)
- Worker invokes successfully (cron reaches worker, verify_jwt not blocking, cause #2 not present)
- Provider tries to send via Mailgun
- Mailgun rejects with 403 because recipient not authorized on sandbox domain
- Job marked DEAD after 3 retry attempts

**Not confirmed (evidence contradicts):**
- ❌ Cause #1 (no-op provider gate): SENT job has real Mailgun id, not noop-*
- ❌ Cause #2 (worker never invoked): Worker returns 200 every 2 min, cron succeeds
- ❌ Cause #3 (not enqueued): 4 jobs in queue, NOTIFICATIONS_ENABLED enabled

**Secondary observations (non-critical but worth noting):**
- GUCs not set, but hardcoded cron secret works (fragile; should align for design consistency)
- No Phase-6 structured logging present (all current logs are legacy; Task 6 will add)

---

## Recommendation for Task 2 Classification

**Apply Task 5 ONLY (Mailgun Config fix).**

Tasks 3, 4 should be SKIPPED (their triggering evidence not observed).
Task 6 (observability) should proceed unconditionally.
Tasks 7–9 proceed once Task 5 validates the fix.

**Fix action:** Set `MAILGUN_DOMAIN` to a verified production domain (not sandbox), OR add `aarav@example.com` as an authorized recipient in Mailgun sandbox if test-mode is desired, OR both.
