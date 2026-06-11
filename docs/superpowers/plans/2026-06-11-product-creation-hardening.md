# Product Creation Production Hardening Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify, apply, and confirm the production-ready state of the Product Creation fix so that products persist to Supabase, the banners schema error is resolved, TypeScript and lint and build all pass cleanly, and the full feature is manually verified before the client call.

**Architecture:** `ProductForm.tsx` has been surgically rewired from `lib/mockDb.ts` (localStorage) to `services/products.ts` + `services/storage.ts` + `services/categories.ts` (Supabase). A migration file adds the missing `banners.deleted_at` column that `services/banners.ts` already references. This plan verifies the state, applies the migration, runs all validators, and collects E2E evidence.

**Tech Stack:** Next.js 16 App Router, Supabase (supabase-js v2 via `@supabase/ssr`), TanStack Query v5, TypeScript strict, Vitest, `npx supabase` CLI

---

## Non-Negotiable Rules (Rules 1–34)

These rules apply to every step in this plan. Any violation is a stop condition.

**Service Reuse (rules 1–8)**
1. `createProduct`, `updateProduct`, `deleteProduct`, `getProducts` already exist in `services/products.ts` — do not recreate them.
2. `getProductById` was added to `services/products.ts` — reuse it; do not create an alternative.
3. `uploadProductImage` exists in `services/storage.ts` — reuse it; do not create another upload helper.
4. `getCategories` exists in `services/categories.ts` — ProductForm must use this import; it must NOT query Supabase directly for categories inside the component.
5. Do not duplicate business logic anywhere.
6. Do not create parallel service implementations.
7. Do not hardcode category IDs or category name→UUID mappings — use `getCategories()` to resolve at runtime.
8. No mock data, no seed inserts, no hardcoded test records.

**Forbidden File Changes (rules 9–19)**
9. Do NOT modify JSX markup.
10. Do NOT modify Tailwind CSS classes.
11. Do NOT modify page layout or component structure.
12. Do NOT modify routes or navigation links.
13. Do NOT modify `hooks/use-products.ts` or any other hook.
14. Do NOT modify `app/(app)/products/page.tsx`.
15. Do NOT modify `services/categories.ts`, `services/storage.ts`, or `services/banners.ts`.
16. Do NOT modify any UI for categories, orders, enquiries, banners, or settings.
17. Do NOT modify `lib/mockDb.ts` (other pages still depend on it).
18. Do NOT touch existing TypeScript types beyond what is required for the banners `deleted_at` field.
19. Do NOT alter existing React Query query keys or mutation behaviour.

**Quality Gates (rules 20–25)**
20. `npx tsc --noEmit` must return 0 errors before any manual testing.
21. `npm run lint` must return 0 errors before any manual testing.
22. Migration 010 must be verified applied before E2E testing.
23. No temporary workarounds or TODO comments in production code.
24. Every create/edit operation must be verified in the Supabase Dashboard — UI success is not sufficient evidence.
25. Do not mark the plan complete until every checkbox in the Success Criteria is ticked.

**Production Hardening Add-On (rules 26–34)**
26. Reuse only the following existing services: `createProduct()`, `updateProduct()`, `deleteProduct()`, `getProducts()`, `getProductById()`, `uploadProductImage()`, `getCategories()`.
27. `ProductForm` must NEVER directly query categories using `createClient().from('categories')`. Always use `await getCategories()` from `@/services/categories`.
28. No duplicate service logic anywhere in the codebase.
29. No hardcoded category UUIDs.
30. No hardcoded test records.
31. No mock data in product flow.
32. No direct Supabase calls from `ProductForm` except through the existing service layer.
33. No UI, JSX, styling, routing, navigation, React Query key, or form structure modifications.
34. No TODOs, temporary fixes, debug code, console logs, or commented code in final implementation.

---

## Pre-execution: Current Codebase State

The following changes are **already committed to the working tree** from this session. Each task confirms then proceeds:

| File | Change | State |
|---|---|---|
| `components/products/ProductForm.tsx` | Replaced `from '@/lib/mockDb'` with service imports; rewired `handleSubmit` and `loadProduct` | Done — unverified by lint/E2E |
| `services/products.ts` | Added `getProductById(id)` | Done — TypeScript clean |
| `supabase/migrations/010_banners_deleted_at.sql` | `ALTER TABLE banners ADD COLUMN deleted_at TIMESTAMPTZ` | Done — NOT applied to Supabase yet |
| `types/database.ts` | Added `deleted_at` to banners `Row` and `Update` types | Done — TypeScript clean |

---

## File Map

**Modified:**
- `components/products/ProductForm.tsx` — persistence layer only (no JSX, no styling)
- `services/products.ts` — one new export (`getProductById`)
- `types/database.ts` — banners type extended

**Created:**
- `supabase/migrations/010_banners_deleted_at.sql` — schema patch

**Unchanged (confirm not touched):**
- `app/(app)/products/page.tsx`
- `app/(app)/products/add/page.tsx`
- `app/(app)/products/edit/[id]/page.tsx`
- `hooks/use-products.ts`
- `services/banners.ts`
- `services/categories.ts`
- `services/storage.ts`
- All category, order, enquiry, banner, settings pages

---

## Recommended Execution Order

Run tasks in this sequence. Each stage gates the next — do not skip ahead.

| Stage | Task | Purpose | Gate |
|---|---|---|---|
| 1 | **Task 1** — Discovery | Verify all code assumptions | Stop if any grep returns unexpected result |
| 2 | **Task 2** — Env & Infrastructure | `.env.local`, storage bucket, RLS | Stop if URL is localhost or bucket is missing |
| 3 | **Task 3** — Migration | Apply `010_banners_deleted_at`, verify schema & seed | Stop if any column or category row is missing |
| 4 | **Task 4** — Validation | `tsc`, `lint`, `build` | Stop if any of the three fail |
| 5 | **Task 5** — E2E | Create / upload / edit / delete / refresh | Stop if any Supabase SQL verification fails |
| 6 | **Task 6** — Regression | All six pages load clean | Stop if banners page still shows `deleted_at` error |
| 7 | **Task 8** — Storage Policies | RLS on `storage.objects` | Stop if INSERT policy is missing |
| 8 | **Task 9** — Env Consistency | URL is not localhost | Stop immediately if localhost is detected |
| 9 | **Task 10** — Production Smoke | `npm run start`, verify pages | Stop if hydration errors or runtime crash |
| 10 | **Task 7** — Final Commit | One clean commit after everything passes | Last step — do not run earlier |

**The first command to run:**
```bash
grep -n "mockDb\|addProduct\|fetchProducts" components/products/ProductForm.tsx
```
Expected: no output. If clean, proceed through the checklist in order.

---

## Task 1: Discovery — Confirm Root Cause & Verify Service Inventory

**Purpose:** Establish ground truth from the actual files before proceeding. If any grep returns unexpected results, stop and investigate before continuing.

- [ ] **Step 1: Confirm ProductForm no longer imports mockDb**

  ```bash
  grep -n "mockDb\|addProduct\|fetchProducts" components/products/ProductForm.tsx
  ```

  **Expected:** No output (zero matches). If matches are found, the fix was not applied — stop immediately.

- [ ] **Step 2: Confirm ProductForm imports from services**

  ```bash
  grep -n "from '@/services/" components/products/ProductForm.tsx
  ```

  **Expected:**
  ```
  5:import { createProduct, updateProduct, getProductById } from '@/services/products';
  6:import { uploadProductImage } from '@/services/storage';
  7:import { getCategories } from '@/services/categories';
  ```

- [ ] **Step 3: Confirm service exports exist (no duplicates)**

  ```bash
  grep -n "^export async function" services/products.ts
  ```

  **Expected (exactly these 5, no duplicates):**
  ```
  15:export async function getProducts(
  41:export async function createProduct(
  63:export async function updateProduct(
  86:export async function getProductById(
  102:export async function deleteProduct(
  ```

- [ ] **Step 4: Confirm uploadProductImage exists and is NOT duplicated**

  ```bash
  grep -n "^export async function uploadProductImage" services/storage.ts
  ```

  **Expected:** Exactly one match at line 7.

- [ ] **Step 5: Confirm products list page is on Supabase (not mockDb)**

  ```bash
  grep -n "mockDb\|localStorage" "app/(app)/products/page.tsx"
  ```

  **Expected:** No output.

- [ ] **Step 6: Confirm getCategories exists in services (single implementation)**

  ```bash
  grep -R "export async function getCategories" services/
  ```

  **Expected:** Exactly one match in `services/categories.ts`. If zero matches → the service doesn't exist (stop, investigate). If more than one → duplication (stop, investigate).

- [ ] **Step 7: Confirm ProductForm uses getCategories from service (not direct Supabase query)**

  ```bash
  grep -n "getCategories\|from('categories')\|\.from(\"categories\")" components/products/ProductForm.tsx
  ```

  **Expected:**
  ```
  7:import { getCategories } from '@/services/categories';
  ```
  and two more lines referencing `getCategories()` calls — no raw `.from('categories')` calls inside the component.

- [ ] **Step 8: Confirm uploadProductImage has exactly one implementation**

  ```bash
  grep -rn "^export.*uploadProductImage\|export.*function uploadProductImage" services/
  ```

  **Expected:** Exactly one match at `services/storage.ts:7`. If more than one → duplication violation, stop.

- [ ] **Step 9: Confirm migration file exists and content is correct**

  ```bash
  cat supabase/migrations/010_banners_deleted_at.sql
  ```

  **Expected:**
  ```sql
  -- Add soft-delete column to banners (services/banners.ts already references it)
  ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
  ```

- [ ] **Step 10: Confirm no remaining mockDb or localStorage in product components**

  ```bash
  grep -R "mockDb" components/products services/products.ts "app/(app)/products"
  ```

  **Expected:** No output.

  ```bash
  grep -R "localStorage" components/products services/products.ts "app/(app)/products"
  ```

  **Expected:** No output.

- [ ] **Step 11: All checks passed — proceed**

  If all steps above produced expected output, proceed to Task 2. If any step returned unexpected results, **stop and report before continuing**. Do not skip or assume.

---

## Task 2: Environment & Infrastructure Pre-Flight

**Purpose:** Confirm environment variables, storage bucket, RLS policies, and database schema are in place before applying migrations or running the app.

- [ ] **Step 1: Verify environment configuration**

  ```bash
  cat .env.local
  ```

  **Expected:** File contains both of these non-empty variables:
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
  ```

  If either is missing or the file does not exist, stop — the app cannot reach Supabase.

- [ ] **Step 2: Verify storage bucket exists**

  Run in Supabase Dashboard → SQL Editor:
  ```sql
  SELECT id, name
  FROM storage.buckets
  WHERE id = 'product-images';
  ```

  **Expected:** One row — `product-images | product-images`.

  If no row returned, create the bucket:
  1. Go to Supabase Dashboard → Storage → New Bucket
  2. Name: `product-images`, Public: true (or match existing policy)
  3. Re-run the query to confirm.

  Stop and resolve before continuing if the bucket is absent.

- [ ] **Step 3: Verify RLS policies on products and categories tables**

  Run in Supabase Dashboard → SQL Editor:
  ```sql
  SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
  FROM pg_policies
  WHERE tablename IN ('products', 'categories')
  ORDER BY tablename, cmd;
  ```

  **Expected:** At least one policy per table that permits `SELECT` and `INSERT`/`UPDATE` for the roles used by the app (typically `anon` or `authenticated`).

  If no policies exist and operations fail later, check RLS before modifying code. If tables have RLS enabled with no policies, all requests will be denied.

---

## Task 3: Apply Supabase Migration 010

**Purpose:** Push the `banners.deleted_at` migration to the live Supabase project so that `services/banners.ts` stops throwing `column banners.deleted_at does not exist` at runtime.

- [ ] **Step 1: Check migration status before applying**

  Run in Supabase SQL Editor:
  ```sql
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'banners'
  ORDER BY ordinal_position;
  ```

  **Expected:** Columns `id`, `title`, `image_url`, `link_url`, `is_active`, `sort_order`, `created_at`, `updated_at` — NO `deleted_at` yet.

  If `deleted_at` already exists → migration is already applied, skip Step 2.

- [ ] **Step 2a: Check migration list before pushing**

  ```bash
  npx supabase migration list
  ```

  **Expected output:** Shows all migrations. Verify `010_banners_deleted_at.sql` is listed and its status. If status is `applied`, skip Step 2b.

- [ ] **Step 2b: Apply migration via Supabase CLI**

  ```bash
  npx supabase db push
  ```

  **Expected output:**
  ```
  Applying migration 010_banners_deleted_at.sql...
  Done.
  ```

  If CLI is not available or fails, run the SQL directly in Supabase Dashboard SQL Editor:
  ```sql
  ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
  ```

- [ ] **Step 3: Confirm banners.deleted_at column was added**

  Run in Supabase SQL Editor:
  ```sql
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'banners'
    AND column_name = 'deleted_at';
  ```

  **Expected:** One row: `deleted_at | timestamp with time zone | YES`

- [ ] **Step 4: Confirm products schema matches expectations**

  Run in Supabase SQL Editor:
  ```sql
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'products'
  ORDER BY ordinal_position;
  ```

  **Expected columns (in order):**
  ```
  id
  name
  category_id
  price
  work_types
  status
  description
  image_url
  created_at
  updated_at
  deleted_at
  ```

  If any column is missing, **STOP** — schema drift exists that requires investigation.

- [ ] **Step 5: Confirm categories are seeded**

  Run in Supabase SQL Editor:
  ```sql
  SELECT id, name
  FROM public.categories
  WHERE deleted_at IS NULL
  ORDER BY sort_order;
  ```

  **Expected (5 rows):**
  ```
  <uuid> | Bridal Lehengas
  <uuid> | Sarees
  <uuid> | Evening Gowns
  <uuid> | Couture
  <uuid> | Suits
  ```

  If fewer than 5 rows: seed data is missing. Do not proceed to E2E testing until all 5 categories exist — the category name→UUID lookup in `ProductForm` will fail silently for any missing category.

---

## Task 4: TypeScript + Lint + Build Validation

- [ ] **Step 1: Run TypeScript strict check**

  ```bash
  npx tsc --noEmit
  ```

  **Expected:** No output (zero errors).

  If errors appear, read them carefully. The most likely source is the `getProductById` import in `ProductForm.tsx` — ensure `services/products.ts` exports it.

- [ ] **Step 2: Run ESLint**

  ```bash
  npm run lint
  ```

  **Expected:** No errors. Warnings are acceptable, errors are not.

  If lint errors appear:
  - `'fetchProducts' is not defined` → mockDb import was not fully removed — re-check Task 1 Step 1
  - `'addProduct' is not defined` → same issue
  - Any other error: read and fix the specific line before proceeding

- [ ] **Step 3: Run production build**

  ```bash
  npm run build
  ```

  **Expected output:**
  ```
  ✓ Compiled successfully
  ✓ Collecting page data
  ✓ Generating static pages
  ✓ Build completed
  ```

  If build fails, read the error. Do not proceed to manual testing until all three (tsc, lint, build) pass with zero errors.

  All three gates clean → proceed to Task 5 (E2E). The commit happens in Task 7 after E2E, regression, and production smoke test all pass.

---

## Task 5: Manual E2E Verification — Product Feature

Start the dev server:
```bash
npm run dev
```

Navigate to `http://localhost:3000`. Open Chrome DevTools → Console (to watch for errors) and Network → Fetch/XHR (to confirm Supabase requests).

### 5.1 Create Product (No Image)

- [ ] Navigate to `/products/add`

- [ ] Fill form:
  - Name: `MEI Client Demo — Test Saree`
  - Category: `Sarees` (from dropdown)
  - Price: `85000`
  - Work Types: click `Zardozi`
  - Published: checked
  - No image

- [ ] Click **SAVE PRODUCT**

  **Expected:**
  - Redirect to `/products`
  - `MEI Client Demo — Test Saree` appears in the product list
  - Category column shows `Sarees`
  - Price column shows `₹85,000`
  - Status badge shows `PUBLISHED`
  - No red errors in browser console
  - Network tab shows `POST *.supabase.co/rest/v1/products` — status 201

- [ ] Verify in Supabase SQL Editor:
  ```sql
  SELECT id, name, category_id, price, work_types, status
  FROM public.products
  WHERE name = 'MEI Client Demo — Test Saree'
    AND deleted_at IS NULL;
  ```

  **Expected:** One row with `work_types = {ZARDOZI}`, `status = PUBLISHED`.

### 5.2 Create Product (With Image)

- [ ] Navigate to `/products/add`

- [ ] Fill form:
  - Name: `MEI Client Demo — Test Lehenga`
  - Category: `Bridal Lehengas`
  - Price: `185000`
  - Work Types: click `Aari`, `Zardozi`
  - Published: checked
  - Click the upload zone or drag a JPG/PNG (any local image)

- [ ] Click **SAVE PRODUCT**

  **Expected:**
  - Redirect to `/products`
  - `MEI Client Demo — Test Lehenga` appears with image thumbnail
  - Network tab shows ALL THREE of these succeeding:
    - `POST .../rest/v1/products` — status 201 (initial insert)
    - `POST .../storage/v1/object/product-images/products/<uuid>/...` — status 200 (image upload)
    - `PATCH .../rest/v1/products?id=eq.<uuid>` — status 200 (image URL written back)

- [ ] Verify in Supabase Dashboard → Storage → `product-images` bucket:
  - Folder `products/<uuid>/` exists
  - Contains an uploaded image file

- [ ] Verify `image_url` in SQL:
  ```sql
  SELECT image_url
  FROM public.products
  WHERE name = 'MEI Client Demo — Test Lehenga'
    AND deleted_at IS NULL;
  ```

  **Expected:** Non-null URL pointing to Supabase storage.

### 5.3 Edit Product

- [ ] On the products list, click **EDIT** on `MEI Client Demo — Test Saree`

  **Expected:**
  - URL changes to `/products/edit/<uuid>`
  - Form populates: name `MEI Client Demo — Test Saree`, category `Sarees` selected, price `85000`, Published checked, `ZARDOZI` work type button active
  - No "Product not found" alert
  - No console errors
  - Network tab shows `GET .../rest/v1/products?id=eq.<uuid>` — status 200

- [ ] Change price to `90000`. Click **SAVE CHANGES**

  **Expected:**
  - Redirect to `/products`
  - Price column now shows `₹90,000`
  - Network tab shows `PATCH .../rest/v1/products?id=eq.<uuid>` — status 200

- [ ] Verify in Supabase SQL Editor:
  ```sql
  SELECT price FROM public.products
  WHERE name = 'MEI Client Demo — Test Saree' AND deleted_at IS NULL;
  ```

  **Expected:** `90000`

### 5.4 Delete Product

- [ ] On the products list, click **DELETE** on `MEI Client Demo — Test Saree`

  **Expected:**
  - Confirmation dialog appears
  - After confirming: product disappears from list
  - No console errors

- [ ] Verify in Supabase SQL Editor:
  ```sql
  SELECT id, name, deleted_at FROM public.products
  WHERE name = 'MEI Client Demo — Test Saree';
  ```

  **Expected:** `deleted_at` is NOT NULL (soft delete, not hard delete).

### 5.5 Data Survives Refresh

- [ ] Hard refresh the products list page (`Ctrl+Shift+R`).

  **Expected:** `MEI Client Demo — Test Lehenga` still appears. Data is from Supabase, not cached in localStorage.

  This confirms Supabase persistence is the source of truth.

---

## Task 6: Regression Testing — Other Pages

For each page: navigate to it, confirm it loads, confirm no red errors in browser console.

- [ ] **Categories page** (`/categories`)

  Expected: Category list loads. No console errors.

- [ ] **Orders page** (`/orders`)

  Expected: Orders list renders. No console errors.

- [ ] **Enquiries page** (`/enquiries`)

  Expected: Enquiries list renders. No console errors.

- [ ] **Banners page** (`/banners`)

  This was the page previously failing with `column banners.deleted_at does not exist`. After migration 010:

  **Expected:**
  - Page loads without error
  - Banners list renders (may be empty if no banners were created via Supabase yet)
  - NO red error in console about `deleted_at`
  - Network tab shows successful GET to `*.supabase.co/rest/v1/banners`

  If the error persists → migration 010 was not applied. Return to Task 3 Step 2.

- [ ] **Settings page** (`/settings`)

  Expected: Settings form loads. No console errors.

- [ ] **Products list page** (`/products`)

  Expected: Products list renders, `MEI Client Demo — Test Lehenga` (created in 5.2, not deleted) is visible. No console errors.

---

## Task 7: Final Commit and Production Readiness Declaration

**Run this task last — after Task 5 (E2E), Task 6 (regression), Task 8 (storage policies), Task 9 (env consistency), and Task 10 (production smoke test) all pass.** Committing before those checks pass may require additional fix commits that dirty the history.

- [ ] **Step 1: Confirm git status**

  ```bash
  git status
  ```

  Expected: Only the four files from the File Map should appear as modified:
  ```
  M components/products/ProductForm.tsx
  M services/products.ts
  M types/database.ts
  M supabase/migrations/010_banners_deleted_at.sql
  ```

  If unexpected files appear, review them before staging.

- [ ] **Step 2: Confirm TypeScript one final time**

  ```bash
  npx tsc --noEmit
  ```

  Expected: No output (zero errors).

- [ ] **Step 3: Commit**

  ```bash
  git add components/products/ProductForm.tsx services/products.ts types/database.ts supabase/migrations/010_banners_deleted_at.sql
  git commit -m "fix: wire ProductForm to Supabase; add banners.deleted_at migration"
  ```

  If any fixes were made during Tasks 5–10, stage those files alongside the four above.

---

## Task 8 (M): Supabase Storage Permissions Verification

**Purpose:** Confirm that the `storage.objects` table has the necessary RLS policies for image upload to succeed. A missing INSERT policy will cause silent upload failures even if the bucket exists and credentials are valid. Run this before E2E image upload testing.

- [ ] **Step 1: Check storage object policies**

  Run in Supabase Dashboard → SQL Editor:
  ```sql
  SELECT
    policyname,
    permissive,
    roles,
    cmd,
    qual
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
  ORDER BY cmd;
  ```

  **Expected:** Policies covering at minimum:
  - `INSERT` — allows authenticated or anon users to upload to `product-images`
  - `SELECT` — allows reading uploaded files
  - `UPDATE` — allows overwriting an existing image (required for edit flow)

  If any of these are missing, image uploads in Task 5.2 and edit image replacement in Task 5.3 will fail with a 403 from Supabase Storage, even though the bucket exists.

- [ ] **Step 2: If policies are missing — add them**

  Run in Supabase Dashboard → SQL Editor. Adjust `bucket_id` and `roles` to match your project's auth setup:
  ```sql
  -- Allow public reads
  CREATE POLICY "Public read product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

  -- Allow authenticated uploads
  CREATE POLICY "Authenticated upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images');

  -- Allow authenticated updates (image replacement)
  CREATE POLICY "Authenticated update product images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images');
  ```

  If the app uses `anon` key (no login), replace `TO authenticated` with `TO anon`.

- [ ] **Step 3: Re-run Step 1 to confirm policies exist**

  Expected: All three commands (SELECT, INSERT, UPDATE) now appear in the results.

---

## Task 9 (N): Environment Consistency Verification

**Purpose:** Confirm the app is pointed at the correct Supabase project (not a local instance or wrong environment). A common error is having `.env.local` pointing to a local or staging Supabase while believing you are testing against production.

- [ ] **Step 1: Check Supabase CLI project linkage**

  ```bash
  npx supabase status
  ```

  **Expected:** Output shows the linked project ID and API URL matching your production/staging target. If the CLI is not linked, the output will show a warning — this is acceptable as long as the env vars are correct.

- [ ] **Step 2: Confirm NEXT_PUBLIC_SUPABASE_URL is not localhost**

  On Windows PowerShell:
  ```powershell
  Get-Content .env.local | Select-String "NEXT_PUBLIC_SUPABASE_URL"
  ```

  **Expected:**
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://<project-id>.supabase.co
  ```

  **Stop if the value is:**
  ```
  NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
  ```

  A localhost URL means the app is talking to a local Supabase instance. Data created during E2E testing will not persist to the production/staging database. Fix the URL before continuing.

- [ ] **Step 3: Verify the anon key matches the project**

  The `NEXT_PUBLIC_SUPABASE_ANON_KEY` JWT payload contains the project reference in the `ref` claim. If using a JWT decoder (e.g., jwt.io), decode the key and confirm the `ref` matches the project ID in the Supabase URL.

  This step is optional if the URL check in Step 2 is clean — document the check as skipped.

---

## Task 10 (O): Production Build Smoke Test

**Purpose:** A passing `npm run build` verifies static analysis but does not guarantee the app is functional at runtime. This task runs the production build and manually verifies the product pages work — catching issues like missing env vars at runtime, SSR failures, or hydration mismatches that only surface in production mode.

- [ ] **Step 1: Run production start**

  ```bash
  npm run start
  ```

  **Expected:** Output:
  ```
  ▲ Next.js 16.x.x
  - Local: http://localhost:3000
  ✓ Ready
  ```

  If the server crashes on startup (e.g., missing env var accessed at module load), fix the root cause before continuing.

- [ ] **Step 2: Verify products list in production mode**

  Open `http://localhost:3000/products` in the browser.

  **Expected:**
  - Products list renders (same data as dev mode)
  - No hydration warnings in browser console
  - No runtime errors in the terminal running `npm run start`

- [ ] **Step 3: Verify create product page in production mode**

  Navigate to `http://localhost:3000/products/add`.

  **Expected:**
  - Form renders completely
  - Category dropdown populates with 5 categories
  - No hydration warnings or runtime errors

- [ ] **Step 4: Verify edit product page in production mode**

  Navigate to `http://localhost:3000/products/edit/<uuid-of-test-lehenga>` (use the UUID from Task 5.2).

  **Expected:**
  - Form loads with pre-populated product data
  - No "Product not found" alert
  - No hydration warnings or runtime errors

- [ ] **Step 5: Stop production server**

  Press `Ctrl+C` in the terminal running `npm run start`. Switch back to dev server (`npm run dev`) for any remaining verification.

---

## Stop Conditions

Stop immediately if ANY of the following are true. Do not continue with assumptions.

| # | Condition | Action |
|---|---|---|
| 1 | Task 1 Step 1 grep returns matches for `mockDb`/`addProduct`/`fetchProducts` | mockDb fix not applied — investigate before proceeding |
| 2 | Task 1 Step 2 grep shows wrong service imports | ProductForm wiring is incorrect — fix before proceeding |
| 3 | Task 1 Step 3 shows duplicate exports | Duplicate service logic exists — remove duplication |
| 4 | Task 1 Step 6 shows more than one `getCategories` | Service duplication — investigate |
| 5 | Task 1 Step 7 shows `.from('categories')` inside ProductForm.tsx | Direct Supabase query bypasses service — fix to use `getCategories()` |
| 6 | Task 1 Step 8 shows more than one `uploadProductImage` | Storage logic duplication — investigate |
| 7 | Task 2 Step 1 shows `.env.local` missing Supabase credentials | Env not configured — add credentials before proceeding |
| 8 | Task 2 Step 2 shows no `product-images` bucket | Create bucket before E2E testing |
| 9 | `products` table is missing a column from Task 3 Step 4 | Schema drift — investigate all migrations |
| 10 | `categories` table has fewer than 5 rows (Task 3 Step 5) | Seed data missing — apply seed migration |
| 11 | `npx tsc --noEmit` returns any errors | Fix TypeScript errors before any manual testing |
| 12 | `npm run lint` returns errors (not warnings) | Fix lint errors before E2E |
| 13 | `npm run build` fails | Fix build errors before E2E |
| 14 | Banners page still shows `deleted_at` error after Task 3 | Migration 010 not applied — re-run `npx supabase db push` |
| 15 | Product created in UI but row does not appear in Supabase SQL | RLS or auth issue — check anon/admin JWT and policies |
| 16 | Network tab shows NO request to `*.supabase.co` after form submit | Form still hitting mockDb or different code path — stop |
| 17 | Image upload succeeds in UI but `image_url` is null in DB | Storage bucket missing or RLS blocks upload |
| 18 | Edit product shows "Product not found" | `getProductById` returning null — verify UUID matches DB row |

---

## Success Criteria — Required Validation Order

Do not mark complete until every checkbox below is ticked. Execute in this exact order.

### Phase 1 — Code verified
- [ ] No ProductForm `mockDb` usage (Task 1 Steps 1, 10)
- [ ] No ProductForm `localStorage` usage (Task 1 Step 10)
- [ ] Existing services reused (Task 1 Steps 3–4, 6, 8)
- [ ] No duplicated service logic (Task 1 Steps 3–4, 6, 8)
- [ ] `getCategories` service reused (Task 1 Steps 6–7)
- [ ] `uploadProductImage` service reused (Task 1 Steps 4, 8)

### Phase 2 — Infrastructure verified
- [ ] `.env.local` has Supabase URL and anon key (Task 2 Step 1)
- [ ] `product-images` storage bucket exists (Task 2 Step 2)
- [ ] RLS policies verified for `products` and `categories` (Task 2 Step 3)

### Phase 3 — Migration applied
- [ ] Migration 010 applied to Supabase (Task 3 Step 2)
- [ ] `banners.deleted_at` column confirmed present (Task 3 Step 3)
- [ ] `products` table has all 11 expected columns (Task 3 Step 4)
- [ ] `categories` table has 5 rows (Task 3 Step 5)

### Phase 4 — TypeScript / Lint / Build clean
- [ ] `npx tsc --noEmit` returns 0 errors (Task 4 Step 1)
- [ ] `npm run lint` returns 0 errors (Task 4 Step 2)
- [ ] `npm run build` completes successfully (Task 4 Step 3)

### Phase 5 — Product E2E verified
- [ ] Create product (no image) — appears in list
- [ ] Create product (no image) — row confirmed in Supabase SQL
- [ ] Create product (with image) — image thumbnail renders in list
- [ ] Create product (with image) — image file confirmed in Supabase Storage `product-images/products/<uuid>/`
- [ ] Create product (with image) — `image_url` confirmed in Supabase products row
- [ ] Edit product — form loads correct Supabase data (name, category, price, status, work types)
- [ ] Edit product — price change confirmed in Supabase SQL after save
- [ ] Delete product — row confirmed soft-deleted (`deleted_at` NOT NULL)
- [ ] Data survives hard refresh — products list shows Supabase data after `Ctrl+Shift+R`
- [ ] Network tab confirms NO mockDb/localStorage writes during any create/edit operation
- [ ] No red console errors during any product operation

### Phase 6 — Regression verified
- [ ] Categories page loads without errors
- [ ] Orders page loads without errors
- [ ] Enquiries page loads without errors
- [ ] Banners page loads without `deleted_at` error (previously broken)
- [ ] Settings page loads without errors
- [ ] Products list page loads without errors

### Phase 7 — Final checks
- [ ] `npx tsc --noEmit` returns 0 errors (final confirmation)
- [ ] `git status` shows working tree clean
- [ ] No mockDb imports remain in `components/products/ProductForm.tsx`
- [ ] No duplicate service functions in `services/products.ts`, `services/categories.ts`, `services/storage.ts`

### Phase 8 — Deployment Readiness
- [ ] Storage RLS policies verified — INSERT, SELECT, UPDATE on `storage.objects` for `product-images` (Task 8)
- [ ] Supabase project linkage verified — URL is `https://` not `localhost` (Task 9)
- [ ] Production build successful — `npm run build` completes with 0 errors (Task 4 Step 3)
- [ ] Production start successful — `npm run start` serves without crash (Task 10 Step 1)
- [ ] Products list loads in production mode (Task 10 Step 2)
- [ ] Create product page loads in production mode with categories populated (Task 10 Step 3)
- [ ] Edit product page loads in production mode with pre-populated data (Task 10 Step 4)
- [ ] No hydration warnings in production mode
- [ ] No runtime errors in production terminal

---

## Final Approval Gate

**Do NOT declare production ready until ALL items below are true.**

| # | Check | Status |
|---|---|---|
| 1 | Migration 010 applied (`banners.deleted_at` exists) | |
| 2 | Products schema verified (11 columns present) | |
| 3 | Categories seeded (5 rows, no deleted_at) | |
| 4 | Storage bucket `product-images` verified | |
| 5 | Storage RLS policies verified (INSERT + SELECT + UPDATE) | |
| 6 | RLS policies on `products` and `categories` verified | |
| 7 | Supabase URL confirmed pointing to correct project (not localhost) | |
| 8 | TypeScript clean — `npx tsc --noEmit` = 0 errors | |
| 9 | Lint clean — `npm run lint` = 0 errors | |
| 10 | Build clean — `npm run build` succeeds | |
| 11 | Production start clean — `npm run start` serves without crash | |
| 12 | Product create (no image) verified in UI + SQL | |
| 13 | Product image upload verified in UI + Storage + SQL `image_url` | |
| 14 | Product edit verified in UI + SQL | |
| 15 | Product delete verified as soft-delete in SQL (`deleted_at` NOT NULL) | |
| 16 | Data persists after hard refresh (Ctrl+Shift+R) | |
| 17 | Categories regression — page loads clean | |
| 18 | Orders regression — page loads clean | |
| 19 | Enquiries regression — page loads clean | |
| 20 | Banners regression — no `deleted_at` error | |
| 21 | Settings regression — page loads clean | |
| 22 | Products list regression — page loads clean | |
| 23 | `git status` shows working tree clean | |
| 24 | Final report completed | |

---

## Final Report Template

Fill in after all Success Criteria are ticked:

```
ROOT CAUSE:
  ProductForm.tsx imported addProduct/updateProduct/fetchProducts from lib/mockDb.ts
  which writes to localStorage. Products list reads from Supabase. No overlap.

SCHEMA ISSUES FOUND:
  banners table missing deleted_at column (services/banners.ts references it).
  Fixed via migration 010_banners_deleted_at.sql.

FILES CHANGED (4 total):
  components/products/ProductForm.tsx — persistence layer only (no JSX/styling)
  services/products.ts — getProductById added (single new export)
  types/database.ts — banners deleted_at typed
  supabase/migrations/010_banners_deleted_at.sql — schema patch (IF NOT EXISTS safe)

SERVICES REUSED (not duplicated):
  createProduct, updateProduct, deleteProduct from services/products.ts
  uploadProductImage from services/storage.ts
  getCategories from services/categories.ts

TESTS PERFORMED:
  ✓ Create product (no image) — Supabase row confirmed
  ✓ Create product (with image) — Storage file + image_url confirmed
  ✓ Edit product — Supabase row updated confirmed
  ✓ Delete product — soft delete (deleted_at) confirmed
  ✓ Data survives hard refresh
  ✓ No console errors during product operations
  ✓ Categories page regression — clean
  ✓ Orders page regression — clean
  ✓ Enquiries page regression — clean
  ✓ Banners page regression — previously broken, now clean
  ✓ Settings page regression — clean

TYPESCRIPT: 0 errors
LINT: 0 errors
BUILD: succeeded

REMAINING RISKS:
  - lib/mockDb.ts is still used by Orders (write), Enquiries, Settings, Banners (write)
    pages. These are out of scope for this fix — future sprint work.
```

---

## Self-Review

**Spec coverage:**
- Rules 26–34: Added as "Production Hardening Add-On" section ✓
- Task A (no mockDb): Task 1 Steps 1, 10 ✓
- Task B (service reuse): Task 1 Steps 3–4, 6, 8 ✓
- Task C (ProductForm uses services, no direct .from('categories')): Task 1 Steps 2, 7 ✓
- Task D (env config): Task 2 Step 1 ✓
- Task E (storage bucket): Task 2 Step 2 ✓
- Task F (RLS policies): Task 2 Step 3 ✓
- Task G (migration 010): Task 3 ✓
- Task H (products schema): Task 3 Step 4 ✓
- Task I (categories seed): Task 3 Step 5 ✓
- Task J (tsc + lint + build): Task 4 Steps 1–3 ✓
- Task K (E2E): Task 5 ✓
- Task L (regression): Task 6 ✓
- Task M (storage object RLS policies): Task 8 ✓
- Task N (env consistency / no localhost): Task 9 ✓
- Task O (production build smoke test): Task 10 ✓
- Phase 8 deployment readiness: Success Criteria Phase 8 ✓
- Final Approval Gate (24-item table): Final Approval Gate section ✓
- Early commit removed from Task 4 — single commit deferred to Task 7 (last step) ✓
- Recommended Execution Order table added ✓

**No placeholders:** All commands, SQL queries, expected outputs, and verification criteria are explicit. ✓

**Type consistency:** `getProductById` returns `Product | null`. In ProductForm `loadProduct`, consumed as `const prod = await getProductById(editId!)` → `prod.name`, `prod.description`, `prod.work_types`, `prod.image_url`, `prod.status`, `prod.category_id` — all match `Product` Row definition in `types/database.ts`. ✓
