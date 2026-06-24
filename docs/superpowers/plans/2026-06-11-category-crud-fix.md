# Category CRUD Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Category CRUD so that create, edit, delete, and image upload all persist to Supabase — eliminating the mockDb dependency in the category form.

**Architecture:** `app/(app)/categories/add/page.tsx` is surgically rewired from `lib/mockDb.ts` (localStorage) to `services/categories.ts` + `services/storage.ts` (Supabase). A migration adds the three columns the form collects but the DB currently lacks (`subtitle`, `image_url`, `is_active`). A new `getCategoryById` service function and `uploadCategoryImage` storage function are added. The add page gains edit mode by reading the existing `?edit=<id>` query param that the list page already produces.

**Tech Stack:** Next.js 16 App Router (client component + Suspense for `useSearchParams`), Supabase (supabase-js v2 via `@supabase/ssr`), TanStack Query v5, TypeScript strict

---

## Investigation Report (Evidence)

**Root Cause #1 — CRITICAL (Create & Persist)**
`app/(app)/categories/add/page.tsx:5`:
```ts
import { addCategory } from '@/lib/mockDb';  // ← writes to localStorage
```
Should be:
```ts
import { createCategory, updateCategory, getCategoryById } from '@/services/categories';
```
`lib/mockDb.ts:585-590` confirms `addCategory` writes to localStorage via `getRawCategories()`.

**Root Cause #2 — CRITICAL (Edit)**
`app/(app)/categories/page.tsx:76` EDIT link:
```tsx
href={`/categories/add?edit=${category.id}`}
```
`app/(app)/categories/add/page.tsx` has no `useSearchParams`, no `useEffect` to load category data, no edit flow. The `?edit=<id>` param is ignored entirely.

**Root Cause #3 — CRITICAL (Schema)**
`types/database.ts:18` categories Row:
```ts
{ id, name, slug, description, sort_order, created_at, deleted_at }
```
Migration `002_categories_products.sql:5-13` confirms the same. Missing: `subtitle`, `image_url`, `is_active`.
The form collects and submits these three fields — they exist in the UI but have no column to land in.

**Root Cause #4 — CRITICAL (Image Upload)**
`services/storage.ts` exports only `uploadProductImage` and `deleteProductImage`. No category image upload exists. The form converts images to data URLs and passes them to mockDb — no Supabase Storage upload path exists.

**Root Cause #5 (Missing Service)**
`services/categories.ts` has no `getCategoryById`. The edit flow requires fetching a single category by ID to populate the form.

**Phase 5 — Delete: OK**
`services/categories.ts:72-86` correctly soft-deletes via `update({ deleted_at: new Date().toISOString() })`. `getCategories` filters `is('deleted_at', null)`. Delete works correctly and does not need changes.

**Phase 7 — Product Integration**
`components/products/ProductForm.tsx:69,187` calls `getCategories()` from `services/categories`. Once categories exist in Supabase (after this fix), they will appear automatically in the product dropdown. No product code changes needed.

---

## Implementation Safety Requirements

These requirements apply to every task. Any violation is a stop condition.

**Investigation-first:** Verify actual database and runtime state before modifying any code. Do not rely on TypeScript types, local migration files, comments, or prior plans — only actual code and actual database evidence.

**Minimal-diff:** Read the complete file before modifying it. Identify the exact lines causing the issue. Produce a surgical modification plan. Preserve all unrelated code. The one exception: `app/(app)/categories/add/page.tsx` requires a full rewrite because (a) the import, all state hooks, the entire `handleSubmit` function, the component structure (adding Suspense), and two dynamic text nodes are all changing simultaneously, and (b) the JSX content body (all layout, Tailwind classes, field order, labels, form structure) is preserved character-for-character in the rewrite.

**No `fetch(dataUrl)` pattern (CRITICAL):** The following patterns are forbidden in the category form. They cause CSP violations (`Refused to connect because it violates Content Security Policy`) proven by the ProductForm incident:
```ts
// FORBIDDEN
fetch(image)
fetch(dataUrl)
await fetch(base64Image)
```
Store the original `File` object on file selection. Use `URL.createObjectURL(file)` for the image preview only. Pass the `File` directly to the upload function. Verification:
```bash
grep -n "fetch(image\|fetch(data" "app/(app)/categories/add/page.tsx"
```
Expected: No output.

**Slug uniqueness:** Check for slug collision before any Supabase insert or update. Requires `getCategoryBySlug` in the service layer.

**Transaction safety:** If image upload fails after category create, rollback the created category row to avoid orphaned records.

**Image replacement cleanup:** When a category image is replaced during edit, delete the old storage object to prevent storage accumulation.

**Actual execution:** Do not mark any step complete based on code inspection alone. Require actual runtime verification.

---

## Non-Negotiable Rules

1. Do NOT modify JSX structure, layout, Tailwind classes, component hierarchy, routes, or navigation.
2. Do NOT modify `lib/mockDb.ts` — other pages depend on it.
3. Do NOT modify `services/products.ts`, `hooks/use-products.ts`, `components/products/ProductForm.tsx`, or any orders/enquiries/banners/settings code.
4. Do NOT create duplicate service functions.
5. Do NOT add TODOs, debug code, or console logs in final code.
6. `npm run lint` must return 0 errors before any manual testing.
7. `npx tsc --noEmit` must return 0 errors before any manual testing.
8. `npm run build` must succeed before any manual testing.
9. Commit only after all three validation gates pass.

---

## File Map

**Modified:**
- `supabase/migrations/011_categories_extended_schema.sql` — CREATE (adds subtitle, image_url, is_active columns + category-images bucket)
- `types/database.ts:17-21` — Add subtitle, image_url, is_active to categories Row/Insert/Update
- `services/categories.ts` — Add `getCategoryById` export
- `services/storage.ts` — Add `uploadCategoryImage` export
- `app/(app)/categories/add/page.tsx` — Remove mockDb, add edit mode, wire to services, add image upload

**Unchanged (confirm not touched):**
- `app/(app)/categories/page.tsx`
- `services/products.ts`
- `hooks/use-categories.ts`
- `lib/mockDb.ts`
- All products/orders/enquiries/banners/settings files

---

## Task 0: Pre-Execution Verification Gates

**Run all steps in this task before touching any code or creating any migration. Collect actual evidence. Stop if any result contradicts the investigation report.**

**Files:** Read-only — no changes in this task.

- [ ] **Step 1: Verify actual database schema for categories**

  Run in Supabase Dashboard → SQL Editor:
  ```sql
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'categories'
  ORDER BY ordinal_position;
  ```

  **Expected (7 columns — missing subtitle, image_url, is_active):**
  ```
  id          | uuid                     | NO  |
  name        | text                     | NO  |
  slug        | text                     | NO  |
  description | text                     | YES |
  sort_order  | integer                  | NO  | 0
  created_at  | timestamp with time zone | NO  |
  deleted_at  | timestamp with time zone | YES |
  ```

  If `subtitle`, `image_url`, or `is_active` already exist → migration 011 is already applied or was applied out-of-band. Update Task 1 to skip those columns and proceed.

- [ ] **Step 2: Check for existing duplicate active slugs — CRITICAL**

  Migration 011 creates `CREATE UNIQUE INDEX ... WHERE deleted_at IS NULL`. If duplicate active slugs already exist in the database, this statement will fail and block the entire migration.

  Run in Supabase SQL Editor:
  ```sql
  SELECT slug, COUNT(*)
  FROM public.categories
  WHERE deleted_at IS NULL
  GROUP BY slug
  HAVING COUNT(*) > 1;
  ```

  **Expected:** `0 rows`

  If any rows are returned → **STOP**. Do not run the migration until duplicates are resolved. For each duplicate slug, soft-delete the older record:
  ```sql
  -- Find the older duplicate and soft-delete it
  UPDATE public.categories
  SET deleted_at = now()
  WHERE id IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY slug ORDER BY created_at DESC) AS rn
      FROM public.categories WHERE deleted_at IS NULL
    ) ranked WHERE rn > 1
  );
  ```
  Re-run the duplicate check to confirm 0 rows before continuing.

- [ ] **Step 2a: Document category count before migration (data loss baseline)**

  ```sql
  SELECT COUNT(*) FROM public.categories;
  ```

  Record this number. After migration 011 applies, re-run to confirm the count is identical. A lower count would indicate accidental data loss.

- [ ] **Step 3: Verify public.is_admin() function exists**

  Migration 011 creates storage policies that call `public.is_admin()`. If this function doesn't exist, the migration will fail with `function is_admin() does not exist`.

  Run in Supabase SQL Editor:
  ```sql
  SELECT proname, pronamespace::regnamespace AS schema
  FROM pg_proc
  WHERE proname = 'is_admin';
  ```

  **Expected:** One row — `is_admin | public`

  If no row returned → **STOP**. The `is_admin()` function must be created before migration 011. Check migrations 001–005 for its definition. If missing from all migrations, inspect the Supabase project → Database → Functions directly.

- [ ] **Step 4: Verify existing storage buckets**

  Run in Supabase SQL Editor:
  ```sql
  SELECT id, name, public FROM storage.buckets ORDER BY id;
  ```

  **Expected:** `product-images` exists. `category-images` does NOT exist.

  If `category-images` already exists → skip bucket creation in Task 1, only create policies if missing.

- [ ] **Step 5: Verify createCategory return shape**

  ```bash
  grep -n "return data" services/categories.ts
  ```

  **Expected:** Line ~46 shows `return data as Category` inside `createCategory`. This confirms `newCategory.id` in Task 5's upload rollback is safe.

  If `createCategory` returns `{ success: true }` or void → **STOP**. The upload flow depends on the returned `id`. Fix the service contract before continuing.

- [ ] **Step 6: Verify updateCategory accepts all fields (no whitelist)**

  ```bash
  grep -A5 "export async function updateCategory" services/categories.ts
  ```

  **Expected:** Uses `updates as never` (passes all fields through to Supabase without filtering). This confirms `subtitle`, `image_url`, `is_active` will persist once the migration adds the columns.

  If the function manually picks specific keys (e.g., `{ name: updates.name, slug: updates.slug }`) → fields will be silently dropped. Fix before continuing.

- [ ] **Step 7: Verify existing service exports — no duplication**

  ```bash
  grep -n "^export" services/categories.ts
  ```

  **Expected (4 exports, no getCategoryById):**
  ```
  12:export async function getCategories(
  27:export async function createCategory(
  49:export async function updateCategory(
  72:export async function deleteCategory(
  ```

  If `getCategoryById` already appears → Task 3 is already done. Skip Task 3.

  ```bash
  grep -n "^export" services/storage.ts
  ```

  **Expected (2 exports, no uploadCategoryImage):**
  ```
  7:export async function uploadProductImage(
  27:export async function deleteProductImage(
  ```

  If `uploadCategoryImage` already appears → Task 4 is already done. Skip Task 4.

- [ ] **Step 8: Verify categories add page still imports from mockDb**

  ```bash
  grep -n "mockDb\|addCategory" "app/(app)/categories/add/page.tsx"
  ```

  **Expected:**
  ```
  5:import { addCategory } from '@/lib/mockDb';
  93:      await addCategory({
  ```

  If no matches → the fix was already applied. Run Task 6 validation gates directly to confirm it's correct.

- [ ] **Step 9: Verify query cache refresh strategy**

  ```bash
  grep -n "invalidateQueries\|staleTime" hooks/use-categories.ts
  ```

  **Expected:** `onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] })` appears in `useCreateCategory`, `useUpdateCategory`, `useDeleteCategory`.

  Note: `add/page.tsx` calls services directly (not hooks), so these `onSuccess` handlers will NOT fire during create/update. However, `router.push('/categories')` causes component remount → React Query refetches on mount (default `staleTime: 0`). The categories list WILL show fresh data. This is the accepted behavior — document it and proceed.

- [ ] **Step 10: All evidence collected — proceed**

  Document your findings from Steps 1–7 before continuing to Task 1. The actual DB state governs which parts of Tasks 1–5 execute.

---

## Task 1: Database Migration — Add Missing Columns

**Files:**
- Create: `supabase/migrations/011_categories_extended_schema.sql`

- [ ] **Step 1: Create migration file**

  ```bash
  # File: supabase/migrations/011_categories_extended_schema.sql
  ```

  Write the following content to `supabase/migrations/011_categories_extended_schema.sql`:

  ```sql
  -- Add missing columns to categories table
  ALTER TABLE public.categories
    ADD COLUMN IF NOT EXISTS subtitle  TEXT,
    ADD COLUMN IF NOT EXISTS image_url TEXT,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

  -- Slug uniqueness: database-level constraint prevents race conditions
  -- Partial index allows reuse of slugs from soft-deleted categories
  CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_active_unique
    ON public.categories(slug)
    WHERE deleted_at IS NULL;

  -- Create category-images storage bucket
  -- Public = true because storefront displays category images to end users
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('category-images', 'category-images', true)
  ON CONFLICT (id) DO NOTHING;

  -- Storage policies for category-images (safe to run multiple times via DO blocks)
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admins can upload category images'
    ) THEN
      CREATE POLICY "Admins can upload category images"
        ON storage.objects FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'category-images' AND public.is_admin());
    END IF;
  END $$;

  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admins can update category images'
    ) THEN
      CREATE POLICY "Admins can update category images"
        ON storage.objects FOR UPDATE TO authenticated
        USING (bucket_id = 'category-images' AND public.is_admin());
    END IF;
  END $$;

  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admins can delete category images'
    ) THEN
      CREATE POLICY "Admins can delete category images"
        ON storage.objects FOR DELETE TO authenticated
        USING (bucket_id = 'category-images' AND public.is_admin());
    END IF;
  END $$;

  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Public can read category images'
    ) THEN
      CREATE POLICY "Public can read category images"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'category-images');
    END IF;
  END $$;
  ```

- [ ] **Step 2: Apply migration — check status first**

  ```bash
  npx supabase migration list
  ```

  **Expected:** Migration 011 appears with empty Remote column.

- [ ] **Step 3: Apply via CLI or Supabase Dashboard**

  **Option A — CLI:**
  ```bash
  npx supabase db push
  ```
  Expected: `Applying migration 011_categories_extended_schema.sql... Done.`

  **Option B — Dashboard SQL Editor** (if CLI fails):
  Run the ALTER TABLE statement first:
  ```sql
  ALTER TABLE public.categories
    ADD COLUMN IF NOT EXISTS subtitle  TEXT,
    ADD COLUMN IF NOT EXISTS image_url TEXT,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
  ```

  Then run the bucket insert:
  ```sql
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('category-images', 'category-images', true)
  ON CONFLICT (id) DO NOTHING;
  ```

  Then run each DO $$ block individually for the storage policies.

- [ ] **Step 3b: Verify category count after migration — no data loss**

  ```sql
  SELECT COUNT(*) FROM public.categories;
  ```

  **Expected:** Same count as recorded in Task 0 Step 2a. If lower → data loss occurred. Investigate before continuing.

- [ ] **Step 4: Verify columns exist**

  Run in Supabase SQL Editor:
  ```sql
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'categories'
  ORDER BY ordinal_position;
  ```

  **Expected columns:**
  ```
  id          | uuid                        | NO  |
  name        | text                        | NO  |
  slug        | text                        | NO  |
  description | text                        | YES |
  sort_order  | integer                     | NO  | 0
  created_at  | timestamp with time zone    | NO  |
  deleted_at  | timestamp with time zone    | YES |
  subtitle    | text                        | YES |
  image_url   | text                        | YES |
  is_active   | boolean                     | NO  | true
  ```

  Stop if `subtitle`, `image_url`, or `is_active` are missing.

- [ ] **Step 5: Verify category-images bucket**

  ```sql
  SELECT id, name, public FROM storage.buckets WHERE id = 'category-images';
  ```

  **Expected:** `category-images | category-images | true`

- [ ] **Step 6: Verify all four storage policies exist**

  ```sql
  SELECT policyname, cmd
  FROM pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname LIKE '%category%'
  ORDER BY cmd;
  ```

  **Expected (4 rows — all four operations):**
  ```
  Admins can delete category images  | DELETE
  Admins can update category images  | UPDATE
  Admins can upload category images  | INSERT
  Public can read category images    | SELECT
  ```

  Stop if DELETE policy is missing — `deleteCategoryImage()` will return 403 without it.

- [ ] **Step 7: Verify slug unique index**

  ```sql
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE tablename = 'categories'
    AND indexname = 'categories_slug_active_unique';
  ```

  **Expected:** One row with `WHERE (deleted_at IS NULL)` in the index definition. This partial index allows slug reuse after soft-delete and prevents race conditions that UI-only validation cannot stop.

- [ ] **Step 8: Verify existing rows received the is_active default**

  ```sql
  SELECT COUNT(*) FROM public.categories WHERE is_active IS NULL;
  ```

  **Expected:** `0` — the `DEFAULT true` on the new column should have populated all existing rows.

  If count > 0 (migration ran without a default, or rows were inserted before default was set):
  ```sql
  UPDATE public.categories SET is_active = true WHERE is_active IS NULL;
  ```
  Then re-run the count to confirm 0.

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `types/database.ts:17-21`

- [ ] **Step 1: Open types/database.ts and locate the categories section (lines 17–21)**

  Current content:
  ```ts
  categories: {
    Row: { id: string; name: string; slug: string; description: string | null; sort_order: number; created_at: string; deleted_at: string | null }
    Insert: { id?: string; name: string; slug: string; description?: string | null; sort_order?: number }
    Update: { name?: string; slug?: string; description?: string | null; sort_order?: number; deleted_at?: string | null }
  }
  ```

- [ ] **Step 2: Replace with updated types that include the three new columns**

  Replace the categories block with:
  ```ts
  categories: {
    Row: { id: string; name: string; slug: string; subtitle: string | null; description: string | null; image_url: string | null; sort_order: number; is_active: boolean; created_at: string; deleted_at: string | null }
    Insert: { id?: string; name: string; slug: string; subtitle?: string | null; description?: string | null; image_url?: string | null; sort_order?: number; is_active?: boolean }
    Update: { name?: string; slug?: string; subtitle?: string | null; description?: string | null; image_url?: string | null; sort_order?: number; is_active?: boolean; deleted_at?: string | null }
  }
  ```

- [ ] **Step 3: Run TypeScript check to confirm no type errors**

  ```bash
  npx tsc --noEmit
  ```

  **Expected:** No output (zero errors). If errors appear, they will be in files that use `Category` type — read them and ensure the new fields are optional where needed.

---

## Task 3: Add getCategoryById to services/categories.ts

**Files:**
- Modify: `services/categories.ts`

- [ ] **Step 1: Open services/categories.ts — verify current exports**

  ```bash
  grep -n "^export async function" services/categories.ts
  ```

  Expected output (4 functions, no `getCategoryById`):
  ```
  12:export async function getCategories(
  27:export async function createCategory(
  49:export async function updateCategory(
  72:export async function deleteCategory(
  ```

- [ ] **Step 2: Add getCategoryById and getCategoryBySlug after the existing getCategories function (after line 25)**

  Add both functions between `getCategories` and `createCategory`:

  ```ts
  export async function getCategoryById(id: string): Promise<Category | null> {
    const supabase = createClient()
    const response = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single()
    const { data, error } = response as { data: Category | null; error: { message: string; code: string } | null }
    if (error && error.code !== 'PGRST116') throw toAppError(new Error(error.message))
    return (data as Category | null) ?? null
  }

  export async function getCategoryBySlug(slug: string): Promise<{ id: string; slug: string } | null> {
    const supabase = createClient()
    const response = await supabase
      .from('categories')
      .select('id, slug')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single()
    const { data, error } = response as { data: { id: string; slug: string } | null; error: { message: string; code: string } | null }
    if (error && error.code !== 'PGRST116') throw toAppError(new Error(error.message))
    return data ?? null
  }
  ```

  Note: `PGRST116` is Supabase's "row not found" code — not an error, means category doesn't exist (returns null).

- [ ] **Step 3: Verify exports after edit**

  ```bash
  grep -n "^export async function" services/categories.ts
  ```

  **Expected (6 functions):**
  ```
  12:export async function getCategories(
  27:export async function getCategoryById(
  <N>:export async function getCategoryBySlug(
  <N>:export async function createCategory(
  <N>:export async function updateCategory(
  <N>:export async function deleteCategory(
  ```

  Line numbers will shift — confirm both `getCategoryById` and `getCategoryBySlug` appear exactly once.

- [ ] **Step 4: TypeScript check**

  ```bash
  npx tsc --noEmit
  ```

  **Expected:** No output (zero errors).

---

## Task 4: Add uploadCategoryImage to services/storage.ts

**Files:**
- Modify: `services/storage.ts`

- [ ] **Step 1: Open services/storage.ts — verify current content**

  Current exports:
  - `uploadProductImage(file: File, productId: string): Promise<string>`
  - `deleteProductImage(imageUrl: string): Promise<void>`

  Uses `const BUCKET = 'product-images'` (line 5).

- [ ] **Step 2: Add CATEGORY_BUCKET, uploadCategoryImage, and deleteCategoryImage after the existing code**

  Append to end of `services/storage.ts`:

  ```ts
  const CATEGORY_BUCKET = 'category-images'

  export async function uploadCategoryImage(file: File, categoryId: string): Promise<string> {
    const validationError = validateImageFile(file)
    if (validationError) {
      throw new AppError('VALIDATION_ERROR', validationError.message)
    }

    const supabase = createClient()
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `categories/${categoryId}/${Date.now()}.${ext}`

    const { error } = await supabase.storage
      .from(CATEGORY_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type })

    if (error) throw toAppError(error)

    const { data } = supabase.storage.from(CATEGORY_BUCKET).getPublicUrl(path)
    return data.publicUrl
  }

  export async function deleteCategoryImage(imageUrl: string): Promise<void> {
    const supabase = createClient()
    const marker = `/storage/v1/object/public/${CATEGORY_BUCKET}/`
    const idx = imageUrl.indexOf(marker)
    if (idx === -1) return  // URL doesn't match our bucket — nothing to delete
    const path = imageUrl.slice(idx + marker.length)

    const { error } = await supabase.storage.from(CATEGORY_BUCKET).remove([path])
    if (error) throw toAppError(error)
  }
  ```

- [ ] **Step 3: Verify no duplicate exports**

  ```bash
  grep -n "^export async function" services/storage.ts
  ```

  **Expected:**
  ```
  7:export async function uploadProductImage(
  27:export async function deleteProductImage(
  <N>:export async function uploadCategoryImage(
  <N>:export async function deleteCategoryImage(
  ```

  Exactly one of each. No duplicates.

- [ ] **Step 4: TypeScript check**

  ```bash
  npx tsc --noEmit
  ```

  **Expected:** No output (zero errors).

---

## Task 5: Rewrite app/(app)/categories/add/page.tsx

**Files:**
- Modify: `app/(app)/categories/add/page.tsx`

This is the core fix. The entire file is replaced. The JSX structure, layout, Tailwind classes, and all visual elements are **identical** to the original — only the imports, state logic, `useEffect` for edit load, and `handleSubmit` are changed.

- [ ] **Step 1: Replace the full file content**

  **Key changes vs. original file (for diff review):**
  - Imports: remove `addCategory`/mockDb, add `createCategory`, `updateCategory`, `getCategoryById`, `getCategoryBySlug`, `deleteCategory` from services/categories; add `uploadCategoryImage`, `deleteCategoryImage` from services/storage; add `Suspense` and `useSearchParams`
  - State: `image` (data URL) → `imagePreview` (blob URL or http URL) + `selectedFile` (File | null) + `originalImageUrl` (string | null for cleanup)
  - `processFile`: FileReader → `URL.createObjectURL` (no CSP violation)
  - `handleSubmit`: mockDb call → service calls + slug uniqueness check + rollback on upload failure + old image cleanup
  - Component structure: wrap export in `<Suspense>` for `useSearchParams`
  - JSX body: identical to original (all layout, Tailwind, labels, form fields unchanged)

  Write the following to `app/(app)/categories/add/page.tsx`:

  ```tsx
  'use client';

  import React, { useState, useEffect, Suspense } from 'react';
  import { useRouter, useSearchParams } from 'next/navigation';
  import {
    createCategory,
    updateCategory,
    getCategoryById,
    getCategoryBySlug,
    deleteCategory,
  } from '@/services/categories';
  import { uploadCategoryImage, deleteCategoryImage } from '@/services/storage';
  import { Upload, X, Loader2 } from 'lucide-react';
  import Link from 'next/link';

  function CategoryForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const editId = searchParams.get('edit');

    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [subtitle, setSubtitle] = useState('');
    const [description, setDescription] = useState('');
    const [imagePreview, setImagePreview] = useState('');         // blob: URL (new) or https: URL (existing)
    const [selectedFile, setSelectedFile] = useState<File | null>(null);  // original File for upload
    const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);  // for cleanup on replace
    const [sortOrder, setSortOrder] = useState(0);
    const [active, setActive] = useState(true);
    const [loading, setLoading] = useState(editId ? true : false);
    const [isDragging, setIsDragging] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
      if (!editId) return;

      async function loadCategory() {
        try {
          const cat = await getCategoryById(editId!);
          if (cat) {
            setName(cat.name);
            setSlug(cat.slug);
            setSubtitle(cat.subtitle ?? '');
            setDescription(cat.description ?? '');
            setImagePreview(cat.image_url ?? '');
            setOriginalImageUrl(cat.image_url ?? null);
            setSortOrder(cat.sort_order);
            setActive(cat.is_active ?? true);
          } else {
            alert('Category not found.');
            router.push('/categories');
          }
        } catch {
          alert('Failed to load category. Please try again.');
          router.push('/categories');
        } finally {
          setLoading(false);
        }
      }

      loadCategory();
    }, [editId, router]);

    useEffect(() => {
      return () => {
        if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
      };
    }, [imagePreview]);

    const generateSlug = (val: string) =>
      val.toLowerCase().trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setName(val);
      if (!editId) setSlug(generateSlug(val));
    };

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = () => setIsDragging(false);

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) processFile(e.target.files[0]);
    };

    const processFile = (file: File) => {
      if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
      setSelectedFile(file);
      setImagePreview(URL.createObjectURL(file));
    };

    const handleClearImage = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
      setImagePreview('');
      setSelectedFile(null);
    };

    const triggerFileInput = () => document.getElementById('category-image-input')?.click();

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim()) { alert('Please enter a category name.'); return; }

      setIsSaving(true);

      try {
        const slugVal = slug.trim() || generateSlug(name.trim());

        // Slug uniqueness check — prevent duplicate slugs
        const existingWithSlug = await getCategoryBySlug(slugVal);
        if (existingWithSlug && existingWithSlug.id !== editId) {
          alert(`A category with slug "${slugVal}" already exists. Please choose a different slug.`);
          setIsSaving(false);
          return;
        }

        if (editId) {
          // ── EDIT FLOW ────────────────────────────────────────────
          // Three explicit states — easier to audit than implicit initializer
          let finalImageUrl: string | null = null;

          if (selectedFile) {
            // REPLACE: new file selected — upload, then clean up old
            finalImageUrl = await uploadCategoryImage(selectedFile, editId);
            if (originalImageUrl) deleteCategoryImage(originalImageUrl).catch(() => {});
          } else if (imagePreview.startsWith('http')) {
            // KEEP: existing Supabase URL unchanged
            finalImageUrl = imagePreview;
          } else {
            // REMOVE: image cleared via X button — clean up old storage file
            if (originalImageUrl) deleteCategoryImage(originalImageUrl).catch(() => {});
            // finalImageUrl remains null
          }

          await updateCategory(editId, {
            name: name.trim(),
            slug: slugVal,
            subtitle: subtitle.trim() || null,
            description: description.trim() || null,
            sort_order: sortOrder,
            is_active: active,
            image_url: finalImageUrl,
          });
        } else {
          // ── CREATE FLOW ──────────────────────────────────────────
          const newCategory = await createCategory({
            name: name.trim(),
            slug: slugVal,
            subtitle: subtitle.trim() || null,
            description: description.trim() || null,
            sort_order: sortOrder,
            is_active: active,
            image_url: null,
          });

          if (selectedFile) {
            try {
              const imageUrl = await uploadCategoryImage(selectedFile, newCategory.id);
              await updateCategory(newCategory.id, { image_url: imageUrl });
            } catch (uploadErr) {
              // Rollback: soft-delete created category to avoid orphaned records
              await deleteCategory(newCategory.id).catch(() => {});
              throw uploadErr;
            }
          }
        }

        router.push('/categories');
      } catch (err: unknown) {
        const error = err as { code?: string; message?: string };
        if (error?.code === '23505' || error?.message?.toLowerCase().includes('duplicate')) {
          alert('A category with this slug already exists. Please choose a different slug.');
          return;
        }
        alert('Error saving category. Please try again.');
      } finally {
        setIsSaving(false);
      }
    };

    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-pulse flex flex-col items-center gap-2">
            <span className="font-serif text-lg text-[#B38B5D] tracking-widest uppercase">MEI BRIDAL COUTURE</span>
            <span className="text-xs text-zinc-400 font-inter">Loading Category Details...</span>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-[480px] mx-auto pt-6 pb-16 font-inter animate-fade-in">
        <div className="flex items-center text-[10px] tracking-widest uppercase text-zinc-400 font-bold select-none mb-1.5">
          <Link href="/categories" className="hover:text-zinc-600 transition-colors">
            Categories
          </Link>
          <span className="mx-2 text-[#B38B5D] font-bold">/</span>
          <span className="text-zinc-400">{editId ? 'Edit Category' : 'Add Category'}</span>
        </div>

        <h1 className="font-serif text-[22px] text-zinc-950 font-medium tracking-wide mb-6">
          {editId ? 'Edit Category' : 'Add Category'}
        </h1>

        <div className="bg-white border border-[#E8E0D5] p-8 shadow-xs">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1">
              <label className="block text-[9px] font-bold tracking-widest text-zinc-900 uppercase">
                NAME
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={handleNameChange}
                placeholder="e.g. Bridal Lehengas"
                className="w-full border-b border-[#E8E0D5] py-2 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[9px] font-bold tracking-widest text-zinc-900 uppercase">
                SLUG
              </label>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g. bridal-lehengas"
                className="w-full border-b border-[#E8E0D5] py-2 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors font-sans"
              />
              <p className="text-[10px] text-zinc-400 mt-1 italic font-light">
                Auto-generated. Editable.
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="block text-[9px] font-bold tracking-widest text-zinc-900 uppercase">
                  SUBTITLE
                </label>
                <span className="text-[9px] text-zinc-400 font-medium font-sans">
                  {subtitle.length}/40
                </span>
              </div>
              <input
                type="text"
                maxLength={40}
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="e.g. Timeless Elegance"
                className="w-full border-b border-[#E8E0D5] py-2 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
              />
              <p className="text-[10px] text-zinc-400 mt-1 italic font-light">
                Shown on the homepage category card, e.g. &quot;Bridal Classics&quot;
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-[9px] font-bold tracking-widest text-zinc-900 uppercase">
                DESCRIPTION
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter category description..."
                rows={3}
                className="w-full border border-[#E8E0D5] p-3 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-[9px] font-bold tracking-widest text-zinc-900 uppercase">
                IMAGE
              </label>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={triggerFileInput}
                className={`border border-dashed p-6 text-center cursor-pointer transition-colors duration-200 flex flex-col items-center justify-center min-h-[110px] ${
                  isDragging
                    ? 'border-[#B38B5D] bg-[#FAF8F5]'
                    : 'border-[#E8E0D5] hover:border-[#B38B5D] hover:bg-[#FAF8F5]/10'
                }`}
              >
                <input
                  type="file"
                  id="category-image-input"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Upload className="w-5 h-5 stroke-[1.5] text-zinc-400 mb-1" />
                <p className="text-[12px] text-zinc-500 font-medium">
                  Upload category Image
                </p>
                <p className="text-[10px] text-zinc-400 font-light">
                  or drag and drop
                </p>
              </div>

              {imagePreview && (
                <div className="relative border border-[#E8E0D5] w-[70px] h-[70px] flex items-center justify-center overflow-hidden mt-2">
                  <img
                    src={imagePreview}
                    alt="Uploaded category thumbnail"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={handleClearImage}
                    className="absolute right-0.5 top-0.5 bg-black/60 hover:bg-black text-white rounded-full p-0.5 transition-colors cursor-pointer"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              <label className="text-[9px] font-bold tracking-widest text-zinc-900 uppercase">
                SORT ORDER
              </label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                className="w-[70px] border border-[#E8E0D5] px-3 py-1.5 text-center text-[13px] text-zinc-800 focus:outline-hidden focus:border-[#B38B5D] font-sans"
              />
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2.5 cursor-pointer group select-none">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="w-4 h-4 border border-[#E8E0D5] text-[#B38B5D] focus:ring-[#B38B5D] rounded-none cursor-pointer accent-black"
                />
                <span className="text-[12px] font-medium text-zinc-800 group-hover:text-black transition-colors">
                  Active (visible on storefront)
                </span>
              </label>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={isSaving}
                className="w-full bg-[#1A1A1A] hover:bg-black text-[#FAF8F5] text-[11px] font-bold tracking-widest py-3.5 transition-colors duration-200 rounded-none uppercase cursor-pointer flex items-center justify-center gap-2"
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {editId ? 'SAVE CHANGES' : 'SAVE CATEGORY'}
              </button>
            </div>

            <div className="text-center pt-2">
              <Link
                href="/categories"
                className="text-[11px] font-bold tracking-widest text-zinc-500 hover:text-zinc-800 transition-colors uppercase cursor-pointer"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    );
  }

  export default function AddCategoryPage() {
    return (
      <Suspense>
        <CategoryForm />
      </Suspense>
    );
  }
  ```

- [ ] **Step 2: Verify mockDb import is gone**

  ```bash
  grep -n "mockDb\|addCategory" "app/(app)/categories/add/page.tsx"
  ```

  **Expected:** No output (zero matches). Stop immediately if any match found.

- [ ] **Step 3: Verify service imports are correct**

  ```bash
  grep -n "from '@/services/" "app/(app)/categories/add/page.tsx"
  ```

  **Expected:**
  ```
  6:import { createCategory, updateCategory, getCategoryById, getCategoryBySlug, deleteCategory } from '@/services/categories';
  7:import { uploadCategoryImage, deleteCategoryImage } from '@/services/storage';
  ```

- [ ] **Step 5: Verify no fetch(dataUrl) / readAsDataURL pattern**

  ```bash
  grep -n "fetch(image\|fetch(data\|readAsDataURL" "app/(app)/categories/add/page.tsx"
  ```

  **Expected:** No output. These patterns cause CSP violations. If any match appears, the implementation is wrong — stop and fix.

---

## Task 6: Validation Gates

- [ ] **Step 1: TypeScript strict check**

  ```bash
  npx tsc --noEmit
  ```

  **Expected:** No output (zero errors).

  Common errors and fixes:
  - `Property 'subtitle' does not exist on type 'Category'` → Task 2 types weren't saved correctly
  - `Property 'is_active' does not exist on type 'CategoryUpdate'` → Same
  - `Cannot find module '@/services/categories' or its corresponding type declarations` → Unlikely; check import path

- [ ] **Step 2: ESLint**

  ```bash
  npm run lint
  ```

  **Expected:** 0 errors (warnings about `<img>` tags are pre-existing and acceptable).

  Common errors and fixes:
  - `'getCategoryById' is not exported from '@/services/categories'` → Task 3 wasn't applied
  - `react-hooks/exhaustive-deps` on the `useEffect` → add `editId` and `router` to deps (already included in plan code above)

- [ ] **Step 3: Production build**

  ```bash
  npm run build
  ```

  **Expected output includes:**
  ```
  ✓ Compiled successfully
  ✓ Generating static pages
  ✓ Build completed
  ```

  `/categories/add` will change from `○ (Static)` to `ƒ (Dynamic)` — this is correct because the page now reads URL params.

  If build fails with `useSearchParams() should be wrapped in a suspense boundary` — the `<Suspense>` wrapper in Task 5 Step 1 handles this. Re-verify the exported `AddCategoryPage` wraps `<CategoryForm />` in `<Suspense>`.

- [ ] **Step 4: Production security — no debug artifacts**

  ```bash
  grep -rn "console\.log\|debugger\|TODO" "app/(app)/categories/add/page.tsx" services/categories.ts services/storage.ts
  ```

  **Expected:** No output. Production code must not contain debug artifacts. If matches appear, remove them before committing.

- [ ] **Step 5: Commit**

  ```bash
  git add "app/(app)/categories/add/page.tsx" services/categories.ts services/storage.ts types/database.ts supabase/migrations/011_categories_extended_schema.sql
  git commit -m "fix: wire category CRUD to Supabase; add subtitle/image_url/is_active schema"
  ```

---

## Task 7: E2E Verification — Create Category

Start dev server:
```bash
npm run dev
```

Open Chrome DevTools → Console + Network → Fetch/XHR.

- [ ] **Step 1: Navigate to /categories/add**

- [ ] **Step 2: Fill the form**
  - Name: `Saree`
  - Slug: `saree` (auto-generated, verify it appears)
  - Subtitle: `Timeless Elegance`
  - Description: `Discover our premium saree collection featuring luxurious fabrics, intricate hand embroidery, traditional craftsmanship, and contemporary elegance.`
  - Status: Active (checked)
  - Image: Upload any local JPG/PNG

- [ ] **Step 3: Click SAVE CATEGORY**

  **Expected:**
  - Redirect to `/categories`
  - `Saree` appears in the categories list
  - Network tab shows `POST *.supabase.co/rest/v1/categories` → status 201
  - Network tab shows `POST *.supabase.co/storage/v1/object/category-images/...` → status 200
  - Network tab shows `PATCH *.supabase.co/rest/v1/categories?id=eq.<uuid>` → status 200
  - No red errors in browser console

- [ ] **Step 4: SQL verification — confirm all fields persisted**

  Run in Supabase SQL Editor:
  ```sql
  SELECT id, name, slug, subtitle, description, image_url, sort_order, is_active, deleted_at
  FROM public.categories
  WHERE slug = 'saree' AND deleted_at IS NULL;
  ```

  **Expected row:**
  ```
  name        = Saree
  slug        = saree
  subtitle    = Timeless Elegance
  description = Discover our premium saree collection...
  image_url   = https://... (Supabase storage URL)
  sort_order  = 0
  is_active   = true
  deleted_at  = NULL
  ```

  Stop if any field is NULL that should have a value.

- [ ] **Step 5: Hard refresh persistence**

  Press `Ctrl+Shift+R`. Verify `Saree` still appears in list. This confirms Supabase persistence, not localStorage.

---

## Task 8: E2E Verification — Edit Category

- [ ] **Step 1: Click EDIT on the Saree category**

  **Expected:**
  - URL changes to `/categories/add?edit=<uuid>`
  - Page title shows `Edit Category`
  - Form loads with pre-populated values:
    - Name: `Saree`
    - Slug: `saree`
    - Subtitle: `Timeless Elegance`
    - Description: populated
    - Image thumbnail: visible (Supabase URL image renders)
    - Active: checked

  Stop if form is blank — `getCategoryById` or `useEffect` is not working.

- [ ] **Step 2: Update subtitle to `Handcrafted Heritage` and click SAVE CHANGES**

  **Expected:**
  - Redirect to `/categories`
  - No console errors
  - Network tab shows `PATCH *.supabase.co/rest/v1/categories?id=eq.<uuid>` → status 200

- [ ] **Step 3: SQL verification**

  ```sql
  SELECT subtitle FROM public.categories WHERE slug = 'saree' AND deleted_at IS NULL;
  ```

  **Expected:** `Handcrafted Heritage`

---

## Task 8b: E2E Verification — Image Removal

**Purpose:** Verify that removing a category image (clicking X, saving) sets `image_url = NULL` and deletes the old storage file. The edit flow has a code path for this (`imagePreview === '' && originalImageUrl`) — this task confirms it works.

- [ ] **Step 1: Edit the Saree category (from Task 7 or Task 8) and upload an image if it doesn't already have one**

  Navigate to `/categories/add?edit=<uuid-of-saree>`. Upload any image if `image_url` is currently null.

- [ ] **Step 2: Confirm image exists in Storage before removal**

  In Supabase Dashboard → Storage → `category-images`, verify a file exists under `categories/<uuid>/`.

  Note the full URL for comparison after removal.

- [ ] **Step 3: Click the X button to remove the image and save**

  Click the X on the image preview thumbnail. The preview disappears.

  Click **SAVE CHANGES**.

  **Expected:**
  - Redirect to `/categories`
  - Category row no longer shows image
  - Network tab shows `PATCH .../rest/v1/categories?id=eq.<uuid>` → 200

- [ ] **Step 4: SQL verification — image_url is NULL**

  ```sql
  SELECT image_url FROM public.categories WHERE id = '<uuid-of-saree>';
  ```

  **Expected:** `NULL`

- [ ] **Step 5: Storage verification — old file is deleted**

  In Supabase Dashboard → Storage → `category-images`, navigate to `categories/<uuid>/`.

  **Expected:** The previously uploaded file is gone. No orphaned files remain.

  If the file still exists → `deleteCategoryImage` is not being called on removal. Check the `else if (imagePreview === '' && originalImageUrl)` branch in the edit flow.

---

## Task 9: E2E Verification — Delete Category

- [ ] **Step 1: Click DELETE on the Saree category, confirm the dialog**

  **Expected:**
  - Category disappears from the list
  - No console errors

- [ ] **Step 2: SQL verification — confirm soft delete**

  ```sql
  SELECT id, name, deleted_at FROM public.categories WHERE slug = 'saree';
  ```

  **Expected:** `deleted_at` is NOT NULL (soft delete). Row exists but is hidden from list.

---

## Task 9b: Slug Reuse and Race Condition Verification

- [ ] **Step 1: Verify soft-delete allows slug reuse**

  This verifies the partial unique index (`WHERE deleted_at IS NULL`) works correctly.

  1. Create category: Name `Slug Test`, Slug `slug-test`
  2. Delete it (confirm soft-deleted in SQL: `deleted_at IS NOT NULL`)
  3. Create a NEW category with the same slug: Name `Slug Test 2`, Slug `slug-test`

  **Expected:** Second create succeeds. The slug is available again because the first category is soft-deleted.

  If the second create fails with a slug conflict, the unique index needs to be partial (`WHERE deleted_at IS NULL`) — verify the migration was applied correctly.

- [ ] **Step 2: Verify duplicate slug is blocked at form level**

  1. Create category with Slug `duplicate-test`
  2. Without deleting it, try to create another category with Slug `duplicate-test`

  **Expected:** Alert appears: `A category with slug "duplicate-test" already exists.` Form does NOT submit.

  Clean up both test categories after verification.

---

## Task 10: E2E Verification — Product Integration

- [ ] **Step 1: Create a new test category**

  Navigate to `/categories/add`, create a category named `Test Integration`, slug `test-integration`, Active.

- [ ] **Step 2: Verify category appears in Product Create dropdown**

  Navigate to `/products/add`. Open the Category dropdown.

  **Expected:** `Test Integration` appears in the list alongside existing categories.

- [ ] **Step 3: Hard refresh and verify persistence**

  Press `Ctrl+Shift+R` on the products add page. Re-open the Category dropdown.

  **Expected:** `Test Integration` still appears. This confirms `getCategories()` is reading from Supabase, not localStorage.

- [ ] **Step 4: Clean up test category**

  Delete `Test Integration` from `/categories`. Confirm it disappears from the product dropdown on next navigation.

---

## Task 11: Production Smoke Test

**Run this task after Task 6 (build) passes and after E2E (Tasks 7–10) passes. A passing build does not guarantee runtime correctness in production mode.**

- [ ] **Step 1: Start production server**

  ```bash
  npm run start
  ```

  **Expected:**
  ```
  ▲ Next.js 16.x.x
  - Local: http://localhost:3000
  ✓ Ready
  ```

  If the server crashes on startup, read the error before continuing.

- [ ] **Step 2: Verify categories pages in production mode**

  Open `http://localhost:3000/categories`.

  **Expected:**
  - Category list renders
  - No hydration warnings in browser console
  - No runtime errors in terminal

  Open `http://localhost:3000/categories/add`.

  **Expected:**
  - Empty form renders (no edit mode without `?edit=` param)
  - No hydration warnings
  - No runtime errors

- [ ] **Step 3: Verify categories edit in production mode**

  Navigate to `http://localhost:3000/categories/add?edit=<uuid-of-existing-category>` (use any UUID from the categories list).

  **Expected:**
  - Form loads with pre-populated data
  - Title shows `Edit Category`
  - No hydration warnings
  - No runtime errors

- [ ] **Step 4: Verify products pages in production mode**

  Open `http://localhost:3000/products/add`.

  **Expected:**
  - Form renders, category dropdown populates from Supabase
  - No hydration warnings
  - No runtime errors

- [ ] **Step 5: Stop production server**

  Press `Ctrl+C`. Switch back to dev server for remaining regression testing.

---

## Task 12: Regression Verification

- [ ] `/categories` — List loads, no console errors
- [ ] `/categories/add` — Empty form loads correctly
- [ ] `/products` — Products list loads, no console errors
- [ ] `/products/add` — Product create form loads, category dropdown populates from Supabase
- [ ] `/products/edit/<uuid>` — Edit form loads with correct data
- [ ] `/orders` — Loads without errors
- [ ] `/enquiries` — Loads without errors
- [ ] `/banners` — Loads without `deleted_at` error (migration 010 applied)
- [ ] `/settings` — Loads without errors

Provide evidence (pass/fail) for each page. Do not mark any as passed based on assumption.

---

## Rollback Plan

Document this before merging. If the deployment causes issues, execute these steps in order.

**Step 1: Revert the commit**
```bash
git log --oneline -5
git revert <commit-sha>
```

**Step 2: Confirm revert restores mockDb import**
```bash
grep -n "mockDb\|addCategory" "app/(app)/categories/add/page.tsx"
```
Expected: `import { addCategory } from '@/lib/mockDb'` returns (pre-fix behavior restored).

**Step 3: If category-images bucket was created and is causing issues**
Disable in Supabase Dashboard → Storage → category-images → Settings → disable public access or delete bucket. Note: deleting the bucket will delete all uploaded category images.

**Step 4: If migration 011 caused schema issues**
The `ALTER TABLE ADD COLUMN IF NOT EXISTS` is non-destructive. Columns can be dropped if needed:
```sql
ALTER TABLE public.categories
  DROP COLUMN IF EXISTS subtitle,
  DROP COLUMN IF EXISTS image_url,
  DROP COLUMN IF EXISTS is_active;
```
Only execute if there is an active schema conflict. Dropping `image_url` will destroy any already-uploaded image URL data.

To also remove the slug unique index:
```sql
DROP INDEX IF EXISTS categories_slug_active_unique;
```

To remove the storage bucket (destroys all uploaded category images — only if reverting storage entirely):
```sql
DELETE FROM storage.buckets WHERE id = 'category-images';
```
Note: deleting the bucket does NOT automatically delete the storage objects inside it. Delete objects first via Supabase Dashboard → Storage → category-images if needed.

**Step 5: Verify application health after rollback**
```bash
npm run dev
```
Navigate to `/categories`, `/categories/add`, `/products`. Confirm pages load and no new console errors.

---

## Stop Conditions

| # | Condition | Action |
|---|---|---|
| 1 | Task 2 `npx tsc` shows `Property 'subtitle' does not exist on type 'Category'` | types/database.ts not saved correctly — re-apply Task 2 |
| 2 | Task 5 grep shows `mockDb` still in add/page.tsx | File write failed — rewrite file |
| 3 | Task 6 lint shows `getCategoryById is not exported` | Task 3 not applied — check services/categories.ts |
| 4 | Task 6 build fails with `useSearchParams() should be wrapped in suspense` | `<Suspense>` wrapper missing — verify AddCategoryPage export |
| 5 | Task 7 network shows NO request to `*.supabase.co` | Form still using mockDb — grep for addCategory in page |
| 6 | Task 7 SQL shows `image_url IS NULL` after image upload | category-images bucket missing or RLS blocks upload |
| 7 | Task 8 edit form is blank | getCategoryById returning null — check UUID in URL |
| 8 | Task 8 SQL shows subtitle not updated | updateCategory not receiving is_active/subtitle — check TypeScript types |
| 9 | Task 9 SQL shows `deleted_at IS NULL` after delete | Delete still using old code path — verify hooks/use-categories.ts imports |

---

## Success Criteria

Do not mark complete until every item is ticked. Evidence required for each — assumption is not evidence.

### Phase 0 — Pre-Execution Evidence
- [ ] DB schema verified via SQL — actual column list documented
- [ ] Storage buckets verified via SQL — actual bucket list documented
- [ ] Service exports verified via grep — no pre-existing duplicates confirmed

### Phase 1 — Schema
- [ ] Migration 011 applied — `subtitle`, `image_url`, `is_active` columns confirmed present via SQL
- [ ] Slug unique partial index `categories_slug_active_unique` confirmed present via `pg_indexes` query
- [ ] `category-images` bucket confirmed present via SQL (`storage.buckets` query), `public = true` documented
- [ ] All four storage policies confirmed — INSERT, UPDATE, DELETE, SELECT (DELETE is new; required for `deleteCategoryImage`)
- [ ] TypeScript types match DB schema — `npx tsc --noEmit` = 0 errors

### Phase 2 — Code
- [ ] `add/page.tsx` has zero mockDb imports (grep confirmed)
- [ ] `getCategoryById` exported from services/categories.ts (grep confirmed, no duplicates)
- [ ] `uploadCategoryImage` exported from services/storage.ts (grep confirmed, no duplicates)
- [ ] No duplicate service functions anywhere

### Phase 3 — Validation Gates
- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `npm run lint` = 0 errors (pre-existing warnings acceptable)
- [ ] `npm run build` succeeds

### Phase 4 — E2E Runtime Evidence
- [ ] Root cause identified and documented with file:line evidence
- [ ] No `fetch(dataUrl)` pattern in final code (grep confirmed — no CSP violations)
- [ ] No debug artifacts — `console.log`, `debugger`, `TODO` absent from changed files
- [ ] Slug uniqueness enforced — duplicate slug attempt blocked at UI level
- [ ] Slug unique index enforced at DB level — race condition protection confirmed
- [ ] Soft delete + slug reuse works — create, delete, recreate same slug succeeds (Task 9b)
- [ ] `createCategory` returns full row with `id` — upload flow confirmed safe (Task 0 Step 3)
- [ ] `updateCategory` passes all fields through — no whitelist confirmed (Task 0 Step 4)
- [ ] Query cache refresh works — new category appears in list after redirect without hard refresh
- [ ] Create works — Supabase row confirmed via SQL, all fields populated
- [ ] Read works — edit form pre-populates from Supabase (not blank)
- [ ] Update works — subtitle change confirmed in SQL after save
- [ ] Delete works — `deleted_at` IS NOT NULL confirmed via SQL
- [ ] Image upload works — `image_url` confirmed in SQL, file in Storage bucket
- [ ] Image replacement — old storage file confirmed deleted after replacing image (requires DELETE policy)
- [ ] Image removal — `image_url` set to NULL and old storage file deleted when X button used (Task 8b)
- [ ] Upload failure rollback — orphaned records do NOT exist if image upload is interrupted
- [ ] Duplicate slug race condition — two simultaneous submissions: one succeeds, one receives user-friendly error (23505 handled)
- [ ] Data survives hard refresh — Ctrl+Shift+R shows Supabase data
- [ ] Data survives browser close and re-login — confirmed from fresh session
- [ ] Product integration works — new category appears in `/products/add` dropdown after refresh
- [ ] Rollback plan documented

### Phase 5 — Production Smoke Test
- [ ] `npm run start` serves without crash
- [ ] `/categories` loads clean in production mode
- [ ] `/categories/add` loads clean in production mode
- [ ] `/categories/add?edit=<uuid>` loads pre-populated in production mode
- [ ] `/products/add` loads clean, category dropdown works in production mode
- [ ] No hydration warnings in any page

### Phase 6 — Regression
- [ ] All 9 pages in Task 12 pass — evidence provided for each
- [ ] No UI changes introduced (layout, Tailwind classes, component hierarchy unchanged)
- [ ] No functionality broken in products, orders, enquiries, banners, settings

If any verification cannot be completed: **STOP** and document exactly what remains unverified. Do not assume success.
- [ ] No products/orders/enquiries/banners/settings functionality broken

---

## Final Report Template

```
ROOT CAUSE:
  app/(app)/categories/add/page.tsx imported addCategory from lib/mockDb.ts
  (localStorage). No edit mode existed. DB missing subtitle/image_url/is_active columns.

FILES CHANGED (5 total):
  supabase/migrations/011_categories_extended_schema.sql — 3 columns + category-images bucket
  types/database.ts — categories Row/Insert/Update updated
  services/categories.ts — getCategoryById added
  services/storage.ts — uploadCategoryImage added
  app/(app)/categories/add/page.tsx — wired to Supabase, edit mode added

SERVICES REUSED:
  createCategory, updateCategory from services/categories.ts
  uploadCategoryImage from services/storage.ts (new export, not duplicate)

SQL EVIDENCE:
  SELECT * FROM categories WHERE slug='saree':
  ✓ name = Saree
  ✓ subtitle = Timeless Elegance
  ✓ description = [populated]
  ✓ image_url = https://...supabase.co/storage/...
  ✓ is_active = true

CRUD RESULTS:
  ✓ Create — Supabase row confirmed
  ✓ Edit — subtitle update confirmed in SQL
  ✓ Delete — deleted_at NOT NULL confirmed
  ✓ Image upload — Storage file confirmed, image_url populated

PRODUCT INTEGRATION:
  ✓ New categories appear in /products/add dropdown
  ✓ Persists after hard refresh

TYPESCRIPT: 0 errors
LINT: 0 errors
BUILD: succeeded

REMAINING RISKS:
  - lib/mockDb.ts still used by Orders, Enquiries, Settings, Banners write paths
    (out of scope for this fix)
```

---

## Self-Review

**Spec coverage:**
- Create Category → Task 7 ✓
- Read Category → Task 3 (getCategoryById) + Task 8 (edit load) ✓
- Edit Category → Task 5 (edit mode in page) + Task 8 (E2E) ✓
- Delete Category → Task 9 (existing service confirmed working) ✓
- Category Image Upload → Task 4 (uploadCategoryImage) + Task 5 (form wiring) ✓
- Category Persistence → Task 7 Step 5 (hard refresh) ✓
- Category Retrieval → Task 3 (getCategoryById) + Task 7 Step 4 (SQL) ✓
- Category Dropdown Integration → Task 10 ✓
- Data Loading after Refresh → Task 7 Step 5 + Task 10 Step 3 ✓
- Data Loading in Edit Screen → Task 8 Step 1 ✓
- DB Verification gate → Task 0 Step 1 (schema SQL) ✓
- Storage Verification gate → Task 0 Step 2 (buckets SQL) ✓
- Service Reuse gate → Task 0 Steps 3–4 (grep exports) ✓
- TypeScript/Lint/Build → Task 6 ✓
- E2E Create (exact spec data) → Task 7 Step 2 ✓
- E2E Edit subtitle change → Task 8 ✓
- E2E Delete verification → Task 9 ✓
- Product Integration Test → Task 10 ✓
- SQL evidence for slug='saree' → Task 7 Step 4 ✓
- Production smoke test → Task 11 ✓
- No regressions → Task 12 ✓
- Investigation-first requirement → Task 0 (pre-execution gates before any code) ✓
- Minimal-diff justification → Implementation Safety Requirements section ✓
- No fetch(dataUrl) → Task 5 uses `URL.createObjectURL` + `selectedFile` (File object) ✓
- Slug uniqueness → `getCategoryBySlug` added to Task 3, check in Task 5 handleSubmit ✓
- Transaction safety (rollback on upload failure) → Task 5 create flow try/catch + deleteCategory ✓
- Image replacement cleanup → `deleteCategoryImage` added to Task 4, called in Task 5 edit flow ✓
- Rollback plan → Rollback Plan section before Stop Conditions ✓
- Hard Requirement 7 (type system) → Task 2 + Task 6 tsc gate ✓
- Hard Requirement 10 (browser restart persistence) → Task 12 Phase 4 checklist ✓
- SR Finding 2 (createCategory return shape) → Task 0 Step 3 verification ✓
- SR Finding 3 (updateCategory field handling) → Task 0 Step 4 verification ✓
- SR Finding 5 (DELETE storage policy) → Migration 011 DO block + Task 1 Step 6 verification ✓
- SR Finding 7 (race condition / slug unique index) → Migration 011 partial index + Task 9b Step 2 ✓
- SR Finding 8 (soft-delete slug reuse) → Task 9b Step 1 ✓
- SR Finding 9 (query cache refresh) → Task 0 Step 7 documents router.push behavior ✓
- SR Finding 10 (production security grep) → Task 6 Step 4 ✓
- Bucket public access decision → documented in migration comment: public = true for storefront display ✓
- Final hardening: 23505 race condition catch → Task 5 outer catch block ✓
- Final hardening: image removal cleanup (X button) → edit flow `else if (imagePreview === '' && originalImageUrl)` ✓
- Final hardening: image removal E2E → Task 8b ✓
- Final hardening: rollback index cleanup → `DROP INDEX IF EXISTS categories_slug_active_unique` in Rollback Plan ✓
- Final hardening: rollback bucket cleanup → `DELETE FROM storage.buckets` documented with caveat in Rollback Plan ✓
- CR: console.error removed → loadCategory uses `alert + router.push`, handleSubmit catch removes debug line ✓
- CR: edit-flow image handling → three explicit states (REPLACE / KEEP / REMOVE) ✓
- CR: is_admin() existence check → Task 0 Step 2 SQL query ✓
- CR: getCategoryBySlug return type → `{ id: string; slug: string } | null` (not `Category | null`) ✓
- CR: is_active NULL check → Task 1 Step 8 + UPDATE remediation ✓
- Final addendum: duplicate active slug pre-check → Task 0 Step 2 (with remediation SQL) ✓
- Final addendum: category count baseline → Task 0 Step 2a (pre-migration) + Task 1 Step 3b (post-migration) ✓

**Placeholder scan:** All steps contain exact SQL, exact code, exact commands, exact expected output. ✓

**Type consistency:**
- `getCategoryById` returns `Promise<Category | null>` (Task 3) → consumed in `loadCategory()` as `cat.subtitle`, `cat.image_url`, `cat.is_active` (Task 5) — all fields are in updated `Category` Row type (Task 2) ✓
- `updateCategory(editId, { is_active: boolean, image_url: string | null })` — both in `CategoryUpdate` type (Task 2) ✓
- `uploadCategoryImage(file: File, categoryId: string)` (Task 4) → called in Task 5 with `(file, editId)` and `(file, newCategory.id)` — types match ✓
