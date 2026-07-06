# Plan B — Automated WhatsApp Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **⚠️ BLOCKED ON DECISIONS + PLAN A.** Do not start implementation until: (1) Plan A (email stabilization) is shipped and verified in production, and (2) the provider, templates, and credentials in Phase 0 are decided/provisioned. Phase 0 requires the `superpowers:brainstorming` skill with the stakeholder before the implementation tasks are finalized.

**Goal:** Add automated WhatsApp order-confirmation messages (customer, and optionally admin) as an independent, separately-deployable feature, reusing the proven `notification_jobs` queue + worker pattern from the email pipeline, without altering the email pipeline or the existing `wa.me` deep-links.

**Architecture:** Extend the existing queue with WhatsApp notification types and a channel-agnostic worker dispatch. A new `WhatsAppProvider` (behind an interface mirroring `EmailProvider`) sends via the chosen Business API using pre-approved templates. Queue, idempotency, retry, backoff, rate-limit, and observability reuse the email infrastructure — only the channel adapter, templates, notification types, and a recipient-phone column are new.

**Tech Stack:** Deno + TypeScript (Supabase edge functions), a WhatsApp Business API (provider TBD — see Phase 0), Postgres (pg_cron + pg_net), `@supabase/supabase-js@2`.

## Global Constraints

- **Independent of Plan A.** No change to `email-provider.ts`, `mailgun-provider.ts`, `email-templates.ts`, or the email send path. Additive only.
- **Existing `wa.me` deep-links stay unchanged** — this feature adds *automated* sends; it does not remove manual click-to-chat links.
- WhatsApp Business API requires **pre-approved message templates** for business-initiated messages outside the 24-hour customer service window. Order confirmations are business-initiated → **must use an approved template**. No free-form text.
- All provider credentials (API token, phone number id, waba id) are **Supabase function secrets** — never client-side.
- WhatsApp failure must be **fully isolated**: it must not affect order creation, payment, email delivery, or any other channel (TEST 7).
- Reuse the email pipeline's idempotency (`idempotency_key` unique), retry/backoff (`fail_notification_job`), and Phase-6 structured logging (`_shared/log.ts`) — do not fork them.
- Phone numbers must be normalized to E.164 before sending (country code + number, no `+`, no separators) — reuse the normalization already implied by `wa.me` link building (`email-templates.ts:64`).
- Cost, rate limits, and template categories differ per provider — decisions locked in Phase 0 before implementation.

---

## Phase 0 — Provider Selection, Templates, Credentials (DECISIONS — required first)

**This phase produces decisions, not code.** Run `superpowers:brainstorming` with the stakeholder. Deliverable: a signed-off decision record at `docs/superpowers/evidence/whatsapp-provider-decision.md`.

- [ ] **Step 1: Evaluate providers against fixed criteria**

Compare **Meta WhatsApp Cloud API**, **Twilio**, **AiSensy**, **Interakt** on:

| Criterion | Why it matters |
|---|---|
| Integration model | Direct Meta Cloud API (first-party, cheapest at scale, more setup) vs BSP/aggregator (AiSensy/Interakt — faster onboarding, UI template mgmt, markup per message) vs Twilio (mature SDK, higher per-msg cost) |
| Template approval flow | Turnaround + who manages approvals (self-serve vs BSP-assisted) |
| Per-message + monthly cost | Conversation-based pricing (Meta) vs per-message markup (BSP) at expected order volume |
| Credentials required | Meta: WABA id, phone number id, permanent token, verified business. BSP: API key + template ids |
| Compliance | Opt-in capture, business verification, template category (UTILITY for order confirmations) |
| Retry / delivery webhooks | Delivery/read receipts for observability parity with email |

**Default recommendation (if no other constraint):** Meta WhatsApp Cloud API — first-party, UTILITY-category order confirmations are low-cost, and it maps cleanly onto a fetch-based provider like `MailgunProvider`. The provider adapter in Task 3 is written against this default; a BSP swap changes only that one file.

- [ ] **Step 2: Design + submit approved templates**

Draft UTILITY-category templates for: customer order confirmation (and admin order notification if required). Include variable placeholders for `customerName`, `orderNumber`, `total`. Submit for approval; record template names + language codes in the decision doc. **Implementation cannot proceed until templates are APPROVED.**

- [ ] **Step 3: Provision + record credentials**

Provision the account, verify the business, obtain a permanent token + phone number id (or BSP API key). Record which Supabase secrets will hold them (Task 3 names them). Confirm opt-in capture exists at checkout (customers must consent to WhatsApp).

- [ ] **Step 4: Cost + rate-limit analysis**

Document expected monthly conversation volume × price, and the provider's messaging rate tier. Confirm the queue's rate-limit (`enqueue_notification`, 10/recipient/hour) is compatible; add a channel-aware limit if needed.

- [ ] **Step 5: Sign off the decision record and commit**

```bash
git add docs/superpowers/evidence/whatsapp-provider-decision.md
git commit -m "docs(whatsapp): provider, templates, and credentials decision record"
```

---

## File Map (implementation — after Phase 0)

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/<ts>_whatsapp_notifications.sql` | Create | Add WhatsApp enum values + `recipient_phone` column; extend enqueue for phone |
| `supabase/functions/_shared/notification-types.ts` | Modify | Add WhatsApp `NotificationType`s + `WhatsAppProvider` interface + `recipient_phone` |
| `supabase/functions/_shared/whatsapp-provider.ts` | Create | Chosen-provider implementation of `WhatsAppProvider` |
| `supabase/functions/_shared/whatsapp-templates.ts` | Create | Maps notification type → approved template name + variables |
| `supabase/functions/notification-worker/index.ts` | Modify | Channel dispatch: email vs WhatsApp based on job type |
| `supabase/functions/create-order/index.ts` | Modify | Enqueue WhatsApp jobs alongside email (behind `WHATSAPP_ENABLED` flag) |
| `supabase/functions/notification-webhook/index.ts` | Modify | (Optional) accept WhatsApp delivery/read webhooks for `notification_events` |

---

## Task 1: Schema — WhatsApp Types + Recipient Phone

**Files:**
- Create: `supabase/migrations/<ts>_whatsapp_notifications.sql`

**Interfaces:**
- Produces: enum values `ORDER_CONFIRMATION_CUSTOMER_WA`, `ORDER_CONFIRMATION_ADMIN_WA`; `notification_jobs.recipient_phone TEXT`.

- [ ] **Step 1: Write the migration (additive only)**

```sql
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'ORDER_CONFIRMATION_CUSTOMER_WA';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'ORDER_CONFIRMATION_ADMIN_WA';
ALTER TABLE public.notification_jobs ADD COLUMN IF NOT EXISTS recipient_phone TEXT;
```

`recipient_email` becomes nullable-in-practice for WhatsApp jobs — keep the column NOT NULL by storing the customer email as a correlation value, OR relax the constraint if the provider needs no email. Decide from Phase 0; if relaxing: `ALTER TABLE public.notification_jobs ALTER COLUMN recipient_email DROP NOT NULL;` (additive, reversible).

- [ ] **Step 2: Apply + verify the enum + column exist; commit.**

(Enum `ADD VALUE` cannot run inside a transaction block with other statements on some PG versions — split if the push fails.)

---

## Task 2: Types — WhatsApp Provider Interface

**Files:**
- Modify: `supabase/functions/_shared/notification-types.ts`

- [ ] **Step 1: Add the WhatsApp types + interface (mirror `EmailProvider`)**

```typescript
export interface WhatsAppSendOptions {
  toPhone: string;        // E.164, no '+'
  templateName: string;
  languageCode: string;   // e.g. 'en'
  variables: string[];    // ordered template params
}

export interface WhatsAppProvider {
  /** Send a template message. Returns the provider-assigned message id. */
  send(opts: WhatsAppSendOptions): Promise<string>;
}
```

Add `'ORDER_CONFIRMATION_CUSTOMER_WA' | 'ORDER_CONFIRMATION_ADMIN_WA'` to the `NotificationType` union and `recipient_phone: string | null` to `NotificationJob`.

- [ ] **Step 2: `deno check` + commit.**

---

## Task 3: WhatsApp Provider + Factory

**Files:**
- Create: `supabase/functions/_shared/whatsapp-provider.ts`

**Interfaces:**
- Consumes secrets: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_API_BASE` (Meta default `https://graph.facebook.com/v20.0`). BSP variant swaps these.
- Produces: `createWhatsAppProvider(): WhatsAppProvider` with a dev/disabled no-op (mirrors `createEmailProvider`, returns `noop-wa-<uuid>`), real provider only when `ENVIRONMENT==='production' && WHATSAPP_ENABLED==='true'`.

- [ ] **Step 1: Implement the provider (Meta Cloud API default)**

Fetch `POST {WHATSAPP_API_BASE}/{WHATSAPP_PHONE_NUMBER_ID}/messages` with `Authorization: Bearer {token}`, body `{ messaging_product:'whatsapp', to, type:'template', template:{ name, language:{code}, components:[{type:'body', parameters: variables.map(v=>({type:'text',text:v}))}] } }`. Throw on non-2xx with status + body (parity with `mailgun-provider.ts:46-49`). Return the returned `messages[0].id`.

- [ ] **Step 2: `deno check` + commit.**

---

## Task 4: Templates Mapping

**Files:**
- Create: `supabase/functions/_shared/whatsapp-templates.ts`

- [ ] **Step 1: Map notification type → approved template name + ordered variables**

```typescript
export function renderWhatsAppTemplate(type, payload): WhatsAppSendOptions['templateName' | ...] { ... }
```

Return `{ templateName, languageCode, variables }` for `ORDER_CONFIRMATION_CUSTOMER_WA` (and admin) using the APPROVED names from Phase 0 Step 2. No free-form fallback.

- [ ] **Step 2: `deno check` + commit.**

---

## Task 5: Worker Channel Dispatch

**Files:**
- Modify: `supabase/functions/notification-worker/index.ts`

**Interfaces:**
- Consumes: `createWhatsAppProvider()`, `renderWhatsAppTemplate()`.

- [ ] **Step 1: Branch on channel by job type**

For `*_WA` types, call the WhatsApp provider with `job.recipient_phone` and `renderWhatsAppTemplate`; else the existing email path. Reuse `complete_notification_job` / `fail_notification_job` unchanged. Emit `provider_request_*` via `logNotification` with `provider:'whatsapp'`, `customer_phone`, `provider_message_id`. Retry/backoff/idempotency inherited.

- [ ] **Step 2: `deno check`, deploy, commit.**

---

## Task 6: Enqueue WhatsApp Jobs in create-order

**Files:**
- Modify: `supabase/functions/create-order/index.ts`

- [ ] **Step 1: Behind a separate `WHATSAPP_ENABLED==='true'` flag**, and only when `body.customer.phone` is present + opt-in captured, upsert `*_WA` jobs (idempotency keys `ORDER_CONFIRMATION_CUSTOMER_WA:{order_id}` etc.) with `recipient_phone` set to normalized E.164. Mirror the existing email upsert block; keep `await Promise.allSettled`. WhatsApp enqueue failure must not affect email or the order response.

- [ ] **Step 2: `deno check`, deploy, commit.**

---

## Task 7: WhatsApp Test Matrix (TEST 3, 4, 7)

- [ ] **TEST 3 — customer WhatsApp:** enqueue `*_WA` to a valid opted-in number → worker sends → provider `sent`/`delivered` webhook → message received; job `SENT` with real id.
- [ ] **TEST 4 — invalid number:** provider rejects → `provider_request_failed` → `RETRYING`→`DEAD` with `last_error`; no impact elsewhere.
- [ ] **TEST 7 — provider unavailable, isolated:** set an invalid `WHATSAPP_API_BASE` → order succeeds, **email still delivers**, WhatsApp job goes `DEAD`; failure isolated. Restore base after.
- [ ] Record results + provider message ids in the decision/evidence doc.

---

## Task 8: Regression + Rollout

- [ ] **Regression:** re-run Plan A's email TEST 1 + regression pass to prove the email pipeline is byte-for-byte unaffected; confirm `wa.me` deep-links unchanged.
- [ ] **Rollout:** set WhatsApp secrets + `WHATSAPP_ENABLED=true` only after templates approved; canary with internal numbers; monitor `provider_request_*` logs + delivery webhooks; kill switch = `WHATSAPP_ENABLED=false`.

---

## Definition of Done (WhatsApp)

- [ ] Provider/templates/credentials decision record signed off (Phase 0)
- [ ] Templates APPROVED by provider
- [ ] WhatsApp queue verified (jobs created with `recipient_phone`)
- [ ] WhatsApp delivery verified end-to-end (real `delivered`/read receipt)
- [ ] Retry + idempotency verified (TEST 4)
- [ ] Failure isolation verified (TEST 7 — email unaffected)
- [ ] Email pipeline regression green
- [ ] No duplicate messages; observability logs verified

## Self-Review

**Scope isolation:** No email-path file logic changed; all changes additive (new enum values, new column, new provider/template files, channel branch, flag-gated enqueue). Existing `wa.me` deep-links untouched.

**Open decisions (must resolve in Phase 0 before implementation):** provider choice, template copy + category, opt-in capture point, whether admin WhatsApp is required, cost tier, and whether `recipient_email` NOT NULL is relaxed. Implementation tasks are written against the Meta Cloud API default; a BSP choice changes only Task 3.
