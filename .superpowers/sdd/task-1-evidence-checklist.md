# Task 1 — Capture Live Evidence (User Checklist)

**Status:** Ready for user execution  
**Plan:** docs/superpowers/plans/2026-07-02-email-notification-stabilization.md  
**Report file:** task-1-report.md

---

## Quick Summary

This task is **read-only**. No code changes. You will:
1. Run 6 SQL queries in Supabase Dashboard (A1–A6)
2. Run 3 CLI commands (`supabase secrets list`, `supabase functions logs` ×2)
3. Check Mailgun Dashboard for delivery state
4. Paste all results into `task-1-report.md` (template below)

Total time: ~10 minutes. **All queries and commands are provided verbatim; copy-paste them.**

---

## Step 1: Run SQL A1–A6

Open **Supabase Dashboard** → **SQL Editor** (under "Development" or your project). Run each query one at a time. Record the output after each query.

### A1 — Status distribution + no-op detection (CRITICAL)

```sql
SELECT
  status,
  COUNT(*) AS n,
  COUNT(*) FILTER (WHERE provider_message_id LIKE 'noop-%') AS noop_marked_sent,
  MAX(created_at) AS latest
FROM notification_jobs
GROUP BY status
ORDER BY status;
```

**What to record:** The entire result table (all rows + columns). **Pay special attention:** if any row has `status='SENT'` AND `noop_marked_sent > 0`, that's the smoking gun for cause #1.

### A2 — Last 20 jobs, full detail

```sql
SELECT id, type, recipient_email, status, attempts,
       provider_message_id, last_error, created_at, sent_at
FROM notification_jobs
ORDER BY created_at DESC
LIMIT 20;
```

**What to record:** All 20 rows (or fewer if table has <20 rows). Note:
- Any rows with `status='PENDING'` and `attempts=0` → worker never ran (cause #2)
- Any rows with `status='DEAD'` and `last_error` containing "Mailgun" or "401" or "unauthorized" → cause #4
- Any rows with `status='SENT'` and `provider_message_id LIKE 'noop-%'` → cause #1
- Empty table → cause #3 (not enqueued)

### A3 — Is the cron job defined?

```sql
SELECT jobid, jobname, schedule, active, command
FROM cron.job
WHERE jobname = 'process-notification-queue';
```

**What to record:** If 0 rows, cron is not scheduled. If 1 row, record the entire row, especially the `command` column — look for whether it references `current_setting('app.notification_worker_url')` (GUC mode) or a hardcoded URL.

### A4 — Did cron fire recently?

```sql
SELECT jrd.status, jrd.return_message, jrd.start_time, jrd.end_time
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE j.jobname = 'process-notification-queue'
ORDER BY jrd.start_time DESC
LIMIT 10;
```

**What to record:** All rows returned (the last 10 cron executions). Look for:
- `status='succeeded'` or `status='failed'`
- `return_message` — if it contains "404", "500", "401", that's an error response from the worker

### A5 — HTTP status from the worker (CRITICAL for cause #2)

```sql
SELECT id, status_code, (content::text) AS body, created
FROM net._http_response
ORDER BY created DESC
LIMIT 10;
```

**What to record:** All 10 rows. **Critical signals:**
- `status_code=401` → gateway rejected the request (worker verify_jwt gate, cause #2)
- `status_code=200` with body `{"processed":N,...}` → worker ran successfully
- `status_code=404` → URL not found (worker endpoint missing)

### A6 — Are the GUCs set?

```sql
SELECT current_setting('app.notification_worker_url', true) AS worker_url,
       (current_setting('app.worker_secret', true) IS NOT NULL
         AND current_setting('app.worker_secret', true) <> '') AS worker_secret_present;
```

**What to record:** The two values. If both are NULL/false, the cron cannot invoke the worker (cause #2).

---

## Step 2: Run CLI Commands

In your terminal (or use `!` in this Claude Code session):

### B1 — Which secrets are set? (CRITICAL)

```bash
supabase secrets list --project-ref hjhqemsyufsifmgespur
```

**What to record:** Copy the entire output. Look for:
- `ENVIRONMENT` → should be `production` in prod, or unset (defaults to `development`)
- `NOTIFICATIONS_ENABLED` → should be `true` to enable
- `MAILGUN_API_KEY` → presence only (don't copy the key itself)
- `MAILGUN_DOMAIN`, `MAILGUN_FROM`, `MAILGUN_BASE_URL` → present?
- `ADMIN_EMAIL`, `ADMIN_URL` → present?
- `WORKER_SECRET` → present? (should match the `app.worker_secret` GUC from A6)

### B2 — Worker logs (CRITICAL)

```bash
supabase functions logs notification-worker --project-ref hjhqemsyufsifmgespur
```

**What to record:** Last 50 lines. Search for:
- `"event":"provider_request_success"` → worker sent an email; look for `messageId` (real id vs `noop-...`)
- `"event":"provider_request_failed"` → worker tried but failed; look for error
- `"event":"job_sent"` → legacy/existing log; look for messageId
- `"event":"job_failed"` → legacy; look for error
- `"event":"auth_failed"` → worker rejected the request (verify_jwt issue)

Copy/paste the relevant lines (at minimum, last 20-30 lines of output).

### B3 — create-order logs (CRITICAL)

```bash
supabase functions logs create-order --project-ref hjhqemsyufsifmgespur
```

**What to record:** Last 50 lines. Search for:
- `"event":"notification_enqueue_started"` → order enqueuing notifications (if this doesn't appear, NOTIFICATIONS_ENABLED is off or the code path wasn't hit)
- `"enabled":true` in the `notifications_config` section → NOTIFICATIONS_ENABLED is on
- `"enabled":false` → NOTIFICATIONS_ENABLED is off (cause #3)
- `"enqueue_customer_success"` / `"enqueue_admin_success"` → jobs queued successfully
- `"enqueue_customer_failed"` / `"enqueue_admin_failed"` → failed to queue; look for error

Copy/paste the relevant lines (at minimum, last 20-30 lines).

---

## Step 3: Mailgun Dashboard State

Open **Mailgun Dashboard** → **Sending** → **Logs**.

Filter by one of the test recipient email addresses (from B3 logs or A2 `recipient_email` column). Look at the **Message Status** column or click into a message.

**What to record:**
- Message state: `accepted` / `delivered` / `failed` / `bounced` / `suppressed (unauthorized recipient)` / `temporary failure` / etc.
- If failed/suppressed, record the error reason (e.g., "Unauthorized recipient — sandbox domain", "Invalid credentials", "Domain not verified", etc.)
- If delivered, note the timestamp.
- Record 2-3 recent messages and their states.

---

## Step 4: Fill in the Report

Copy the template below into `task-1-report.md` (or paste your findings structured this way) and **commit it**:

```markdown
# Task 1 Report — Evidence Capture (2026-07-02)

## A1 — Status Distribution

[Paste the entire SELECT result table here]

**Analysis:** [Note if noop_marked_sent > 0 in any SENT row]

## A2 — Last 20 Jobs

[Paste all job rows here]

**Analysis:** [Note the highest-effort issues: PENDING+attempts=0, DEAD+last_error, SENT+noop-%, or no rows]

## A3 — Cron Job Definition

[Paste the cron.job row, or "0 rows — cron not defined"]

**Analysis:** [Note whether it uses GUC mode (current_setting) or hardcoded URL]

## A4 — Cron Execution History

[Paste the last 10 cron_job_run_details rows]

**Analysis:** [Note status (succeeded/failed), return_message errors, timestamps]

## A5 — HTTP Responses to Cron

[Paste the last 10 net._http_response rows]

**Analysis:** [Note status_code 401/200/other, and body content if error]

## A6 — GUCs

worker_url: [value or NULL]
worker_secret_present: [true/false]

**Analysis:** [Note if both are set]

## B1 — Secrets

```
[Paste supabase secrets list output]
```

**Key findings:**
- ENVIRONMENT: [value or "not set"]
- NOTIFICATIONS_ENABLED: [value or "not set"]
- MAILGUN_API_KEY: [present/not present]
- MAILGUN_DOMAIN: [present/not present]
- MAILGUN_FROM: [present/not present]
- MAILGUN_BASE_URL: [present/not present]
- ADMIN_EMAIL: [present/not present]
- ADMIN_URL: [present/not present]
- WORKER_SECRET: [present/not present]

## B2 — notification-worker Logs

[Paste last 30-50 lines of supabase functions logs]

**Key lines (if any):**
- provider_request_success with messageId: [note if noop-... or real Mailgun id]
- provider_request_failed with error: [paste error]
- auth_failed: [note if present]

## B3 — create-order Logs

[Paste last 30-50 lines of supabase functions logs]

**Key findings:**
- notification_enqueue_started present: [yes/no]
- enabled:true / enabled:false in notifications_config: [which]
- enqueue_customer_success: [yes/no]
- enqueue_customer_failed with error: [if yes, paste error]

## B4 — Mailgun Logs

Status of recent messages (examples):

| Recipient | Message ID | Status | Error/Note |
|---|---|---|---|
| [email] | [id] | delivered | — |
| [email] | [id] | failed | [reason] |
| [email] | [id] | suppressed | [reason] |

## Summary of Observations

[Write 2-3 lines summarizing the strongest signals. E.g., "SENT jobs show provider_message_id='noop-*' and no Mailgun deliveries → cause #1 (no-op gate)" or "PENDING jobs stuck at attempts=0, worker logs show 'auth_failed' → cause #2" etc.]
```

---

## How to Run Commands in This Session

Instead of leaving to run them elsewhere, you can use the `!` prefix in Claude Code to run commands directly in this session. Example:

```
! supabase secrets list --project-ref hjhqemsyufsifmgespur
```

Claude will display the output inline, and I'll see it immediately.

---

## Next Steps After You Provide Evidence

Once you paste the report (or run the commands via `!`):

1. I will read the evidence and lock the **confirmed root cause(s)** in Task 2.
2. Tasks 3–5 will be dispatched only if their triggering evidence appeared (gated).
3. Task 6 (observability) will proceed unconditionally.
4. Tasks 7–9 verify the fix end-to-end.

**You do not need to run the fix tasks** — those dispatch as subagents. This task is the only user-facing one; all implementation thereafter is automated.

---

## Questions?

Before you start:
- **Project ref:** `hjhqemsyufsifmgespur` ✅
- **All commands are verbatim; no substitutions needed.** Copy-paste them as-is.
- **SQL is read-only** — no modifications to the database.
- **If a query returns 0 rows, that's valid data** — paste "0 rows" in the report.

Ready to proceed? Run the SQL + CLI commands and paste the report back.
