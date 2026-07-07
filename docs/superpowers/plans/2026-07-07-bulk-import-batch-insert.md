# Bulk Import: Confirm and Batch Insert Products, Colors, and Media — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the "Import" button on `/products/import` (currently a preview-only stub, MEI-42) to actually write validated CSV rows to Supabase — creating `products`, `product_colors`, and `product_media` rows, logging one audit event, and showing a per-product success/failure summary — with production-grade handling of concurrency, partial failure, retries, and observability appropriate to this codebase's scale and architecture.

**Architecture:** This codebase has no server actions or DB-writing route handlers anywhere — every mutation goes through a client-side `services/*.ts` module using the browser Supabase client, relying on Postgres RLS (`is_admin()`) for authorization. This plan follows that exact pattern: a new `services/product-import.ts` module exposes `bulkImportProducts(groups, categories, options)`, called directly from the existing `'use client'` `ImportPageClient.tsx`. Products are created via chunked multi-row `insert()` calls (with a per-row, unique-violation-aware fallback if a chunk's batch insert fails), and colors/media are created via their own per-product multi-row inserts (not the single-row `createColor`/`uploadMedia` helpers — see the Task 4 rationale). Shared concerns — retry/backoff, error classification, and tunable constants — live in small dedicated modules (`lib/retry.ts`, `lib/import-errors.ts`, `lib/product-import-constants.ts`) so they're independently testable and reusable.

**Tech Stack:** Next.js 16 (App Router, React 19), TypeScript strict, Supabase JS client (browser), TanStack React Query, Vitest for unit tests, Tailwind v4.

## Global Constraints

- No server actions, API routes, or Edge Functions for this feature — mutations go through `services/*.ts` using `createClient()` from `@/lib/supabase/client` (or `createUntypedClient()` for untyped tables), matching every existing service module.
- TypeScript strict mode — `npx tsc --noEmit` must be clean after every task.
- Reuse existing, already-tested functions instead of duplicating logic: `getProductBySlug`/`deleteProduct` (`services/products.ts`), `normalizeForComparison` (`lib/csv-import/validate.ts`), `captureError` (`lib/monitoring.ts`, the codebase's existing Sentry/dev-console error-capture wrapper).
- `bulkImportProducts` must only be called with groups that have already passed `isValidFile()` (see `lib/csv-import/validate.ts:301`) — it trusts `group.price`/`group.status` to be non-null and does not re-validate CSV-level correctness.
- Grouping-by-name (one product per unique `name`) is **already implemented** in `lib/csv-import/group.ts` (MEI-42) — nothing in this plan re-implements it; `ProductGroup[]` already has one entry per unique product name, and colors are already deduplicated per product within a group.
- No dark mode, no CSS modules — Tailwind utility classes inline, light-only theme (`#faf8f5` background, `#c9a465`/`#B38B5D` gold accents), 11px uppercase tracking-widest labels for nav/section headers.
- Vitest tests: pure/`lib/`-level modules get colocated `<name>.test.ts` or live in `__tests__/lib/`; `services/*.ts` tests live in `__tests__/services/<name>.test.ts` and mock `@/lib/supabase/client`'s `createClient`/`createUntypedClient` — never a real network call. Client UI orchestration components (`ImportPageClient.tsx`, `ImportResultSummary.tsx`) are **not** unit-tested in this codebase (confirmed: no test file exists for any of `ImportPageClient`, `PreviewTree`, `ProductPreviewCard`, `FormatGuide`, `ImportDropzone`) — verify those with `tsc`, `eslint`, `npm run build`, and a manual dev-server pass instead.
- No new database migrations. `audit_logs.action` is `TEXT NOT NULL` with no CHECK constraint, so a new `'BULK_IMPORT'` action value needs no schema change; no import-history/idempotency table is introduced (see the Production Readiness Review's Idempotency section for why).

---

## Production Readiness Review

This section is the senior-engineer sign-off for this plan: for each production concern raised in review, it states the concrete decision, which task implements it, and — where a heavier solution was deliberately rejected — why. Read this before Task 4; the task itself implements exactly what's decided here.

**1. Atomicity & consistency.** There is no cross-table database transaction available in this architecture (confirmed: no server actions, no Postgres function wrapping multiple writes, no RPC — every existing multi-step write in this codebase, e.g. `ProductForm.tsx`'s create-then-upload-image flow, has this same limitation). Per-product boundary: a product's `products` row, its `product_colors` rows, and its `product_media` rows are only considered "done" together.
  - **Product insert fails:** nothing else happens for that product (no colors/media attempted) — recorded as a failure, no compensation needed since nothing committed.
  - **Color insert fails:** the product row already committed. `createColorsAndMedia` throws `ImportStageError('COLOR_INSERT_FAILED', ...)`; the catch block **compensates** by soft-deleting the product (`deleteProduct(productId)`, reusing the existing tested soft-delete) so it doesn't linger as an incomplete "ghost" product in the admin list, then records the product as a failure with `productId` still attached (so support/debugging can find the soft-deleted row if needed).
  - **Media insert fails:** same compensation path (`ImportStageError('MEDIA_INSERT_FAILED', ...)`) — if colors were already created for this product, they's are left in place under the now-soft-deleted product (harmless: soft-deleted products and everything scoped to them are excluded from every existing read path via `.is('deleted_at', null)`).
  - **Audit insert fails:** `logAuditEvent` already silently no-ops on any internal failure (existing behavior, confirmed in `lib/audit.ts` — "audit logging must never break the main operation") — the import itself is never blocked or rolled back by an audit-log failure. This is accepted as-is (unchanged from every other service in this codebase).
  - **Network fails halfway** (e.g. mid-chunk): whichever products in the current chunk didn't get a confirmed insert response are retried via `withRetryableQuery` (transient errors) or land in the per-row fallback path; anything that still can't be confirmed is reported as a failure for that product specifically — no other chunk or product is affected.
  - **How partial imports are prevented/handled:** they are not prevented (partial success is an explicit acceptance criterion — "any failures with reason") but are always contained to the smallest possible unit (one product), never a whole chunk or the whole import, and never leave an orphaned "half a product" visible in normal admin views.

**2. Concurrency.** Two admins importing simultaneously (or an admin re-running an import after a partial failure) both go through `resolveUniqueSlug`/`resolveUniqueProductCode`'s pre-check-then-reserve loop, which reduces but does not eliminate the race window between checking and inserting. Real protection comes from the DB's own unique constraints (`idx_products_slug`, `products_product_code_key`) plus **retry-on-unique-violation**: `insertProductRowWithRetry` (Task 4) detects a `UNIQUE_CONSTRAINT`-classified insert error and re-resolves a fresh slug/code (skipping everything already reserved in-memory this run) before retrying — the exact strategy already proven in `services/products.ts`'s `createProduct`, just applied to the bulk fallback path. This is tested explicitly (Task 4, "falls back to per-row insert with unique-violation retry").

**3. Idempotency.** No import-history/session table exists in this schema, and adding one is out of scope for this ticket (new migration + new admin surface for a feature whose only real risk is "admin double-clicks Import" or "admin re-uploads the same file"). Two layered, zero-new-schema safeguards instead:
  - **Accidental double-click:** the Import button is disabled the instant `importStatus` leaves `'idle'` (Task 6) — a second click while importing, or after completion, is a no-op.
  - **Accidental duplicate file re-upload:** `findExistingProductNames()` (Task 4) checks the CSV's product names against existing non-deleted product names (case-insensitive) *before* any writes begin; if any match, `ImportPageClient` shows a `window.confirm()` prompt (the same confirm-dialog pattern already used for delete confirmation on `app/(app)/products/page.tsx`) listing the names, and the admin must explicitly choose to proceed. This is "duplicate confirmation" from the brief's own suggested list — the pragmatic choice given `products.name` has no DB uniqueness constraint and no import-log table exists to hash/checksum against.

**4/5. Performance & bulk insert strategy.** Every DB-round-trip-per-row loop has been replaced with a batch call:
  - **Products:** one multi-row `insert()` per chunk of `PRODUCT_INSERT_CHUNK_SIZE` (200) resolved products — bounds a single request's payload size and keeps memory use flat regardless of import size, up to the enforced `MAX_IMPORT_PRODUCTS` ceiling (1000; rejected outright, before any writes, if exceeded). **Why 200, specifically, rather than one massive insert or one row at a time:** a single insert for up to 1000 products would put the entire import's fate behind one large HTTP request/response — a bigger payload, a bigger PostgREST/Postgres statement to plan and execute, and (per the concurrency/retry design) a bigger "blast radius" to redo if the batch has to fall back to per-row inserts after a failure. One row at a time would defeat the ticket's explicit ask for "a single Supabase multi-insert" and multiply round trips by 1000x in the worst case. 200 was chosen as the point where: the request/response payload stays small (a few hundred rows of scalar fields, well under any practical body-size concern), the progress UI can still show meaningful movement through `CREATING_PRODUCTS` rather than looking frozen for the entire import, and a chunk-level failure's fallback-to-per-row cost is bounded to at most 200 extra round trips rather than up to 1000 — i.e. it is a deliberate balance point between "as few requests as possible" and "as cheap as possible to retry/recover from a failure," not an arbitrary number.
  - **Colors and media:** originally planned to reuse the existing single-row `createColor`/`uploadMedia` helpers; upgraded here to one multi-row `insert()` per product per table (`product_colors`, `product_media`) instead, since a product can have several colors and many images and the architecture has no constraint preventing multi-row inserts into these tables. `createColor`/`uploadMedia` remain untouched and still used by their existing single-item call sites (the color dialog, the media uploader) — this bulk-import path just doesn't route through them, since they don't support arrays. This is a deliberate, documented divergence from strict reuse, justified by the ticket's own "single Supabase multi-insert" performance intent.
  - **Memory:** the whole parsed CSV already lives in memory as `GroupingResult` before this service ever runs (that's MEI-42's `parse.ts`, out of this ticket's scope) — `bulkImportProducts` does not duplicate that structure; it only builds the (much smaller) per-chunk insert-row arrays.
  - **Maximum supported rows:** documented as 1000 products per import (`MAX_IMPORT_PRODUCTS`), chunked in batches of 200 (`PRODUCT_INSERT_CHUNK_SIZE`) — both centralized in `lib/product-import-constants.ts`. Verified with a 250-product test exercising two chunks (Task 4).

**6. Validation before writes.** Duplicate CSV names / duplicate colors within a product / empty required fields are already caught upstream by MEI-42's `group.ts`+`validate.ts` (which this function trusts, per the Global Constraints). This function adds: duplicate product codes/slugs (in-memory reservation Sets + DB pre-check, Task 4), duplicate image URLs within a product/color scope (deduped in `createColorsAndMedia` before insert — see "Duplicate Media" below), invalid category references (`resolveCategoryId` returning `null`), and orphan media (structurally impossible — media rows are only ever built from a `productId`/`colorId` already confirmed to exist). Per-product resolution (category → slug → product code) happens entirely before that product is added to the insert batch — a product with any resolution failure contributes zero writes, by construction. This is a **per-product** abort boundary, not a whole-batch abort: per the ticket's own acceptance criteria ("any failures with reason"), one invalid product must not block the rest of a valid import.

**7. Retry policy.** `lib/retry.ts`'s `withRetry`/`withRetryableQuery` retries only errors classified as transient: Postgres `40001` (serialization_failure), `40P01` (deadlock_detected), `55P03` (lock_not_available), or network-shaped messages (`fetch failed`, `network`, `timeout`, `econnreset`, `econnrefused`, `429`/`too many requests`). Non-retryable errors (validation, unique-constraint, RLS-denied) are never retried by this generic mechanism — unique-constraint is instead handled by the dedicated slug/code re-resolution retry (point 2). Limits: 3 attempts, exponential backoff starting at 250ms (`250ms → 500ms`, both centralized as constants with override params for tests). This is deliberately conservative (3 attempts, not more) — a bulk import is an interactive admin action with a visible progress UI, not a background job, so unbounded retries would just make a stuck import look hung.

**8. Progress reporting.** `bulkImportProducts` accepts an `onProgress(stage: ImportStage)` callback firing exactly once per stage in order: `RESOLVING_CATEGORIES → GENERATING_IDENTIFIERS → CREATING_PRODUCTS → CREATING_COLORS_AND_MEDIA → LOGGING_AUDIT → COMPLETED`. `ImportPageClient` (Task 6) maps each stage to a human label shown in the existing full-page "importing" overlay instead of a single static "Importing…" string.

**9. Error classification.** `lib/import-errors.ts` defines `ImportErrorCode` (`CATEGORY_NOT_FOUND | SLUG_COLLISION | PRODUCT_CODE_COLLISION | PRODUCT_INSERT_FAILED | COLOR_INSERT_FAILED | MEDIA_INSERT_FAILED | NETWORK_TIMEOUT | DATABASE_ERROR | UNIQUE_CONSTRAINT | VALIDATION_FAILED | RLS_DENIED | UNKNOWN_ERROR`) plus `classifyError(err)` for raw/unexpected errors and `ImportStageError` for errors this code raises itself with a known cause. Every `BulkImportProductResult` failure now carries both a human `error` message and a machine-readable `errorCode`, surfaced in the results UI (Task 5).

**10/11. Import summary, throughput metrics & audit logging.** `BulkImportSummary` now includes `productsCreated`, `colorsCreated`, `mediaCreated`, `rowsProcessed`, `durationMs`, alongside `successCount`/`failureCount`/`results` — plus three throughput metrics computed purely from wall-clock timestamps already being tracked (no new infrastructure, no timers beyond `Date.now()`): `productsPerSecond` (`successCount / (durationMs / 1000)`), `rowsPerSecond` (`rowsProcessed / (durationMs / 1000)`), and `averageChunkDurationMs` (the mean of each chunk's own start-to-finish duration, tracked alongside the existing chunk loop). All three guard against division by zero (falling back to the raw count when `durationMs` rounds to 0, which can happen for a tiny/instant import) rather than producing `NaN`/`Infinity`. These are operational numbers an admin or a future maintainer can use to sanity-check "is this import behaving normally" without needing a dashboard or APM tool. The single `BULK_IMPORT` audit event's `newData` payload carries `filename`, `rowsProcessed`, `productsCreated`, `colorsCreated`, `mediaCreated`, `failureCount`, `durationMs`, `productsPerSecond`, `rowsPerSecond`, `averageChunkDurationMs`, and `productIds` — enough to reconstruct "what happened, and how fast" from the audit trail alone. It deliberately does **not** log raw per-row error messages, CSV content, or anything from the file beyond its name (avoids bloating `audit_logs.new_data` with what is essentially log data, and avoids ever writing customer-adjacent free-text fields like `description` into the audit trail). `admin_id` is not duplicated into the payload since `logAuditEvent` already stamps it from the authenticated session onto the row itself.

**12. Cache invalidation.** Only `['products']` (TanStack Query) needs invalidating — verified by reading `hooks/use-products.ts`, `hooks/use-categories.ts`, and `app/(app)/dashboard/page.tsx`: the dashboard's product/order/enquiry counts are fetched directly in a Server Component on every navigation (no client cache to invalidate, always fresh), there is no search/filter query key beyond the paginated `['products', options]` family (which `invalidateQueries({queryKey:['products']})` already matches via TanStack's prefix matching), and this feature never creates/modifies categories, so `['categories']` is untouched.

**13. Security.** Every write in this function goes through the same RLS-gated browser client as the rest of the app (`is_admin()` policies on `products`/`product_colors`/`product_media`/`audit_logs`, unchanged) — an insert this function's caller isn't authorized for fails exactly like any other write in this codebase, surfaced here as `errorCode: 'RLS_DENIED'` (tested in Task 4). CSV size/row limits: MEI-42's client-side parse step already loads the whole file into memory as text (out of this ticket's scope to change), so this plan adds its own ceiling at the point it owns — `MAX_IMPORT_PRODUCTS = 1000` products per call, rejected outright before any writes. There is no separate upload endpoint or payload limit to configure (file reading is 100% client-side `FileReader`, per MEI-42's design) and no rate limiting in front of the browser Supabase client beyond Supabase's own project-level limits, which this feature does not need to reason about further at admin-tool scale.

**14. Observability.** No structured-logging/APM pipeline exists in this codebase beyond `lib/monitoring.ts`'s `captureError()` (Sentry in production, `console.error` in development) — this plan uses exactly that, at the one place an unexpected failure needs a human to notice it outside the returned summary: if the compensating soft-delete itself fails after a color/media insert failure (`captureError(err, { context: 'bulk-import-compensation-failed', productId })`). Start/complete/duration/failure-reason/rows-processed are already captured structurally in the returned `BulkImportSummary` and the `BULK_IMPORT` audit row — that is this codebase's equivalent of "structured logging" for an admin-triggered synchronous action, and is preferred over ad hoc `console.log` calls (which existing conventions and this project's own prior task reports explicitly avoid in new code).

**15. Primary image logic.** Deterministic and index-based, enforced in `createColorsAndMedia` (Task 4): within each color's de-duplicated image list, the image at index 0 gets `is_primary: true` and every other image `is_primary: false`; independently, within the product's own (non-color) primary images, index 0 gets `is_primary: true`. This exactly matches the two partial unique indexes on `product_media` (`idx_pm_primary_product` scoped to `color_id IS NULL`, `idx_pm_primary_color` scoped to a specific `color_id`) — there is structurally at most one `is_primary: true` row per scope, never zero (if any images exist for that scope) and never more than one.

**16. Duplicate media.** Within `createColorsAndMedia`, a `Set<string>` of `${colorId}:${url}` (or `primary:${url}` for non-color images) keys is built while constructing the media-row array; a URL already seen for that exact product/color scope is skipped rather than inserted again. This directly prevents the case where a CSV lists the same `image_url` twice for the same color (the exact scenario MEI-42's template/format guide allows for "multiple images, one row per image" — a copy-paste duplicate row is a real, plausible admin mistake).

**17. Constants.** Centralized in `lib/product-import-constants.ts`: `MAX_SLUG_CODE_ATTEMPTS` (20 — matches the ticket's explicit acceptance criterion), `MAX_IMPORT_PRODUCTS` (1000), `PRODUCT_INSERT_CHUNK_SIZE` (200); retry tuning (`maxAttempts`/`baseDelayMs`) is centralized as defaults inside `lib/retry.ts` itself (`RetryOptions`), overridable per call and in tests.

**18. Testing.** Beyond the original unit tests, Task 4's suite adds: a 250-product test exercising chunking (representative of "large CSV" behavior without a multi-second, 1000-row real test), the unique-violation concurrency-retry path (simulating two writers racing for the same slug), a transient-network-error retry-then-succeed path, an RLS-denied classification path, a color/media-insert-failure compensation (soft-delete rollback) path, the `MAX_IMPORT_PRODUCTS` ceiling, `findExistingProductNames` (the idempotency safeguard), and every `onProgress` stage firing in order. `lib/retry.ts` and `lib/import-errors.ts` get their own full unit-test coverage (Task 3). This is not exhaustive of every conceivable failure mode (e.g. it does not spin up a real 1000-row import against a live Supabase project, which would need infrastructure this ticket doesn't own) but covers every code path this plan actually adds.

**19. Documentation.** This section *is* that documentation — assumptions, trade-offs, and rejected alternatives (checksum/session-id idempotency, full batch-insert of colors/media reusing the single-row helpers, unlimited retries, a new import-history table) are stated inline above with the reasoning, so a future reader doesn't have to reverse-engineer intent from code. Future scalability, if this ever needs to exceed today's realistic admin-tool scale: move the whole import to a Supabase Edge Function (this codebase already has one bulk-style precedent, `supabase/functions/bulk-create-variants/index.ts`) so retries/chunking happen server-side and the browser only uploads the file and polls a job id — genuinely out of scope today given the ticket, the codebase's current all-client-side-services architecture, and the realistic size of a boutique catalog's CSV imports.

**20. Code quality.** Strict TypeScript throughout (no `any`, casts limited to the same `as never`/response-shape pattern every existing service already uses for Supabase's generic inference quirks); no duplicated slug/product-code/retry logic (all three live in exactly one place each and are imported everywhere they're needed); constants centralized (point 17); every thrown/returned error carries a classified code rather than an ad hoc string comparison at the call site.

**21. Final architecture review.** The single largest residual risk is the lack of a real cross-table transaction — mitigated (not eliminated) by the compensation/soft-delete strategy in point 1, which is consistent with how the rest of this codebase already handles multi-step writes. No acceptance criterion depends on true atomicity (the ticket explicitly wants a per-product success/failure summary, which presupposes partial success is a valid outcome), so this is judged an acceptable, clearly-documented trade-off rather than a gap to fix before shipping. Everything else raised in review has a concrete implementation below.

**22. Stable product mapping.** Inserted rows are correlated back to their source `ProductGroup` by **array position**, not by product name. Within a chunk, `rowsToInsert[i]` is built by `.map()` directly over `batch[i]`, and Postgres/PostgREST preserve row order for a single multi-row `INSERT ... RETURNING` statement — so pairing `batchData[i]` with `batch[i].group` is a stable correlation that never depends on names being unique. The per-row fallback path goes further and doesn't need any correlation step at all: each row is paired with its resolved group inline, in the same loop iteration that inserts it. A synthetic client-side import id (a UUID generated per group during preparation) was considered instead of positional pairing, but rejected: `products` has no spare column to carry an arbitrary client-generated identifier through the insert-then-`RETURNING` round trip without a schema change, which is out of scope for this ticket — a migration purely to support internal request/response correlation would be disproportionate to the problem. Positional pairing achieves the same goal (no reliance on business data for correlation) without one. As a defensive guard against the row-order-preservation assumption ever being violated (e.g. a future PostgREST behavior change, or Supabase returning a partial/reordered result for some other reason), the batch path only trusts the positional zip when `batchData.length === batch.length`; any mismatch is treated exactly like a batch failure and falls back to the per-row path instead of silently mis-pairing a product with the wrong group (tested explicitly in Task 4, "falls back to per-row inserts if the batch insert returns a mismatched row count").

**23. Browser refresh / navigation behavior.** This is a 100%-client-side, synchronous-per-call import — there is no server-side job to resume, so behavior under interruption is worth stating explicitly:
  - **Browser tab closes or hard-refreshes mid-import:** the JS execution context is torn down immediately. Any Supabase request already in flight may still complete server-side (its write commits) or may be aborted by the browser's network stack first (nothing commits) — which one happens is outside this code's control. Whatever subset of products/colors/media *did* commit before the interruption remains in the database exactly as-is (visible on the next `/products` load), but with **no corresponding audit log entry**, since the single `BULK_IMPORT` audit write only happens after the whole import completes — an interrupted import leaves committed rows with no audit-trail record describing them. This is a known, accepted gap given the non-transactional architecture (point 1).
  - **The import is explicitly not resumable.** There is no persisted "which rows still need importing" state — that would require the import-history table this plan deliberately does not add (see Idempotency, point 3, and Keep Scope Controlled). If an admin reopens `/products/import` after an interruption and re-uploads the same file, the duplicate-name confirmation (point 3) will surface any product names that already made it into the database, letting them make an informed choice — but choosing to proceed re-attempts the *entire* file, not just the rows that didn't previously commit, since there is no mechanism to tell which those were.
  - **In-app (client-side route) navigation away from `/products/import` while importing** is guarded, not silently allowed to corrupt state — see AbortController Support below.

**24. AbortController support.** Supabase JS v2's query builders expose a chainable `.abortSignal(signal)`, so this is wired for every write this ticket's own code issues: the chunked product inserts (both `bulkImportProducts`'s batch path and its per-row fallback, via `insertProductRowWithRetry`) and the colors/media inserts (`createColorsAndMedia`) all accept and thread through an optional `AbortSignal` (`BulkImportOptions.signal`). `ImportPageClient` (Task 6) creates one `AbortController` per import attempt and aborts it from a `useEffect` cleanup function — this fires on component unmount, which covers client-side navigation away from the page while an import is in flight (and incidentally covers React 18/19 Strict Mode's mount→unmount→remount cycle in development). Before either the success or the error branch of `bulkImportProducts`'s result calls `setState`, `ImportPageClient` checks `controller.signal.aborted` and bails out if so — this avoids updating state on a component that has already unmounted. `lib/retry.ts`'s `isRetryableError` (Task 3) treats an aborted request (`err.name === 'AbortError'`) as **not** retryable, ahead of every other check, so an intentional cancellation is never mistaken for a transient failure and retried.
  - **Deliberately not wired:** the slug/code pre-check reads (`getProductBySlug`/`getProductByCode` in `services/products.ts`). These are pre-existing, already-tested, shared functions with other call sites (`createProduct`, `ProductForm.tsx`) — adding a `signal` parameter to their public signatures to save aborting a single-row, sub-100ms lookup is a disproportionate ripple for this ticket's scope, so they are explicitly out of scope for abort-wiring.
  - **Already-committed writes are never rolled back by an abort.** Aborting only stops *outstanding* (not-yet-resolved) requests from continuing to run and from triggering a stale `setState` — anything that already committed to Postgres before the abort signal fired stays committed, exactly as in the browser-refresh case above (point 23). Abort is a "stop making things worse," not a "roll back what happened," mechanism.

**25. Database assumptions.** This function's correctness depends on database constraints that already exist in this schema and are not re-created or re-verified by this code: `UNIQUE` on `products.slug` (the partial index `idx_products_slug`) and on `products.product_code` (`products_product_code_key`), `NOT NULL` on `products.name`/`price`/`product_code`, foreign keys from `product_colors.product_id` and `product_media.product_id`/`color_id` back to their parent rows, and the `is_admin()` RLS policies gating every insert into `products`/`product_colors`/`product_media`/`audit_logs`. The application-level checks this plan adds — in-memory reservation `Set`s, `resolveUniqueSlug`/`resolveUniqueProductCode`'s DB pre-checks, `resolveCategoryId` — are a performance/UX optimization: they let the common case succeed in one round trip and produce a friendly, specific error before ever reaching the database. They **complement, they do not replace**, the database's own constraints — the entire unique-violation retry path (point 2) exists precisely because the application-level pre-check cannot fully close the race window between checking and inserting, and it is the database's `UNIQUE` constraint, not this code, that guarantees correctness is never actually violated even when the application-level check is stale.

**26. Duplicate handling, by kind.** Five different things can reasonably be called "a duplicate" here, handled at five different layers — worth separating out since they're easy to conflate:
  - **Duplicate product names within one CSV:** already deduplicated upstream by MEI-42's `group.ts` (one `ProductGroup` per unique name) — this plan trusts that invariant (Global Constraints) and never itself sees duplicate names within a single `groups` array.
  - **Duplicate product names against the existing catalog** (e.g. re-uploading the same file, or a genuinely new product that happens to share a name with an old one): detected by `findExistingProductNames()` (case-insensitive, checked against the whole non-deleted catalog) and surfaced as a `window.confirm()` prompt — see Idempotency (point 3) — but never *blocked*, since `products.name` has no DB uniqueness constraint and two products can legitimately share a name.
  - **Duplicate slugs:** prevented primarily by `resolveUniqueSlug`'s pre-check-and-reserve loop, backstopped by the DB's own `UNIQUE` index and the unique-violation retry path — see Concurrency (point 2) and Database Assumptions (point 25).
  - **Duplicate product codes:** the same two-layer mechanism as slugs, via `resolveUniqueProductCode` and `products_product_code_key`.
  - **Duplicate image URLs:** within one product/color scope, deduplicated in `createColorsAndMedia` via a `${colorId}:${url}` (or `primary:${url}`) key `Set` checked before each row is added to the insert batch — see "Duplicate media" (point 16). Deliberately *not* deduplicated across different products — the same image URL reused for two different products (e.g. a shared placeholder) is a legitimate scenario, not a mistake.
  - **Duplicate colors within one product:** already deduplicated upstream by MEI-42's `group.ts` (one `ProductColor` per unique label per product, with that color's images merged across CSV rows) — this plan trusts that invariant too. There is no DB uniqueness constraint on `product_colors (product_id, label)`, so if that upstream invariant were ever violated, two same-labeled color rows could technically be created for one product — an accepted, explicitly documented gap consistent with this plan's overall trust boundary around MEI-42's grouping output.

---

### Task 1: Extract `generateSlug` into a shared utility

**Files:**
- Create: `lib/slug.ts`
- Create: `__tests__/lib/slug.test.ts`
- Modify: `components/products/ProductForm.tsx:3-12` (add import), `components/products/ProductForm.tsx:121-129` (remove local definition)

**Interfaces:**
- Produces: `generateSlug(value: string): string` — used by Task 4's `resolveUniqueSlug`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/slug.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { generateSlug } from '@/lib/slug'

describe('generateSlug', () => {
  it('lowercases and hyphenates a simple name', () => {
    expect(generateSlug('Bridal Lehenga A2')).toBe('bridal-lehenga-a2')
  })

  it('strips punctuation characters', () => {
    expect(generateSlug("Women's Silk Saree!")).toBe('womens-silk-saree')
  })

  it('collapses repeated spaces, underscores, and hyphens into one hyphen', () => {
    expect(generateSlug('Red   -- Gold_ _Lehenga')).toBe('red-gold-lehenga')
  })

  it('trims leading and trailing hyphens', () => {
    expect(generateSlug('  -Gown-  ')).toBe('gown')
  })

  it('returns an empty string for an all-punctuation input', () => {
    expect(generateSlug('!!!')).toBe('')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __tests__/lib/slug.test.ts`
Expected: FAIL — `Cannot find module '@/lib/slug'`

- [ ] **Step 3: Create `lib/slug.ts`**

```ts
export function generateSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/lib/slug.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Update `ProductForm.tsx` to use the shared utility**

In `components/products/ProductForm.tsx`, add the import alongside the existing imports (after line 10, `import type { Category } from '@/types';`):

```ts
import { generateSlug } from '@/lib/slug';
```

Then delete the local function definition at lines 121-129:

```ts
  // Auto-generate slug from name
  const generateSlug = (val: string) => {
    return val
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // remove non-word characters
      .replace(/[\s_-]+/g, '-') // replace spaces/underscores with hyphens
      .replace(/^-+|-+$/g, ''); // remove leading/trailing hyphens
  };

```

Leave `handleNameChange` (which calls `generateSlug(val)`) untouched — it now resolves to the imported function.

- [ ] **Step 6: Verify no regressions**

Run: `npx tsc --noEmit`
Expected: no new errors involving `ProductForm.tsx` or `lib/slug.ts`

- [ ] **Step 7: Commit**

```bash
git add lib/slug.ts __tests__/lib/slug.test.ts components/products/ProductForm.tsx
git commit -m "Extract generateSlug into a shared lib/slug.ts utility (MEI-43)"
```

---

### Task 2: Extract `generateProductCode`, add `getProductByCode`

**Files:**
- Create: `lib/product-code.ts`
- Create: `__tests__/lib/product-code.test.ts`
- Modify: `services/products.ts:1` (add import), `services/products.ts:44-48` (use shared helper), `services/products.ts` (add `getProductByCode` after `getProductBySlug`, i.e. after line 143)
- Modify: `__tests__/services/products.test.ts` (add `getProductByCode` to the destructured import, add a new `describe('getProductByCode', ...)` block)

**Interfaces:**
- Produces: `generateProductCode(name: string): string` and `getProductByCode(productCode: string): Promise<{ id: string; product_code: string } | null>` — both used by Task 4's `resolveUniqueProductCode`.

- [ ] **Step 1: Write the failing test for `generateProductCode`**

Create `__tests__/lib/product-code.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { generateProductCode } from '@/lib/product-code'

describe('generateProductCode', () => {
  it('prefixes with MEI- and a 6-character uppercase name segment', () => {
    const code = generateProductCode('Lehenga A2')
    expect(code.startsWith('MEI-LEHENG-')).toBe(true)
  })

  it('strips non-alphanumeric characters from the name segment', () => {
    const code = generateProductCode("Women's Silk Saree!")
    expect(code).toMatch(/^MEI-WOMENS-[A-Z0-9]{4}$/)
  })

  it('truncates the name segment to 6 characters', () => {
    const code = generateProductCode('SuperLongProductName')
    expect(code.split('-')[1]).toHaveLength(6)
  })

  it('generates a 4-character uppercase alphanumeric random suffix', () => {
    const code = generateProductCode('Gown')
    const suffix = code.split('-')[2]
    expect(suffix).toMatch(/^[A-Z0-9]{4}$/)
  })

  it('produces different codes across calls for the same name', () => {
    const codes = new Set(Array.from({ length: 10 }, () => generateProductCode('Gown')))
    expect(codes.size).toBeGreaterThan(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __tests__/lib/product-code.test.ts`
Expected: FAIL — `Cannot find module '@/lib/product-code'`

- [ ] **Step 3: Create `lib/product-code.ts`**

```ts
export function generateProductCode(name: string): string {
  const sanitizedName = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 6)
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `MEI-${sanitizedName}-${randomSuffix}`
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/lib/product-code.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Wire `services/products.ts` to use the shared helper**

Add the import at the top of `services/products.ts` (after line 1, `import { createClient } from '@/lib/supabase/client'`):

```ts
import { generateProductCode } from '@/lib/product-code'
```

Replace lines 44-48:

```ts
  // Auto-generate unique product_code if not provided
  const productWithCode = {
    ...product,
    product_code: product.product_code || `MEI-${product.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
  }
```

with:

```ts
  // Auto-generate unique product_code if not provided
  const productWithCode = {
    ...product,
    product_code: product.product_code || generateProductCode(product.name)
  }
```

- [ ] **Step 6: Run the existing product service tests to confirm no regression**

Run: `npx vitest run __tests__/services/products.test.ts`
Expected: PASS (all existing tests, unchanged behavior)

- [ ] **Step 7: Write the failing test for `getProductByCode`**

In `__tests__/services/products.test.ts`, update the destructured import (currently `const { getProducts, createProduct, updateProduct, deleteProduct, getProductBySlug } = await import('@/services/products')`) to also include `getProductByCode`:

```ts
const { getProducts, createProduct, updateProduct, deleteProduct, getProductBySlug, getProductByCode } = await import('@/services/products')
```

Add this new `describe` block directly after the existing `describe('getProductBySlug', ...)` block (which ends around line 163, right before `describe('createProduct — slug disambiguation', ...)`):

```ts
describe('getProductByCode', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when no product matches (PGRST116)', async () => {
    mockFrom.mockReturnValueOnce(createChain({ data: null, error: { code: 'PGRST116', message: 'No rows found' } }))
    const result = await getProductByCode('MEI-NOPE-0000')
    expect(result).toBeNull()
  })

  it('returns { id, product_code } when a product matches', async () => {
    mockFrom.mockReturnValueOnce(createChain({ data: { id: 'p1', product_code: 'MEI-LEHENG-AB12' }, error: null }))
    const result = await getProductByCode('MEI-LEHENG-AB12')
    expect(result).toEqual({ id: 'p1', product_code: 'MEI-LEHENG-AB12' })
  })

  it('throws on unexpected Supabase error', async () => {
    mockFrom.mockReturnValueOnce(createChain({ data: null, error: { code: '42501', message: 'permission denied' } }))
    await expect(getProductByCode('any')).rejects.toThrow('permission denied')
  })
})
```

- [ ] **Step 8: Run the test to verify it fails**

Run: `npx vitest run __tests__/services/products.test.ts`
Expected: FAIL — `getProductByCode is not a function` / `undefined`

- [ ] **Step 9: Add `getProductByCode` to `services/products.ts`**

Add this function directly after `getProductBySlug` (after line 143):

```ts
export async function getProductByCode(productCode: string): Promise<{ id: string; product_code: string } | null> {
  const supabase = createClient()
  const response = await supabase
    .from('products')
    .select('id, product_code')
    .eq('product_code', productCode)
    .is('deleted_at', null)
    .single()
  const { data, error } = response as { data: { id: string; product_code: string } | null; error: { message: string; code: string } | null }
  if (error && error.code !== 'PGRST116') throw toAppError(new Error(error.message))
  return data ?? null
}
```

- [ ] **Step 10: Run the test to verify it passes**

Run: `npx vitest run __tests__/services/products.test.ts`
Expected: PASS (all tests, including the 3 new `getProductByCode` tests)

- [ ] **Step 11: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 12: Commit**

```bash
git add lib/product-code.ts __tests__/lib/product-code.test.ts services/products.ts __tests__/services/products.test.ts
git commit -m "Extract generateProductCode utility and add getProductByCode lookup (MEI-43)"
```

---

### Task 3: Shared production-grade utilities — retry/backoff and error classification

**Files:**
- Create: `lib/retry.ts`
- Create: `__tests__/lib/retry.test.ts`
- Create: `lib/import-errors.ts`
- Create: `__tests__/lib/import-errors.test.ts`
- Create: `lib/product-import-constants.ts`

**Interfaces:**
- Produces: `withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>`, `withRetryableQuery<T extends {data:unknown; error:{code?:string;message:string}|null}>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>`, `isRetryableError(err: unknown): boolean`, `RetryOptions { maxAttempts?: number; baseDelayMs?: number; isRetryable?: (err: unknown) => boolean }` (from `lib/retry.ts`); `ImportErrorCode` union, `ImportStageError` class (`.code: ImportErrorCode`), `classifyError(err: unknown): ImportErrorCode` (from `lib/import-errors.ts`); `MAX_SLUG_CODE_ATTEMPTS`, `MAX_IMPORT_PRODUCTS`, `PRODUCT_INSERT_CHUNK_SIZE` (from `lib/product-import-constants.ts`) — all consumed by Task 4's `services/product-import.ts`.

- [ ] **Step 1: Write the failing tests for `withRetry`/`withRetryableQuery`**

Create `__tests__/lib/retry.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { withRetry, withRetryableQuery } from '@/lib/retry'

describe('withRetry', () => {
  it('returns the result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on a retryable error and eventually succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ code: '40001', message: 'serialization_failure' })
      .mockResolvedValueOnce('ok')
    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('rethrows immediately on a non-retryable error', async () => {
    const fn = vi.fn().mockRejectedValue({ code: '23505', message: 'duplicate key' })
    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 })).rejects.toMatchObject({ code: '23505' })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('gives up after maxAttempts and rethrows the last error', async () => {
    const fn = vi.fn().mockRejectedValue({ code: '40001', message: 'serialization_failure' })
    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 })).rejects.toMatchObject({ code: '40001' })
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('treats network-ish error messages as retryable', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fetch failed: network timeout'))
      .mockResolvedValueOnce('ok')
    const result = await withRetry(fn, { maxAttempts: 2, baseDelayMs: 1 })
    expect(result).toBe('ok')
  })

  it('does not retry an aborted request, even though its message looks network-related', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError')
    const fn = vi.fn().mockRejectedValue(abortError)
    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 })).rejects.toThrow('The operation was aborted')
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('withRetryableQuery', () => {
  it('returns the successful result unchanged', async () => {
    const fn = vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null })
    const result = await withRetryableQuery(fn, { baseDelayMs: 1 })
    expect(result).toEqual({ data: [{ id: '1' }], error: null })
  })

  it('returns a non-retryable error result unchanged (no throw)', async () => {
    const fn = vi.fn().mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key' } })
    const result = await withRetryableQuery(fn, { baseDelayMs: 1 })
    expect(result.error).toEqual({ code: '23505', message: 'duplicate key' })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries a retryable error result and returns the eventual success', async () => {
    const fn = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { code: '40001', message: 'serialization_failure' } })
      .mockResolvedValueOnce({ data: [{ id: '1' }], error: null })
    const result = await withRetryableQuery(fn, { maxAttempts: 3, baseDelayMs: 1 })
    expect(result).toEqual({ data: [{ id: '1' }], error: null })
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('returns { data: null, error } (not a throw) after exhausting retries on a persistent transient error', async () => {
    const fn = vi.fn().mockResolvedValue({ data: null, error: { code: '40001', message: 'serialization_failure' } })
    const result = await withRetryableQuery(fn, { maxAttempts: 2, baseDelayMs: 1 })
    expect(result.data).toBeNull()
    expect(result.error).toMatchObject({ code: '40001' })
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run __tests__/lib/retry.test.ts`
Expected: FAIL — `Cannot find module '@/lib/retry'`

- [ ] **Step 3: Create `lib/retry.ts`**

```ts
export interface RetryOptions {
  maxAttempts?: number
  baseDelayMs?: number
  isRetryable?: (err: unknown) => boolean
}

const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_BASE_DELAY_MS = 250

/**
 * Transient/retryable failures: Postgres serialization/deadlock/lock errors
 * and network-shaped messages. Deliberately excludes unique-constraint (23505)
 * and RLS/permission errors — those are handled by dedicated logic elsewhere
 * (slug/code re-resolution, surfaced directly to the admin) rather than blind
 * retries. Also excludes aborted requests (AbortError) ahead of every other
 * check — retrying something the caller explicitly cancelled (component
 * unmount, navigation away) would be wrong regardless of what the error
 * message happens to say.
 */
export function isRetryableError(err: unknown): boolean {
  const name = (err as { name?: string } | null | undefined)?.name
  if (name === 'AbortError') return false

  const code = (err as { code?: string } | null | undefined)?.code
  const message = (err instanceof Error ? err.message : String((err as { message?: unknown } | null)?.message ?? err ?? '')).toLowerCase()

  return (
    code === '40001' || // serialization_failure
    code === '40P01' || // deadlock_detected
    code === '55P03' || // lock_not_available
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('econnreset') ||
    message.includes('econnrefused') ||
    message.includes('429') ||
    message.includes('too many requests')
  )
}

/**
 * Retries `fn` with exponential backoff (baseDelayMs * 2^attempt) while
 * `isRetryable(err)` is true. Non-retryable errors rethrow immediately.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS
  const isRetryable = options.isRetryable ?? isRetryableError

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === maxAttempts || !isRetryable(err)) throw err
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** (attempt - 1)))
    }
  }
  // Unreachable: the loop above always returns or throws.
  throw new Error('withRetry: exhausted attempts without a result')
}

/**
 * Wraps a Supabase-style `{ data, error }` call with retry-on-transient-error
 * behavior, without changing its return contract. A non-retryable error (or
 * final exhaustion of a retryable one) comes back as a normal
 * `{ data: null, error }` result — callers never need a try/catch.
 */
export async function withRetryableQuery<T extends { data: unknown; error: { code?: string; message: string } | null }>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const isRetryable = options.isRetryable ?? isRetryableError
  try {
    return await withRetry(async () => {
      const result = await fn()
      if (result.error && isRetryable(result.error)) throw result.error
      return result
    }, options)
  } catch (err) {
    return { data: null, error: err } as T
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run __tests__/lib/retry.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Write the failing tests for error classification**

Create `__tests__/lib/import-errors.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { classifyError, ImportStageError } from '@/lib/import-errors'

describe('classifyError', () => {
  it('classifies a Postgres unique violation by code', () => {
    expect(classifyError({ code: '23505', message: 'duplicate key value' })).toBe('UNIQUE_CONSTRAINT')
  })

  it('classifies a unique violation surfaced only in the message', () => {
    expect(classifyError(new Error('duplicate key value violates unique constraint "products_slug_unique"'))).toBe('UNIQUE_CONSTRAINT')
  })

  it('classifies an RLS/permission denial', () => {
    expect(classifyError(new Error('new row violates row-level security policy'))).toBe('RLS_DENIED')
  })

  it('classifies a network/timeout failure', () => {
    expect(classifyError(new Error('fetch failed: network timeout'))).toBe('NETWORK_TIMEOUT')
  })

  it('classifies an unrecognized error as DATABASE_ERROR', () => {
    expect(classifyError(new Error('unexpected constraint violation'))).toBe('DATABASE_ERROR')
  })

  it('classifies a null error as UNKNOWN_ERROR', () => {
    expect(classifyError(null)).toBe('UNKNOWN_ERROR')
  })

  it('returns the code directly for an ImportStageError', () => {
    expect(classifyError(new ImportStageError('MEDIA_INSERT_FAILED', 'insert failed'))).toBe('MEDIA_INSERT_FAILED')
  })
})

describe('ImportStageError', () => {
  it('carries its error code alongside the message', () => {
    const err = new ImportStageError('COLOR_INSERT_FAILED', 'insert failed')
    expect(err.code).toBe('COLOR_INSERT_FAILED')
    expect(err.message).toBe('insert failed')
    expect(err).toBeInstanceOf(Error)
  })
})
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `npx vitest run __tests__/lib/import-errors.test.ts`
Expected: FAIL — `Cannot find module '@/lib/import-errors'`

- [ ] **Step 7: Create `lib/import-errors.ts`**

```ts
export type ImportErrorCode =
  | 'CATEGORY_NOT_FOUND'
  | 'SLUG_COLLISION'
  | 'PRODUCT_CODE_COLLISION'
  | 'PRODUCT_INSERT_FAILED'
  | 'COLOR_INSERT_FAILED'
  | 'MEDIA_INSERT_FAILED'
  | 'NETWORK_TIMEOUT'
  | 'DATABASE_ERROR'
  | 'UNIQUE_CONSTRAINT'
  | 'VALIDATION_FAILED'
  | 'RLS_DENIED'
  | 'UNKNOWN_ERROR'

/** An error this module's own code raises for a known cause (as opposed to
 * an unexpected error surfaced from Supabase) — carries its classification
 * directly, so classifyError() doesn't need to re-derive it from a message. */
export class ImportStageError extends Error {
  constructor(public readonly code: ImportErrorCode, message: string) {
    super(message)
    this.name = 'ImportStageError'
  }
}

/**
 * Maps a raw thrown/returned error (Postgres error object, Error, or
 * Supabase error shape) to a coarse ImportErrorCode for the import summary.
 */
export function classifyError(err: unknown): ImportErrorCode {
  if (err == null) return 'UNKNOWN_ERROR'
  if (err instanceof ImportStageError) return err.code

  const code = (err as { code?: string }).code
  const message = (err instanceof Error ? err.message : String((err as { message?: unknown } | null)?.message ?? err)).toLowerCase()

  if (code === '23505' || message.includes('duplicate key') || message.includes('unique constraint')) {
    return 'UNIQUE_CONSTRAINT'
  }
  if (message.includes('row-level') || message.includes('permission denied') || message.includes('policy')) {
    return 'RLS_DENIED'
  }
  if (message.includes('fetch failed') || message.includes('network') || message.includes('timeout') || message.includes('econnreset') || message.includes('econnrefused')) {
    return 'NETWORK_TIMEOUT'
  }
  if (message.includes('validation')) {
    return 'VALIDATION_FAILED'
  }
  if (message === '' || message === 'undefined') {
    return 'UNKNOWN_ERROR'
  }
  return 'DATABASE_ERROR'
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run __tests__/lib/import-errors.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 9: Create the centralized constants file**

Create `lib/product-import-constants.ts`:

```ts
/** Slug and product_code collision-retry ceiling — matches the ticket's
 * "collision retried up to 20 attempts per product" acceptance criterion. */
export const MAX_SLUG_CODE_ATTEMPTS = 20

/** Hard ceiling on products per bulk import call. Rejected outright, before
 * any writes, if exceeded — protects both the browser (which already holds
 * the whole parsed CSV in memory from MEI-42's client-side parse step) and
 * Supabase from an unbounded single import. */
export const MAX_IMPORT_PRODUCTS = 1000

/** Products per multi-row insert() call. Bounds a single request's payload
 * size; MAX_IMPORT_PRODUCTS / this value is the maximum number of chunks. */
export const PRODUCT_INSERT_CHUNK_SIZE = 200
```

- [ ] **Step 10: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 11: Commit**

```bash
git add lib/retry.ts __tests__/lib/retry.test.ts lib/import-errors.ts __tests__/lib/import-errors.test.ts lib/product-import-constants.ts
git commit -m "Add retry/backoff and error-classification utilities for bulk import (MEI-43)"
```

---

### Task 4: Create `services/product-import.ts` — category/slug/code resolution and batch insert

**Files:**
- Modify: `lib/audit.ts:4` (widen `AuditAction` union)
- Create: `services/product-import.ts`
- Create: `__tests__/services/product-import.test.ts`

**Interfaces:**
- Consumes: `generateSlug` (Task 1), `generateProductCode`/`getProductByCode` (Task 2), `getProductBySlug`/`deleteProduct` (`services/products.ts`), `withRetry`/`withRetryableQuery` (Task 3), `classifyError`/`ImportStageError`/`ImportErrorCode` (Task 3), `MAX_SLUG_CODE_ATTEMPTS`/`MAX_IMPORT_PRODUCTS`/`PRODUCT_INSERT_CHUNK_SIZE` (Task 3), `captureError` (`lib/monitoring.ts`), `normalizeForComparison` (`lib/csv-import/validate.ts`), `logAuditEvent` (`lib/audit.ts`), `ProductGroup` type (`lib/csv-import/types.ts`).
- Produces: `resolveCategoryId(categoryName: string, categories: Array<{id,name}>): string | null`, `resolveUniqueSlug(name: string, reservedSlugs: Set<string>): Promise<string | null>`, `resolveUniqueProductCode(name: string, reservedCodes: Set<string>): Promise<string | null>`, `findExistingProductNames(names: string[]): Promise<string[]>`, `bulkImportProducts(groups: ProductGroup[], categories: Array<{id,name}>, options?: BulkImportOptions): Promise<BulkImportSummary>`, and the types `ImportStage`, `BulkImportOptions { filename?: string; onProgress?: (stage: ImportStage) => void; signal?: AbortSignal }`, `BulkImportProductResult { name: string; success: boolean; productId?: string; error?: string; errorCode?: ImportErrorCode }`, `BulkImportSummary { successCount: number; failureCount: number; productsCreated: number; colorsCreated: number; mediaCreated: number; rowsProcessed: number; durationMs: number; productsPerSecond: number; rowsPerSecond: number; averageChunkDurationMs: number; results: BulkImportProductResult[] }` — all consumed by Task 5 (`ImportResultSummary` consumes `BulkImportSummary`) and Task 6 (`ImportPageClient.tsx` consumes everything else, and creates the `AbortController` whose `.signal` is passed as `options.signal`).

- [ ] **Step 1: Widen the audit action type**

In `lib/audit.ts`, change line 4:

```ts
type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE'
```

to:

```ts
type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'BULK_IMPORT'
```

(No DB migration needed — `audit_logs.action` is `TEXT NOT NULL` with no CHECK constraint restricting values.)

- [ ] **Step 2: Verify no regression**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Write the failing tests for `resolveCategoryId`, `resolveUniqueSlug`, `resolveUniqueProductCode`, `findExistingProductNames`**

Create `__tests__/services/product-import.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: mockFrom }),
  createUntypedClient: () => ({ from: mockFrom }),
}))

const mockGenerateProductCode = vi.fn(() => 'MEI-TEST-CODE')
vi.mock('@/lib/product-code', () => ({
  generateProductCode: (name: string) => mockGenerateProductCode(name),
}))

const mockCaptureError = vi.fn()
vi.mock('@/lib/monitoring', () => ({
  captureError: (...args: unknown[]) => mockCaptureError(...args),
}))

const {
  bulkImportProducts,
  resolveCategoryId,
  resolveUniqueSlug,
  resolveUniqueProductCode,
  findExistingProductNames,
} = await import('@/services/product-import')

import { PRODUCT_INSERT_CHUNK_SIZE } from '@/lib/product-import-constants'
import type { ProductGroup } from '@/lib/csv-import/types'

interface MockChain extends Record<string, unknown> {
  then: (onFulfilled?: ((value: unknown) => unknown) | null, onRejected?: ((reason: unknown) => unknown) | null) => Promise<unknown>
  catch: (onRejected?: ((reason: unknown) => unknown) | null) => Promise<unknown>
  finally: (onFinally?: (() => void) | null) => Promise<unknown>
}

function createChain(finalValue: unknown): MockChain {
  const chain: MockChain = {} as MockChain
  const methods = ['select', 'insert', 'update', 'is', 'eq', 'single']
  methods.forEach((m) => { chain[m] = vi.fn(() => chain) })
  const promise = Promise.resolve(finalValue)
  chain.then = (onFulfilled, onRejected) => promise.then(onFulfilled, onRejected)
  chain.catch = (onRejected) => promise.catch(onRejected)
  chain.finally = (onFinally) => promise.finally(onFinally)
  return chain
}

const NOT_FOUND = { data: null, error: { code: 'PGRST116', message: 'No rows found' } }

function makeGroup(overrides: Partial<ProductGroup> = {}): ProductGroup {
  return {
    name: 'Lehenga A',
    rawName: 'Lehenga A',
    originalRowIndex: 2,
    categoryName: 'Bridal Lehengas',
    price: 45000,
    rawPrice: '45000',
    status: 'PUBLISHED',
    rawStatus: 'PUBLISHED',
    workTypes: [],
    rawWorkTypes: '',
    shortDescription: null,
    description: null,
    colors: [],
    primaryImages: [{ url: 'https://example.com/a.jpg', isFromRow: 2 }],
    errors: [],
    groupRowIndices: [2],
    ...overrides,
  }
}

const categories = [{ id: 'cat-1', name: 'Bridal Lehengas' }]

describe('resolveCategoryId', () => {
  it('matches a category name case-insensitively', () => {
    expect(resolveCategoryId('bridal lehengas', categories)).toBe('cat-1')
  })

  it('returns null when no category matches', () => {
    expect(resolveCategoryId('Sarees', categories)).toBeNull()
  })
})

describe('resolveUniqueSlug', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the base slug when it is available', async () => {
    mockFrom.mockReturnValueOnce(createChain(NOT_FOUND))
    const slug = await resolveUniqueSlug('Lehenga A', new Set())
    expect(slug).toBe('lehenga-a')
  })

  it('skips slugs already reserved in-memory for this batch', async () => {
    const reserved = new Set(['lehenga-a'])
    mockFrom.mockReturnValueOnce(createChain(NOT_FOUND))
    const slug = await resolveUniqueSlug('Lehenga A', reserved)
    expect(slug).toBe('lehenga-a-2')
  })

  it('appends a numeric suffix when the base slug exists in the DB', async () => {
    mockFrom
      .mockReturnValueOnce(createChain({ data: { id: 'existing', slug: 'lehenga-a' }, error: null }))
      .mockReturnValueOnce(createChain(NOT_FOUND))
    const slug = await resolveUniqueSlug('Lehenga A', new Set())
    expect(slug).toBe('lehenga-a-2')
  })

  it('returns null after 20 failed attempts', async () => {
    for (let i = 0; i < 20; i++) {
      mockFrom.mockReturnValueOnce(createChain({ data: { id: `x${i}`, slug: 'taken' }, error: null }))
    }
    const slug = await resolveUniqueSlug('Lehenga A', new Set())
    expect(slug).toBeNull()
  })
})

describe('resolveUniqueProductCode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateProductCode.mockReturnValue('MEI-TEST-CODE')
  })

  it('returns the generated code when it is available', async () => {
    mockFrom.mockReturnValueOnce(createChain(NOT_FOUND))
    const code = await resolveUniqueProductCode('Lehenga A', new Set())
    expect(code).toBe('MEI-TEST-CODE')
  })

  it('regenerates when the candidate collides in the DB', async () => {
    mockGenerateProductCode
      .mockReturnValueOnce('MEI-TEST-CODE')
      .mockReturnValueOnce('MEI-TEST-CODE2')
    mockFrom
      .mockReturnValueOnce(createChain({ data: { id: 'existing', product_code: 'MEI-TEST-CODE' }, error: null }))
      .mockReturnValueOnce(createChain(NOT_FOUND))
    const code = await resolveUniqueProductCode('Lehenga A', new Set())
    expect(code).toBe('MEI-TEST-CODE2')
  })

  it('regenerates when the candidate is already reserved in-memory', async () => {
    const reserved = new Set(['MEI-TEST-CODE'])
    mockGenerateProductCode
      .mockReturnValueOnce('MEI-TEST-CODE')
      .mockReturnValueOnce('MEI-TEST-CODE2')
    mockFrom.mockReturnValueOnce(createChain(NOT_FOUND))
    const code = await resolveUniqueProductCode('Lehenga A', reserved)
    expect(code).toBe('MEI-TEST-CODE2')
  })
})

describe('findExistingProductNames', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns an empty array when given no names, without querying the DB', async () => {
    const result = await findExistingProductNames([])
    expect(result).toEqual([])
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns names that already exist in the DB, case-insensitively', async () => {
    mockFrom.mockReturnValueOnce(createChain({ data: [{ name: 'Bridal Lehenga A1' }], error: null }))
    const result = await findExistingProductNames(['bridal lehenga a1', 'New Gown'])
    expect(result).toEqual(['bridal lehenga a1'])
  })

  it('returns an empty array when none of the names exist', async () => {
    mockFrom.mockReturnValueOnce(createChain({ data: [{ name: 'Something Else' }], error: null }))
    const result = await findExistingProductNames(['New Gown'])
    expect(result).toEqual([])
  })

  it('throws on a Supabase error', async () => {
    mockFrom.mockReturnValueOnce(createChain({ data: null, error: { message: 'DB error' } }))
    await expect(findExistingProductNames(['X'])).rejects.toThrow('DB error')
  })
})
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run __tests__/services/product-import.test.ts`
Expected: FAIL — `Cannot find module '@/services/product-import'`

- [ ] **Step 5: Create `services/product-import.ts` — resolution helpers only (no `bulkImportProducts` yet)**

```ts
import { createClient } from '@/lib/supabase/client'
import { getProductBySlug, getProductByCode } from '@/services/products'
import { generateSlug } from '@/lib/slug'
import { generateProductCode } from '@/lib/product-code'
import { normalizeForComparison } from '@/lib/csv-import/validate'
import { withRetry, withRetryableQuery } from '@/lib/retry'
import { MAX_SLUG_CODE_ATTEMPTS } from '@/lib/product-import-constants'

export function resolveCategoryId(
  categoryName: string,
  categories: Array<{ id: string; name: string }>
): string | null {
  const normalized = normalizeForComparison(categoryName, false)
  const match = categories.find((c) => normalizeForComparison(c.name, false) === normalized)
  return match?.id ?? null
}

export async function resolveUniqueSlug(name: string, reservedSlugs: Set<string>): Promise<string | null> {
  const baseSlug = generateSlug(name)
  for (let attempt = 1; attempt <= MAX_SLUG_CODE_ATTEMPTS; attempt++) {
    const candidate = attempt === 1 ? baseSlug : `${baseSlug}-${attempt}`
    if (reservedSlugs.has(candidate)) continue
    const existing = await withRetry(() => getProductBySlug(candidate))
    if (!existing) {
      reservedSlugs.add(candidate)
      return candidate
    }
  }
  return null
}

export async function resolveUniqueProductCode(name: string, reservedCodes: Set<string>): Promise<string | null> {
  for (let attempt = 1; attempt <= MAX_SLUG_CODE_ATTEMPTS; attempt++) {
    const candidate = generateProductCode(name)
    if (reservedCodes.has(candidate)) continue
    const existing = await withRetry(() => getProductByCode(candidate))
    if (!existing) {
      reservedCodes.add(candidate)
      return candidate
    }
  }
  return null
}

/**
 * Finds which of the given product names already exist (case-insensitively,
 * ignoring soft-deleted rows). Used as a pre-import duplicate-import
 * safeguard: if an admin re-uploads a CSV they already imported, the
 * matching names surface in a confirmation prompt before any writes happen
 * (see ImportPageClient.tsx). There is no import-history table in this
 * schema, so this name-based check — rather than a CSV checksum or session
 * id, which would need new tables — is the pragmatic, zero-new-schema
 * safeguard for this ticket's scope.
 */
export async function findExistingProductNames(names: string[]): Promise<string[]> {
  if (names.length === 0) return []
  const supabase = createClient()
  const response = await withRetryableQuery(() =>
    supabase.from('products').select('name').is('deleted_at', null)
  )
  const { data, error } = response as { data: Array<{ name: string }> | null; error: { message: string } | null }
  if (error) throw new Error(error.message)

  const existingNormalized = new Set((data ?? []).map((p) => normalizeForComparison(p.name, false)))
  return names.filter((name) => existingNormalized.has(normalizeForComparison(name, false)))
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run __tests__/services/product-import.test.ts`
Expected: PASS (`resolveCategoryId`, `resolveUniqueSlug`, `resolveUniqueProductCode`, `findExistingProductNames` describe blocks — 13 tests)

- [ ] **Step 7: Write the failing tests for `bulkImportProducts`**

Append to `__tests__/services/product-import.test.ts`:

```ts
describe('bulkImportProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateProductCode.mockReturnValue('MEI-TEST-CODE')
  })

  it('imports a single product with a primary image and reports expanded summary fields', async () => {
    mockFrom
      .mockReturnValueOnce(createChain(NOT_FOUND)) // slug check
      .mockReturnValueOnce(createChain(NOT_FOUND)) // code check
      .mockReturnValueOnce(createChain({ data: [{ id: 'prod-1', name: 'Lehenga A' }], error: null })) // batch insert
      .mockReturnValueOnce(createChain({ data: [{ id: 'media-1' }], error: null })) // primary image (multi-row insert)

    const summary = await bulkImportProducts([makeGroup()], categories)

    expect(summary.successCount).toBe(1)
    expect(summary.failureCount).toBe(0)
    expect(summary.productsCreated).toBe(1)
    expect(summary.colorsCreated).toBe(0)
    expect(summary.mediaCreated).toBe(1)
    expect(summary.rowsProcessed).toBe(1)
    expect(summary.durationMs).toBeGreaterThanOrEqual(0)
    expect(summary.productsPerSecond).toBeGreaterThanOrEqual(0)
    expect(summary.rowsPerSecond).toBeGreaterThanOrEqual(0)
    expect(summary.averageChunkDurationMs).toBeGreaterThanOrEqual(0)
    expect(summary.results).toEqual([{ name: 'Lehenga A', success: true, productId: 'prod-1' }])
  })

  it('falls back to per-row inserts if the batch insert returns a mismatched row count (defensive stable-mapping guard)', async () => {
    // A batch insert that returns fewer/more rows than requested would break
    // positional pairing between the response and the source groups — this
    // is treated exactly like a failed batch and falls back to the per-row
    // path instead of risking a mis-paired product/group.
    mockFrom
      .mockReturnValueOnce(createChain(NOT_FOUND)) // slug
      .mockReturnValueOnce(createChain(NOT_FOUND)) // code
      .mockReturnValueOnce(createChain({ data: [], error: null })) // batch insert returns 0 rows for 1 requested
      .mockReturnValueOnce(createChain({ data: { id: 'prod-1', name: 'Lehenga A' }, error: null })) // fallback single insert succeeds
      .mockReturnValueOnce(createChain({ data: [{ id: 'media-1' }], error: null })) // media

    const summary = await bulkImportProducts([makeGroup()], categories)

    expect(summary.successCount).toBe(1)
    expect(summary.results[0].productId).toBe('prod-1')
  })

  it('batch-inserts colors and media (one call per table) and dedupes a repeated image URL', async () => {
    const group = makeGroup({
      primaryImages: [],
      colors: [{ label: 'Red', imageUrls: ['red1.jpg', 'red1.jpg', 'red2.jpg'] }],
    })

    mockFrom
      .mockReturnValueOnce(createChain(NOT_FOUND)) // slug
      .mockReturnValueOnce(createChain(NOT_FOUND)) // code
      .mockReturnValueOnce(createChain({ data: [{ id: 'prod-1', name: 'Lehenga A' }], error: null })) // batch insert
      .mockReturnValueOnce(createChain({ data: [{ id: 'color-1', label: 'Red' }], error: null })) // colors (one call)
      .mockReturnValueOnce(createChain({ data: [{ id: 'media-1' }, { id: 'media-2' }], error: null })) // media (one call, deduped to 2 rows)

    const summary = await bulkImportProducts([group], categories)

    expect(summary.successCount).toBe(1)
    expect(summary.colorsCreated).toBe(1)
    expect(summary.mediaCreated).toBe(2) // 3 URLs in the source, 1 exact duplicate deduped away
  })

  it('records a failure when the category cannot be resolved, without touching the DB', async () => {
    const group = makeGroup({ categoryName: 'Nonexistent' })
    const summary = await bulkImportProducts([group], categories)

    expect(summary.successCount).toBe(0)
    expect(summary.failureCount).toBe(1)
    expect(summary.results[0].errorCode).toBe('CATEGORY_NOT_FOUND')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('records a failure when a unique slug cannot be found after 20 attempts', async () => {
    for (let i = 0; i < 20; i++) {
      mockFrom.mockReturnValueOnce(createChain({ data: { id: `x${i}`, slug: 'taken' }, error: null }))
    }

    const summary = await bulkImportProducts([makeGroup()], categories)

    expect(summary.successCount).toBe(0)
    expect(summary.results[0].errorCode).toBe('SLUG_COLLISION')
  })

  it('falls back to per-row insert and retries with a fresh slug/code on a concurrent unique-constraint collision', async () => {
    // Simulates two admins racing for the same slug: our pre-check says
    // 'lehenga-a' is free, but by the time we insert, a concurrent import
    // has already taken it — the insert comes back as a 23505, and we must
    // re-resolve and retry rather than give up.
    mockGenerateProductCode
      .mockReturnValueOnce('MEI-TEST-CODE')   // initial resolveUniqueProductCode pre-check
      .mockReturnValueOnce('MEI-TEST-CODE-2') // retry's resolveUniqueProductCode call

    mockFrom
      .mockReturnValueOnce(createChain(NOT_FOUND)) // slug pre-check: 'lehenga-a' free
      .mockReturnValueOnce(createChain(NOT_FOUND)) // code pre-check: 'MEI-TEST-CODE' free
      .mockReturnValueOnce(createChain({ data: null, error: { message: 'batch insert failed' } })) // whole-chunk batch insert fails
      .mockReturnValueOnce(createChain({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "products_slug_unique"' } })) // fallback single insert: race lost
      .mockReturnValueOnce(createChain(NOT_FOUND)) // retry: 'lehenga-a-2' free
      .mockReturnValueOnce(createChain(NOT_FOUND)) // retry: 'MEI-TEST-CODE-2' free
      .mockReturnValueOnce(createChain({ data: { id: 'prod-1', name: 'Lehenga A' }, error: null })) // fallback single insert retried: success
      .mockReturnValueOnce(createChain({ data: [{ id: 'media-1' }], error: null })) // media

    const summary = await bulkImportProducts([makeGroup()], categories)

    expect(summary.successCount).toBe(1)
    expect(summary.results[0].productId).toBe('prod-1')
  })

  it('retries the batch insert once on a transient network error, then succeeds', async () => {
    mockFrom
      .mockReturnValueOnce(createChain(NOT_FOUND)) // slug
      .mockReturnValueOnce(createChain(NOT_FOUND)) // code
      .mockReturnValueOnce(createChain({ data: null, error: { message: 'fetch failed: network timeout' } })) // transient failure
      .mockReturnValueOnce(createChain({ data: [{ id: 'prod-1', name: 'Lehenga A' }], error: null })) // retried batch insert succeeds
      .mockReturnValueOnce(createChain({ data: [{ id: 'media-1' }], error: null })) // media

    const summary = await bulkImportProducts([makeGroup()], categories)

    expect(summary.successCount).toBe(1)
    expect(summary.results[0].productId).toBe('prod-1')
  })

  it('classifies an RLS-denied insert failure and does not retry it', async () => {
    mockFrom
      .mockReturnValueOnce(createChain(NOT_FOUND)) // slug
      .mockReturnValueOnce(createChain(NOT_FOUND)) // code
      .mockReturnValueOnce(createChain({ data: null, error: { message: 'new row violates row-level security policy' } })) // batch insert fails
      .mockReturnValueOnce(createChain({ data: null, error: { message: 'new row violates row-level security policy' } })) // fallback insert fails the same way

    const summary = await bulkImportProducts([makeGroup()], categories)

    expect(summary.successCount).toBe(0)
    expect(summary.results[0].errorCode).toBe('RLS_DENIED')
  })

  it('compensates by soft-deleting the product when color creation fails', async () => {
    const group = makeGroup({ primaryImages: [], colors: [{ label: 'Red', imageUrls: ['red1.jpg'] }] })

    mockFrom
      .mockReturnValueOnce(createChain(NOT_FOUND)) // slug
      .mockReturnValueOnce(createChain(NOT_FOUND)) // code
      .mockReturnValueOnce(createChain({ data: [{ id: 'prod-1', name: 'Lehenga A' }], error: null })) // batch insert succeeds
      .mockReturnValueOnce(createChain({ data: null, error: { message: 'insert failed' } })) // color insert fails
      .mockReturnValueOnce(createChain({ error: null })) // compensating soft-delete (deleteProduct)

    const summary = await bulkImportProducts([group], categories)

    expect(summary.successCount).toBe(0)
    expect(summary.failureCount).toBe(1)
    expect(summary.results[0]).toMatchObject({ success: false, productId: 'prod-1', errorCode: 'COLOR_INSERT_FAILED' })
  })

  it('rejects an import that exceeds the maximum products per import, without touching the DB', async () => {
    const groups = Array.from({ length: 1001 }, (_, i) => makeGroup({ name: `Product ${i}` }))
    await expect(bulkImportProducts(groups, categories)).rejects.toThrow(/1000-product limit/)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('reports progress through each stage in order', async () => {
    mockFrom
      .mockReturnValueOnce(createChain(NOT_FOUND))
      .mockReturnValueOnce(createChain(NOT_FOUND))
      .mockReturnValueOnce(createChain({ data: [{ id: 'prod-1', name: 'Lehenga A' }], error: null }))
      .mockReturnValueOnce(createChain({ data: [{ id: 'media-1' }], error: null }))

    const stages: string[] = []
    await bulkImportProducts([makeGroup()], categories, { onProgress: (stage) => stages.push(stage) })

    expect(stages).toEqual([
      'RESOLVING_CATEGORIES',
      'GENERATING_IDENTIFIERS',
      'CREATING_PRODUCTS',
      'CREATING_COLORS_AND_MEDIA',
      'LOGGING_AUDIT',
      'COMPLETED',
    ])
  })

  it('splits a large import into PRODUCT_INSERT_CHUNK_SIZE-sized batch inserts', async () => {
    const groupCount = PRODUCT_INSERT_CHUNK_SIZE + 50 // 250 with the default 200 chunk size -> 2 chunks
    const groups = Array.from({ length: groupCount }, (_, i) => makeGroup({ name: `Product ${i}` }))

    for (let i = 0; i < groupCount; i++) {
      mockFrom
        .mockReturnValueOnce(createChain(NOT_FOUND)) // slug check
        .mockReturnValueOnce(createChain(NOT_FOUND)) // code check
    }

    const chunks = [groups.slice(0, PRODUCT_INSERT_CHUNK_SIZE), groups.slice(PRODUCT_INSERT_CHUNK_SIZE)]
    for (const chunkGroups of chunks) {
      const chunkData = chunkGroups.map((g) => ({ id: `prod-${g.name}`, name: g.name }))
      mockFrom.mockReturnValueOnce(createChain({ data: chunkData, error: null }))
    }

    for (let i = 0; i < groupCount; i++) {
      mockFrom.mockReturnValueOnce(createChain({ data: [{ id: `media-${i}` }], error: null }))
    }

    const summary = await bulkImportProducts(groups, categories)

    expect(summary.productsCreated).toBe(groupCount)
    expect(summary.failureCount).toBe(0)
  }, 15000)

  it('reports multiple products independently in one summary', async () => {
    const groupA = makeGroup({ name: 'Lehenga A' })
    const groupB = makeGroup({ name: 'Lehenga B', categoryName: 'Nonexistent' })

    mockFrom
      .mockReturnValueOnce(createChain(NOT_FOUND)) // slug for A
      .mockReturnValueOnce(createChain(NOT_FOUND)) // code for A
      .mockReturnValueOnce(createChain({ data: [{ id: 'prod-1', name: 'Lehenga A' }], error: null })) // batch insert (only A)
      .mockReturnValueOnce(createChain({ data: [{ id: 'media-1' }], error: null })) // A's primary image

    const summary = await bulkImportProducts([groupA, groupB], categories)

    expect(summary.successCount).toBe(1)
    expect(summary.failureCount).toBe(1)
    expect(summary.results.find((r) => r.name === 'Lehenga B')?.errorCode).toBe('CATEGORY_NOT_FOUND')
  })
})
```

- [ ] **Step 8: Run the tests to verify they fail**

Run: `npx vitest run __tests__/services/product-import.test.ts`
Expected: FAIL — `bulkImportProducts is not a function` / `undefined`

- [ ] **Step 9: Add `bulkImportProducts` and its supporting code to `services/product-import.ts`**

Add these imports to the top of `services/product-import.ts` (alongside the ones from Step 5):

```ts
import { deleteProduct } from '@/services/products'
import { logAuditEvent } from '@/lib/audit'
import { captureError } from '@/lib/monitoring'
import { classifyError, ImportStageError, type ImportErrorCode } from '@/lib/import-errors'
import { MAX_IMPORT_PRODUCTS, PRODUCT_INSERT_CHUNK_SIZE } from '@/lib/product-import-constants'
import type { ProductGroup } from '@/lib/csv-import/types'
import type { Json } from '@/types/database'
```

(Note: Step 5 already added `import { getProductBySlug, getProductByCode } from '@/services/products'` and `import { MAX_SLUG_CODE_ATTEMPTS } from '@/lib/product-import-constants'`. Merge into those two existing lines instead of adding duplicate import statements for the same modules — the final file should have exactly one `from '@/services/products'` import (adding `deleteProduct` to it) and exactly one `from '@/lib/product-import-constants'` import (adding `MAX_IMPORT_PRODUCTS, PRODUCT_INSERT_CHUNK_SIZE` to it).)

Append the rest of the file:

```ts
export type ImportStage =
  | 'RESOLVING_CATEGORIES'
  | 'GENERATING_IDENTIFIERS'
  | 'CREATING_PRODUCTS'
  | 'CREATING_COLORS_AND_MEDIA'
  | 'LOGGING_AUDIT'
  | 'COMPLETED'

export interface BulkImportOptions {
  filename?: string
  onProgress?: (stage: ImportStage) => void
  /** Aborts outstanding product/color/media insert requests when the caller
   * cancels (e.g. ImportPageClient unmounting mid-import) — see "AbortController
   * Support" in the Production Readiness Review. Does not roll back writes
   * that already committed before the signal fired. */
  signal?: AbortSignal
}

export interface BulkImportProductResult {
  name: string
  success: boolean
  productId?: string
  error?: string
  errorCode?: ImportErrorCode
}

export interface BulkImportSummary {
  successCount: number
  failureCount: number
  productsCreated: number
  colorsCreated: number
  mediaCreated: number
  rowsProcessed: number
  durationMs: number
  /** Throughput metrics computed from wall-clock timestamps already tracked
   * during the import — no additional infrastructure. All three fall back to
   * the raw count (never NaN/Infinity) if durationMs rounds to 0. */
  productsPerSecond: number
  rowsPerSecond: number
  averageChunkDurationMs: number
  results: BulkImportProductResult[]
}

interface ResolvedProductRow {
  group: ProductGroup
  slug: string
  productCode: string
  categoryId: string
}

interface ColorAndMediaCounts {
  colorsCreated: number
  mediaCreated: number
}

/**
 * Creates product_colors and product_media rows for one product in at most
 * two round trips (one multi-row insert per table), instead of one insert
 * per color/image — the existing single-row createColor()/uploadMedia()
 * helpers stay in place for their own single-item call sites (the color
 * dialog, the media uploader) but don't support arrays, so this bulk path
 * writes its own batched inserts against the same tables. Deduplicates
 * identical image URLs within the same product/color scope, and marks
 * exactly one image per color (and one product-level primary image) as
 * is_primary — matching the partial unique indexes on product_media
 * (idx_pm_primary_product / idx_pm_primary_color).
 */
async function createColorsAndMedia(productId: string, group: ProductGroup, signal?: AbortSignal): Promise<ColorAndMediaCounts> {
  const supabase = createClient()
  const colorIdByLabel = new Map<string, string>()
  let colorsCreated = 0

  if (group.colors.length > 0) {
    const colorRows = group.colors.map((color, index) => ({
      product_id: productId,
      label: color.label,
      sort_order: index,
    }))

    const response = await withRetryableQuery(() => {
      let query = supabase.from('product_colors').insert(colorRows as never).select('id, label')
      if (signal) query = query.abortSignal(signal)
      return query
    })
    const { data, error } = response as { data: Array<{ id: string; label: string }> | null; error: { message: string } | null }
    if (error) throw new ImportStageError('COLOR_INSERT_FAILED', error.message)

    for (const created of data ?? []) colorIdByLabel.set(created.label, created.id)
    colorsCreated = data?.length ?? 0
  }

  const seenUrls = new Set<string>()
  const mediaRows: Array<{ product_id: string; color_id: string | null; url: string; is_primary: boolean; sort_order: number }> = []

  for (const color of group.colors) {
    const colorId = colorIdByLabel.get(color.label)
    if (!colorId) continue
    let index = 0
    for (const url of color.imageUrls) {
      const dedupeKey = `${colorId}:${url}`
      if (seenUrls.has(dedupeKey)) continue
      seenUrls.add(dedupeKey)
      mediaRows.push({ product_id: productId, color_id: colorId, url, is_primary: index === 0, sort_order: index })
      index++
    }
  }

  let primaryIndex = 0
  for (const image of group.primaryImages) {
    const dedupeKey = `primary:${image.url}`
    if (seenUrls.has(dedupeKey)) continue
    seenUrls.add(dedupeKey)
    mediaRows.push({ product_id: productId, color_id: null, url: image.url, is_primary: primaryIndex === 0, sort_order: primaryIndex })
    primaryIndex++
  }

  let mediaCreated = 0
  if (mediaRows.length > 0) {
    const response = await withRetryableQuery(() => {
      let query = supabase.from('product_media').insert(mediaRows as never).select('id')
      if (signal) query = query.abortSignal(signal)
      return query
    })
    const { data, error } = response as { data: Array<{ id: string }> | null; error: { message: string } | null }
    if (error) throw new ImportStageError('MEDIA_INSERT_FAILED', error.message)
    mediaCreated = data?.length ?? 0
  }

  return { colorsCreated, mediaCreated }
}

/**
 * Inserts one product row, retrying with a freshly resolved slug/product_code
 * if the insert hits a unique-constraint violation — this covers the race
 * where a concurrent import (e.g. two admins importing at once) claims the
 * same slug/code between our pre-check and this insert. Mirrors the retry
 * strategy already proven in services/products.ts's createProduct().
 */
async function insertProductRowWithRetry(
  row: Record<string, unknown> & { name: string; slug: string; product_code: string },
  reservedSlugs: Set<string>,
  reservedCodes: Set<string>,
  signal?: AbortSignal
): Promise<{ data: { id: string; name: string } | null; error: { message: string } | null }> {
  const supabase = createClient()
  let currentRow = row

  for (let attempt = 1; attempt <= MAX_SLUG_CODE_ATTEMPTS; attempt++) {
    const response = await withRetryableQuery(() => {
      let query = supabase.from('products').insert([currentRow] as never).select('id, name').single()
      if (signal) query = query.abortSignal(signal)
      return query
    })
    const { data, error } = response as { data: { id: string; name: string } | null; error: { message: string; code?: string } | null }

    if (!error) return { data, error: null }
    if (classifyError(error) !== 'UNIQUE_CONSTRAINT') return { data: null, error }

    const newSlug = await resolveUniqueSlug(currentRow.name, reservedSlugs)
    const newCode = await resolveUniqueProductCode(currentRow.name, reservedCodes)
    if (!newSlug || !newCode) return { data: null, error }
    currentRow = { ...currentRow, slug: newSlug, product_code: newCode }
  }

  return { data: null, error: { message: 'Exhausted retry attempts after repeated unique constraint violations' } }
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

/**
 * Batch-creates products, colors, and media from validated CSV import groups.
 *
 * Callers must only pass groups that have already passed `isValidFile`/
 * `validateGroupingResult` (lib/csv-import/validate.ts) — this trusts
 * group.price/group.status to be non-null and does not re-validate CSV rows.
 *
 * Products are inserted in chunks of PRODUCT_INSERT_CHUNK_SIZE via one
 * multi-row insert per chunk (falling back to per-row inserts, with
 * unique-violation retry, if a chunk's batch insert fails outright).
 *
 * There is no cross-table database transaction in this codebase (see
 * services/products.ts's createProduct, which has the same limitation) — if
 * colors/media creation fails for a product whose row already committed,
 * this function compensates by soft-deleting that product (matching
 * deleteProduct's existing soft-delete semantics) so it does not appear as
 * an incomplete "ghost" product in the admin product list, then records the
 * product as a failure.
 *
 * Inserted rows are paired back to their source ProductGroup by array
 * position (not by product name) — see "Stable Product Mapping" in the
 * Production Readiness Review. If options.signal is provided, it's threaded
 * through every insert this function issues so an aborted caller (e.g. the
 * admin navigating away mid-import) stops outstanding requests — already
 * -committed writes are not rolled back by an abort.
 */
export async function bulkImportProducts(
  groups: ProductGroup[],
  categories: Array<{ id: string; name: string }>,
  options: BulkImportOptions = {}
): Promise<BulkImportSummary> {
  const startedAt = Date.now()
  const onProgress = options.onProgress ?? (() => {})

  if (groups.length > MAX_IMPORT_PRODUCTS) {
    throw new Error(
      `This file has ${groups.length} products, which exceeds the ${MAX_IMPORT_PRODUCTS}-product limit per import. Split it into smaller files.`
    )
  }

  const results: BulkImportProductResult[] = []
  const reservedSlugs = new Set<string>()
  const reservedCodes = new Set<string>()

  onProgress('RESOLVING_CATEGORIES')

  const categoryResolved: Array<{ group: ProductGroup; categoryId: string }> = []
  for (const group of groups) {
    const categoryId = resolveCategoryId(group.categoryName ?? '', categories)
    if (!categoryId) {
      results.push({ name: group.name, success: false, error: `Category "${group.categoryName}" not found`, errorCode: 'CATEGORY_NOT_FOUND' })
      continue
    }
    categoryResolved.push({ group, categoryId })
  }

  onProgress('GENERATING_IDENTIFIERS')

  const resolved: ResolvedProductRow[] = []
  for (const { group, categoryId } of categoryResolved) {
    const slug = await resolveUniqueSlug(group.name, reservedSlugs)
    if (!slug) {
      results.push({ name: group.name, success: false, error: `Unable to generate a unique slug after ${MAX_SLUG_CODE_ATTEMPTS} attempts`, errorCode: 'SLUG_COLLISION' })
      continue
    }

    const productCode = await resolveUniqueProductCode(group.name, reservedCodes)
    if (!productCode) {
      results.push({ name: group.name, success: false, error: `Unable to generate a unique product code after ${MAX_SLUG_CODE_ATTEMPTS} attempts`, errorCode: 'PRODUCT_CODE_COLLISION' })
      continue
    }

    resolved.push({ group, slug, productCode, categoryId })
  }

  const rowsProcessed = groups.length

  if (resolved.length === 0) {
    onProgress('COMPLETED')
    return {
      successCount: 0,
      failureCount: results.length,
      productsCreated: 0,
      colorsCreated: 0,
      mediaCreated: 0,
      rowsProcessed,
      durationMs: Date.now() - startedAt,
      productsPerSecond: 0,
      rowsPerSecond: 0,
      averageChunkDurationMs: 0,
      results,
    }
  }

  onProgress('CREATING_PRODUCTS')

  const supabase = createClient()
  // Paired with its source group, not just { id, name } — see "Stable
  // Product Mapping" in the Production Readiness Review for why this
  // function never correlates an inserted row back to a group by name.
  const insertedProducts: Array<{ id: string; group: ProductGroup }> = []
  const chunkDurations: number[] = []

  for (const batch of chunk(resolved, PRODUCT_INSERT_CHUNK_SIZE)) {
    const chunkStartedAt = Date.now()
    const rowsToInsert = batch.map(({ group, slug, productCode, categoryId }) => ({
      name: group.name,
      slug,
      product_code: productCode,
      category_id: categoryId,
      price: group.price as number,
      status: group.status as 'PUBLISHED' | 'DRAFT',
      work_types: group.workTypes,
      short_description: group.shortDescription,
      description: group.description,
      image_url: group.primaryImages[0]?.url ?? group.colors[0]?.imageUrls[0] ?? null,
    }))

    const batchResponse = await withRetryableQuery(() => {
      let query = supabase.from('products').insert(rowsToInsert as never).select('id, name')
      if (options.signal) query = query.abortSignal(options.signal)
      return query
    })
    const { data: batchData, error: batchError } = batchResponse as {
      data: Array<{ id: string; name: string }> | null
      error: { message: string } | null
    }

    if (!batchError && batchData && batchData.length === batch.length) {
      // Postgres/PostgREST preserve row order for a single multi-row
      // INSERT ... RETURNING statement, so pairing the response back to
      // `batch` by array position is a stable correlation that never
      // depends on product names being unique. The length check above is
      // the defensive guard: if it ever doesn't hold, fall through to the
      // per-row path below instead of risking a mis-paired product/group.
      for (let i = 0; i < batch.length; i++) {
        insertedProducts.push({ id: batchData[i].id, group: batch[i].group })
      }
      chunkDurations.push(Date.now() - chunkStartedAt)
      continue
    }

    // The whole multi-row insert failed outright, or returned an unexpected
    // row count — fall back to per-row inserts (with unique-violation
    // retry) so one bad row doesn't sink the rest of the chunk. Each row is
    // paired with its resolved group by array position, not by name.
    for (let i = 0; i < rowsToInsert.length; i++) {
      const row = rowsToInsert[i]
      const { data, error } = await insertProductRowWithRetry(row, reservedSlugs, reservedCodes, options.signal)
      if (error || !data) {
        results.push({ name: row.name, success: false, error: error?.message ?? 'Insert failed', errorCode: classifyError(error) })
        continue
      }
      insertedProducts.push({ id: data.id, group: batch[i].group })
    }
    chunkDurations.push(Date.now() - chunkStartedAt)
  }

  onProgress('CREATING_COLORS_AND_MEDIA')

  let colorsCreated = 0
  let mediaCreated = 0

  for (const inserted of insertedProducts) {
    try {
      const counts = await createColorsAndMedia(inserted.id, inserted.group, options.signal)
      colorsCreated += counts.colorsCreated
      mediaCreated += counts.mediaCreated
      results.push({ name: inserted.group.name, success: true, productId: inserted.id })
    } catch (err) {
      const errorCode = err instanceof ImportStageError ? err.code : classifyError(err)
      const message = err instanceof Error ? err.message : String(err)

      // Compensate: this product's row already committed, but its colors/
      // media didn't — soft-delete it rather than leaving an incomplete
      // "ghost" product visible in the admin product list.
      try {
        await deleteProduct(inserted.id)
      } catch (compensationErr) {
        captureError(compensationErr, { context: 'bulk-import-compensation-failed', productId: inserted.id })
      }

      results.push({ name: inserted.group.name, success: false, productId: inserted.id, error: message, errorCode })
    }
  }

  const successCount = results.filter((r) => r.success).length
  const failureCount = results.length - successCount
  const durationMs = Date.now() - startedAt
  const durationSeconds = durationMs / 1000
  const productsPerSecond = durationSeconds > 0 ? Number((successCount / durationSeconds).toFixed(2)) : successCount
  const rowsPerSecond = durationSeconds > 0 ? Number((rowsProcessed / durationSeconds).toFixed(2)) : rowsProcessed
  const averageChunkDurationMs =
    chunkDurations.length > 0 ? Math.round(chunkDurations.reduce((a, b) => a + b, 0) / chunkDurations.length) : 0

  onProgress('LOGGING_AUDIT')

  await logAuditEvent({
    action: 'BULK_IMPORT',
    resourceType: 'product',
    newData: {
      filename: options.filename ?? null,
      rowsProcessed,
      productsCreated: successCount,
      colorsCreated,
      mediaCreated,
      failureCount,
      durationMs,
      productsPerSecond,
      rowsPerSecond,
      averageChunkDurationMs,
      productIds: insertedProducts.map((p) => p.id),
    } as Json,
  })

  onProgress('COMPLETED')

  return {
    successCount,
    failureCount,
    productsCreated: successCount,
    colorsCreated,
    mediaCreated,
    rowsProcessed,
    durationMs,
    productsPerSecond,
    rowsPerSecond,
    averageChunkDurationMs,
    results,
  }
}
```

- [ ] **Step 10: Run the tests to verify they pass**

Run: `npx vitest run __tests__/services/product-import.test.ts`
Expected: PASS (all tests: 2 `resolveCategoryId` + 4 `resolveUniqueSlug` + 3 `resolveUniqueProductCode` + 4 `findExistingProductNames` + 13 `bulkImportProducts`)

- [ ] **Step 11: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 12: Commit**

```bash
git add lib/audit.ts services/product-import.ts __tests__/services/product-import.test.ts
git commit -m "Add production-grade bulkImportProducts batch-insert service (MEI-43)"
```

---

### Task 5: Add `ImportResultSummary` component

**Files:**
- Create: `components/products/import/ImportResultSummary.tsx`

**Interfaces:**
- Consumes: `BulkImportSummary` type (Task 4, `@/services/product-import`).
- Produces: `<ImportResultSummary summary={BulkImportSummary} />` — used by Task 6 (`ImportPageClient.tsx`).

- [ ] **Step 1: Create the component**

```tsx
'use client';

import React from 'react';
import { CheckCircle2, XCircle, Download } from 'lucide-react';
import type { BulkImportSummary } from '@/services/product-import';

interface ImportResultSummaryProps {
  summary: BulkImportSummary;
}

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Browser-only download of the raw summary as a JSON report, mirroring the
 * Blob/anchor pattern already used by lib/csv-import/template.ts's
 * downloadTemplate().
 */
function downloadReport(summary: BulkImportSummary): void {
  const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `bulk-import-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Renders the outcome of a completed bulk import: aggregate counts, timing,
 * and per-product failure reasons (with structured error codes) for
 * anything that didn't succeed.
 */
export default function ImportResultSummary({ summary }: ImportResultSummaryProps) {
  const { successCount, failureCount, productsCreated, colorsCreated, mediaCreated, rowsProcessed, durationMs, productsPerSecond, results } = summary;
  const failures = results.filter((r) => !r.success);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[13px] font-medium text-zinc-800">
        <CheckCircle2 className="w-4 h-4 text-[#8BC98F]" aria-hidden="true" />
        {successCount} of {rowsProcessed} product{rowsProcessed === 1 ? '' : 's'} imported successfully
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="text-[10px] font-medium tracking-wide text-zinc-500 bg-[#FAF8F5] border border-[#E8E0D5] rounded px-2 py-0.5">
          {productsCreated} product{productsCreated === 1 ? '' : 's'} created
        </span>
        <span className="text-[10px] font-medium tracking-wide text-zinc-500 bg-[#FAF8F5] border border-[#E8E0D5] rounded px-2 py-0.5">
          {colorsCreated} color{colorsCreated === 1 ? '' : 's'} created
        </span>
        <span className="text-[10px] font-medium tracking-wide text-zinc-500 bg-[#FAF8F5] border border-[#E8E0D5] rounded px-2 py-0.5">
          {mediaCreated} media row{mediaCreated === 1 ? '' : 's'} created
        </span>
        <span className="text-[10px] font-medium tracking-wide text-zinc-500 bg-[#FAF8F5] border border-[#E8E0D5] rounded px-2 py-0.5">
          Took {formatDuration(durationMs)}
        </span>
        <span className="text-[10px] font-medium tracking-wide text-zinc-500 bg-[#FAF8F5] border border-[#E8E0D5] rounded px-2 py-0.5">
          {productsPerSecond} products/sec
        </span>
      </div>

      {failureCount > 0 && (
        <div className="border border-red-200 rounded bg-red-50/40 p-4 space-y-2">
          <h4 className="text-[9px] font-bold tracking-widest text-red-600 uppercase">
            Failed ({failureCount})
          </h4>
          <ul className="space-y-1.5">
            {failures.map((failure, idx) => (
              <li key={idx} className="flex items-start gap-1.5 text-[12px] text-red-700">
                <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  <span className="font-medium">{failure.name}</span>
                  {failure.errorCode && <code className="mx-1 text-[10px] text-red-500">[{failure.errorCode}]</code>}
                  {failure.error}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={() => downloadReport(summary)}
        className="text-[10px] font-bold tracking-widest text-zinc-500 hover:text-zinc-800 transition-colors uppercase flex items-center gap-1.5 cursor-pointer"
      >
        <Download className="w-3.5 h-3.5" aria-hidden="true" />
        Download Report
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no errors

Run: `npx eslint components/products/import/ImportResultSummary.tsx`
Expected: clean

- [ ] **Step 3: Commit**

```bash
git add components/products/import/ImportResultSummary.tsx
git commit -m "Add ImportResultSummary component with error codes and downloadable report (MEI-43)"
```

---

### Task 6: Wire `ImportPageClient.tsx` to the real bulk import flow

**Files:**
- Modify: `components/products/import/ImportPageClient.tsx` (full rewrite of state/handler/JSX described below)

**Interfaces:**
- Consumes: `bulkImportProducts`, `findExistingProductNames`, `BulkImportSummary`, `ImportStage` (Task 4), `ImportResultSummary` (Task 5), `useQueryClient` from `@tanstack/react-query` (already used by `hooks/use-products.ts`'s `useCreateProduct`/etc., so the app is already wrapped in a `QueryClientProvider` — see `providers/query-provider.tsx`).

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `components/products/import/ImportPageClient.tsx` with:

```tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Download, X } from 'lucide-react';
import { parseAndValidateFile } from '@/lib/csv-import/parse';
import { groupRowsByProduct } from '@/lib/csv-import/group';
import { validateGroupingResult, isValidFile } from '@/lib/csv-import/validate';
import { downloadTemplate } from '@/lib/csv-import/template';
import { WORK_TYPES, PRODUCT_STATUSES } from '@/lib/csv-import/constants';
import {
  bulkImportProducts,
  findExistingProductNames,
  type BulkImportSummary,
  type ImportStage,
} from '@/services/product-import';
import type { GroupingResult, ValidationContext } from '@/lib/csv-import/types';
// ssr: false prevents the hydration mismatch caused by React's SSR whitespace
// normalisation around inline <code> elements differing from client rendering.
const FormatGuide = dynamic(() => import('./FormatGuide'), { ssr: false });
import ImportDropzone from './ImportDropzone';
import PreviewTree from './PreviewTree';
import ImportResultSummary from './ImportResultSummary';

interface ImportPageClientProps {
  categories: Array<{ id: string; name: string }>;
}

type ParseStatus = 'idle' | 'loading' | 'success' | 'error';
type ImportStatus = 'idle' | 'importing' | 'done';

const TOAST_AUTO_DISMISS_MS = 6000;

const STAGE_LABELS: Record<ImportStage, string> = {
  RESOLVING_CATEGORIES: 'Resolving categories…',
  GENERATING_IDENTIFIERS: 'Generating slugs and product codes…',
  CREATING_PRODUCTS: 'Creating products…',
  CREATING_COLORS_AND_MEDIA: 'Creating colors and media…',
  LOGGING_AUDIT: 'Recording audit log…',
  COMPLETED: 'Finishing up…',
};

/**
 * Orchestrates the bulk product CSV import flow: file upload, client-side
 * parse/group/validate pipeline, grouped preview tree, and the database
 * batch-import step (products, colors, media, audit log).
 */
export default function ImportPageClient({ categories }: ImportPageClientProps) {
  const queryClient = useQueryClient();
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<ParseStatus>('idle');
  const [fileError, setFileError] = useState<string | undefined>(undefined);
  const [groupingResult, setGroupingResult] = useState<GroupingResult | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  const [importStage, setImportStage] = useState<ImportStage | null>(null);
  const [importSummary, setImportSummary] = useState<BulkImportSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Abort any in-flight import if this page unmounts (e.g. the admin
  // navigates away via client-side routing while an import is running) —
  // see "AbortController Support" in the Production Readiness Review.
  // Already-committed writes are not rolled back by this; it only stops
  // outstanding requests and prevents a setState call after unmount.
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const validationContext: ValidationContext = useMemo(
    () => ({
      categories,
      allowedWorkTypes: [...WORK_TYPES],
      allowedStatuses: [...PRODUCT_STATUSES],
    }),
    [categories]
  );

  // Auto-dismiss the import-error toast.
  useEffect(() => {
    if (!importError) return;
    const timer = setTimeout(() => setImportError(null), TOAST_AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [importError]);

  const handleFileSelected = (file: File) => {
    setFileName(file.name);
    setStatus('loading');
    setFileError(undefined);
    setGroupingResult(null);
    setImportStatus('idle');
    setImportSummary(null);

    const reader = new FileReader();

    reader.onload = () => {
      const csvText = typeof reader.result === 'string' ? reader.result : '';

      try {
        const { fileError: parseFileError, rows } = parseAndValidateFile(csvText);

        if (parseFileError || !rows) {
          setFileError(parseFileError?.message ?? 'An error occurred while reading this file.');
          setStatus('error');
          return;
        }

        const grouped = groupRowsByProduct(rows);
        const validated = validateGroupingResult(grouped, validationContext);
        setGroupingResult(validated);
        setStatus('success');
      } catch {
        setFileError('An error occurred while parsing this file. Please check the format and try again.');
        setStatus('error');
      }
    };

    reader.onerror = () => {
      setFileError('Failed to read the selected file. Please try again.');
      setStatus('error');
    };

    reader.readAsText(file);
  };

  const isImportEnabled =
    status === 'success' && groupingResult !== null && isValidFile(groupingResult) && importStatus === 'idle';

  const handleImportClick = async () => {
    if (!isImportEnabled || !groupingResult) return;

    // Idempotency safeguard: warn (rather than silently re-create) if any of
    // these product names already exist — the most common accidental-repeat
    // scenario is re-uploading the same file twice. This is a name-based
    // check rather than a CSV checksum/import-session table, since no
    // import-history schema exists and adding one is out of scope here.
    const names = groupingResult.groups.map((g) => g.name);
    const existingNames = await findExistingProductNames(names);
    if (existingNames.length > 0) {
      const proceed = window.confirm(
        `${existingNames.length} product name(s) already exist in your catalog:\n${existingNames.join(', ')}\n\nContinue importing anyway?`
      );
      if (!proceed) return;
    }

    setImportStatus('importing');
    setImportStage(null);
    setImportError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const summary = await bulkImportProducts(groupingResult.groups, categories, {
        filename: fileName ?? undefined,
        onProgress: setImportStage,
        signal: controller.signal,
      });
      // The component may have unmounted (or a new import may have started)
      // while this awaited — skip state updates on an aborted/stale attempt.
      if (controller.signal.aborted) return;
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setImportSummary(summary);
      setImportStatus('done');
    } catch (err) {
      if (controller.signal.aborted) return;
      setImportError(err instanceof Error ? err.message : 'Bulk import failed. Please try again.');
      setImportStatus('idle');
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-6 pb-28 font-inter animate-fade-in px-4">
      {/* Breadcrumb */}
      <div className="flex items-center text-[10px] tracking-widest uppercase text-zinc-400 font-bold select-none">
        <Link href="/products" className="hover:text-zinc-600 transition-colors">
          Products
        </Link>
        <span className="mx-2 text-[#B38B5D] font-bold">/</span>
        <span className="text-zinc-800">Bulk Import</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <h1 className="font-serif text-[24px] text-zinc-950 font-normal tracking-wide">
          Bulk Product Import
        </h1>

        <button
          type="button"
          onClick={() => downloadTemplate()}
          className="bg-[#1A1A1A] hover:bg-black text-[#FAF8F5] text-[10px] font-bold tracking-widest px-6 py-3.5 transition-colors duration-200 rounded-none uppercase cursor-pointer flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5 stroke-[2]" aria-hidden="true" />
          Download CSV Template
        </button>
      </div>

      {/* Format Guide */}
      <FormatGuide />

      {/* Upload card */}
      <div className="bg-white border border-[#E8E0D5] p-8 space-y-4">
        <h3 className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
          Upload CSV File
        </h3>
        <ImportDropzone
          onFileSelected={handleFileSelected}
          isLoading={status === 'loading'}
          error={fileError}
        />
        {fileName && status !== 'error' && (
          <p className="text-[11px] text-zinc-500">
            Selected file: <span className="font-medium text-zinc-700">{fileName}</span>
          </p>
        )}
      </div>

      {/* Preview section */}
      {status === 'success' && groupingResult && importStatus !== 'done' && (
        <div className="bg-white border border-[#E8E0D5] p-8 space-y-4">
          <h3 className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
            Preview
          </h3>
          <PreviewTree groups={groupingResult.groups} unassignedRows={groupingResult.unassignedRows} />
        </div>
      )}

      {/* Import results */}
      {importStatus === 'done' && importSummary && (
        <div className="bg-white border border-[#E8E0D5] p-8 space-y-4">
          <h3 className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
            Import Results
          </h3>
          <ImportResultSummary summary={importSummary} />
        </div>
      )}

      {/* Footer bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-[#E8E0D5] px-8 py-4 flex items-center justify-between z-40">
        <div className="max-w-[1200px] mx-auto w-full flex items-center justify-between">
          {importStatus === 'done' ? (
            <>
              <span />
              <Link
                href="/products"
                aria-label="Return to the products list"
                className="bg-[#1A1A1A] hover:bg-black text-[#FAF8F5] text-[11px] font-bold tracking-widest px-8 py-3.5 transition-colors duration-200 rounded-none uppercase cursor-pointer"
              >
                Back to Products
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/products"
                aria-label="Cancel bulk import and return to products list"
                className="text-[11px] font-bold tracking-widest text-zinc-500 hover:text-zinc-800 transition-colors uppercase py-2 cursor-pointer select-none"
              >
                Cancel
              </Link>

              <button
                type="button"
                onClick={handleImportClick}
                disabled={!isImportEnabled}
                aria-disabled={!isImportEnabled}
                aria-label="Import products from the previewed CSV file"
                className={`text-[11px] font-bold tracking-widest px-8 py-3.5 transition-colors duration-200 rounded-none uppercase flex items-center gap-2 ${
                  isImportEnabled
                    ? 'bg-[#1A1A1A] hover:bg-black text-[#FAF8F5] cursor-pointer'
                    : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                }`}
              >
                {importStatus === 'importing' ? 'Importing…' : 'Import'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Importing overlay */}
      {importStatus === 'importing' && (
        <div className="fixed inset-0 bg-white/50 z-50 flex items-center justify-center">
          <div className="text-zinc-500 font-medium text-xs">
            {importStage ? STAGE_LABELS[importStage] : 'Importing products…'}
          </div>
        </div>
      )}

      {/* Error toast */}
      {importError && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-24 right-6 z-50 flex items-start gap-3 bg-red-600 text-white text-[12px] leading-relaxed px-5 py-4 max-w-sm shadow-lg animate-fade-in"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="grow">{importError}</p>
          <button
            type="button"
            onClick={() => setImportError(null)}
            aria-label="Dismiss notification"
            className="shrink-0 text-white/70 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
```

This removes the old preview-only `TOAST_MESSAGE` stub entirely and replaces it with: a pre-import duplicate-name confirmation (`findExistingProductNames` + `window.confirm`), the real `bulkImportProducts` call with per-stage progress reporting and an `AbortController` wired through `options.signal` (aborted on unmount, with both the success and error branches checking `controller.signal.aborted` before touching state), an "Importing… (stage label)" overlay, a results card (`ImportResultSummary`), cache invalidation via `queryClient.invalidateQueries({ queryKey: ['products'] })` so `/products` shows the new rows immediately, and a "Back to Products" exit once done.

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no errors

Run: `npx eslint components/products/import/ImportPageClient.tsx`
Expected: clean

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds; `/products/import` still appears in the route table

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`, then in a browser (logged in as an admin):
1. Go to `/products`, click **BULK IMPORT**.
2. Click **Download CSV Template**, then re-upload the downloaded file unmodified.
3. Confirm the preview tree renders both example products with no errors, and **Import** is enabled.
4. Click **Import** — confirm the "Importing…" overlay cycles through stage labels ("Resolving categories…", "Generating slugs and product codes…", "Creating products…", "Creating colors and media…", "Recording audit log…"), then an **Import Results** card shows "2 of 2 products imported successfully" plus the products/colors/media/duration chips.
5. Click **Download Report** — confirm a `bulk-import-report-*.json` file downloads with the full summary.
6. Click **Back to Products** — confirm both newly imported products (the single-image and multi-color examples from the template) appear in the products table without a manual page refresh.
7. Re-download the template and re-upload it a second time — confirm a confirmation dialog appears listing the 2 product names as already existing, and that clicking Cancel aborts without creating duplicates.
8. Open Supabase Studio (or run a quick `select` in the SQL editor) and confirm: two new `products` rows, `product_colors` rows for the multi-color example's colors, `product_media` rows for every image with exactly one `is_primary = true` per product/color, and one new `audit_logs` row with `action = 'BULK_IMPORT'`, `resource_type = 'product'`, and a `new_data` payload containing `filename`, `rowsProcessed`, `productsCreated`, `colorsCreated`, `mediaCreated`, `durationMs`, `productsPerSecond`, `rowsPerSecond`, `averageChunkDurationMs`.
9. Upload the template again, click **Import**, and — while the "Importing…" overlay is visible — click the **Products** breadcrumb link to navigate away mid-import. Confirm the browser console shows no "Can't perform a React state update on an unmounted component" warning (the `AbortController` cleanup should have prevented it).

- [ ] **Step 5: Commit**

```bash
git add components/products/import/ImportPageClient.tsx
git commit -m "Wire bulk import page to bulkImportProducts with progress stages and duplicate-name confirmation (MEI-43)"
```

---

### Task 7: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass, including every test added in Tasks 1-4 (in particular the concurrency-retry, transient-network-retry, RLS-denial, compensation/rollback, max-row-ceiling, progress-stage-order, and 250-product chunking tests from Task 4) and every pre-existing test (no regressions in `lib/csv-import/*.test.ts`, `__tests__/services/products.test.ts`, `__tests__/services/product-colors.test.ts`, etc.)

- [ ] **Step 2: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Lint the whole project**

Run: `npm run lint`
Expected: no errors

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: succeeds

- [ ] **Step 5: Final commit (only if any of the above steps required fixes)**

```bash
git add -A
git commit -m "Fix verification findings for bulk import batch insert (MEI-43)"
```

---

## Design notes / known trade-offs (for reviewers)

See the **Production Readiness Review** section above for the full point-by-point rationale (atomicity/compensation, concurrency/retry, idempotency, performance/chunking, error classification, observability, security). The two highest-level trade-offs, restated briefly:

- **Non-transactional writes, compensated rather than prevented.** Like every other multi-step write in this codebase (e.g. `ProductForm.tsx`'s create-then-upload-image flow), there is no cross-table transaction. If colors/media creation fails partway through a product, this plan compensates by soft-deleting the already-created product row (reusing the existing `deleteProduct`) rather than leaving an inconsistent "ghost" product visible, and reports that product as a failure with its `productId` still attached for traceability.
- **Batch insert is the common path, not the only path.** The ticket asks for "a single Supabase multi-insert." This plan does exactly that for the happy path — one chunked `insert().select()` call per `PRODUCT_INSERT_CHUNK_SIZE` (200) products — but falls back to per-row inserts (with unique-violation-aware retry) if a chunk's batch insert fails outright, so one bad or racing row can't sink an otherwise-valid chunk.

---

## Architecture Decision Record: why this stays 100% client-side

**Decision:** `bulkImportProducts` is a plain client-side `services/*.ts` function called directly from a `'use client'` component — no server action, no API route, no Edge Function, no queue, no background worker.

**Why:**
1. **It follows the existing project architecture, without exception.** Every mutation in this codebase (`createProduct`, `updateProduct`, `deleteProduct`, categories, colors, media) already goes through a client-side service using the browser Supabase client and Postgres RLS for authorization — there are zero server actions and zero DB-writing route handlers anywhere in this repository today (confirmed by grep before writing this plan). Introducing the first one specifically for this ticket would mean this feature follows a fundamentally different pattern than every other admin mutation, which is a much larger and riskier change than the ticket itself calls for.
2. **Server-side orchestration is out of this ticket's scope.** MEI-43 asks for confirm-and-batch-insert on top of the already-shipped, already-client-side MEI-42 preview pipeline. Moving the write step to a server action or Edge Function would also mean re-architecting where the parsed `GroupingResult` lives (today it's entirely in browser memory, per MEI-42's design) and would need a new mechanism (job id + polling, or a queue) to report progress back to the UI — a materially bigger project than "wire up the Import button."
3. **The current design is appropriate for the expected catalog size.** This is a boutique bridal-couture admin catalog, not a high-volume marketplace — realistic CSV imports are tens to a few hundred products, comfortably inside the `MAX_IMPORT_PRODUCTS = 1000` ceiling and the `PRODUCT_INSERT_CHUNK_SIZE = 200` chunking this plan already implements. At that scale, a synchronous, client-driven import with a visible progress UI is simpler to build, simpler to reason about, and simpler to debug than a job-queue system — and it reuses infrastructure (RLS, `logAuditEvent`, React Query cache invalidation) that already exists and is already trusted.
4. **If this ever needs to change:** the natural next step, if catalog sizes or import frequency ever outgrow this design, is a Supabase Edge Function (this codebase already has one bulk-style precedent to model it on, `supabase/functions/bulk-create-variants/index.ts`) so retries/chunking move server-side and the browser only uploads the file and polls a job id. That is a deliberate, documented non-goal of this plan, not an oversight — see point 19 in the Production Readiness Review.

---

## Final Production Readiness Checklist

Run through this after Task 7's verification pass, before considering MEI-43 done. Every item should be checkable against something concrete in this plan (a test, a manual step, or a section above) — none of these are aspirational.

- [ ] **Acceptance criteria satisfied** — every bullet in the ticket (category resolution, one-product-per-name dedup, single multi-insert with slug/code collision handling, per-color/per-image rows with `is_primary`, single `BULK_IMPORT` audit event, per-product result summary, immediate product-list refresh) is implemented by a specific task above; cross-check against the ticket text directly.
- [ ] **Chunking verified** — Task 4's "splits a large import into PRODUCT_INSERT_CHUNK_SIZE-sized batch inserts" test (250 products, 2 chunks) passes.
- [ ] **Retry logic verified** — Task 3's `withRetry`/`withRetryableQuery` tests and Task 4's "retries the batch insert once on a transient network error" test pass.
- [ ] **Concurrency handled** — Task 4's "falls back to per-row insert and retries with a fresh slug/code on a concurrent unique-constraint collision" test passes.
- [ ] **Duplicate handling verified** — Task 4's `findExistingProductNames` tests pass, and manual smoke-test step 7 (Task 6) confirms the re-upload confirmation dialog appears.
- [ ] **Stable product mapping verified** — Task 4's "falls back to per-row inserts if the batch insert returns a mismatched row count" defensive-guard test passes.
- [ ] **Cache invalidation verified** — manual smoke-test step 6 (Task 6) confirms newly imported products appear on `/products` without a manual refresh.
- [ ] **Audit logging verified** — manual smoke-test step 8 (Task 6) confirms one `audit_logs` row with `action = 'BULK_IMPORT'` and the full metadata payload (including throughput fields).
- [ ] **Progress reporting verified** — Task 4's "reports progress through each stage in order" test passes, and manual smoke-test step 4 (Task 6) confirms the stage labels appear in the UI.
- [ ] **AbortController / unmount safety verified** — manual smoke-test step 9 (Task 6) confirms no "state update on an unmounted component" warning when navigating away mid-import.
- [ ] **Error classification verified** — Task 4's RLS-denied, category-not-found, slug-collision, and color/media-insert-failure tests each assert the expected `errorCode`.
- [ ] **Manual QA completed** — all 9 steps of Task 6's manual smoke test performed against a real dev server and a real (or local) Supabase project.
- [ ] **Build passes** — `npm run build` (Task 7, Step 4).
- [ ] **Tests pass** — `npx vitest run` (Task 7, Step 1), full suite, no regressions.
- [ ] **TypeScript clean** — `npx tsc --noEmit` (Task 7, Step 2).
- [ ] **Lint clean** — `npm run lint` (Task 7, Step 3).
- [ ] **Production build successful** — same as "Build passes" above; listed separately here because it's the last gate before calling this done.
