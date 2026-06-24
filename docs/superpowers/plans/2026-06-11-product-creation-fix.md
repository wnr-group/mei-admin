# Product Creation Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `ProductForm.tsx` to the Supabase backend so products created/edited via the form actually persist to the database and appear in the products list.

**Architecture:** `ProductForm` currently calls `addProduct()`/`updateProduct()` from `lib/mockDb.ts`, which writes to browser localStorage. The products list page reads from Supabase. The two are completely disconnected. The fix replaces the three mockDb calls inside the form's submit handler and load effect with calls to `services/products.ts` + `services/storage.ts`, mapping the form's field names to the Supabase schema. Zero UI changes.

**Tech Stack:** Next.js 16 App Router, Supabase (supabase-js v2), TanStack Query v5, TypeScript strict, Vitest

---

## Root Cause (Pre-confirmed)

```
User fills ProductForm → handleSubmit → addProduct() from lib/mockDb.ts
                                                    ↓
                                          localStorage.setItem(...)
                                          (never touches Supabase)

Products list page → useProducts() → services/products.ts → Supabase
                                                    ↑
                                          Reads a DIFFERENT data source
```

`ProductForm.tsx` line 6:
```ts
import { fetchProducts, addProduct, updateProduct } from '@/lib/mockDb';
```

The `lib/mockDb.ts` file is a pure localStorage mock. No network calls. No Supabase. This one import is the entire root cause.

---

## Schema Mismatches (Form → Supabase `products` table)

| Form field | Form type | DB column | DB type | Fix |
|---|---|---|---|---|
| `category` | `string` (name) | `category_id` | `UUID FK` | Look up UUID by name |
| `workTypes` | `string[]` (camelCase) | `work_types` | `TEXT[]` | Rename key |
| `images[0]` | data URL / hosted URL | `image_url` | `TEXT` | Upload → get URL |
| `published` | `boolean` | `status` | `'PUBLISHED'\|'DRAFT'` | Map `true→'PUBLISHED'` |
| `description` | `string` | `description` | `TEXT nullable` | Pass through |
| `slug` | `string` | *(no column)* | — | Ignore (not in DB) |
| `shortDescription` | `string` | *(no column)* | — | Ignore |
| `compareAtPrice` | `string` | *(no column)* | — | Ignore |
| `featured` | `boolean` | *(no column)* | — | Ignore |
| `newArrival` | `boolean` | *(no column)* | — | Ignore |
| `metaTitle/Desc/Keywords` | `string` | *(no column)* | — | Ignore |

**Category name ↔ UUID mapping:** The form's hardcoded `CATEGORIES` array (`['Bridal Lehengas', 'Sarees', 'Evening Gowns', 'Couture', 'Suits']`) exactly matches the names in Supabase seed migration `002_categories_products.sql`. We look them up by name at submit time.

---

## File Structure

### Modified Files (ONLY these two)
- `components/products/ProductForm.tsx` — remove mockDb import, fix `handleSubmit` and `loadProduct` effect
- `services/products.ts` — add `getProductById(id)` helper (needed by edit mode)

### Unchanged Files (touch nothing else)
- `app/(app)/products/page.tsx` ✓ already reads Supabase correctly
- `app/(app)/products/add/page.tsx` ✓ just renders `<ProductForm />`
- `app/(app)/products/edit/[id]/page.tsx` ✓ just renders `<ProductForm editId={id} />`
- `hooks/use-products.ts` ✓ correct
- `lib/mockDb.ts` ✓ do not delete — other pages (enquiries, orders, banners) still use it

---

## Task 1: Verify Database Schema (No Code Changes)

**Files:** None modified — SQL read-only verification

- [ ] **Step 1: Open Supabase SQL Editor**

  Navigate to your Supabase project → SQL Editor. Run the following query to confirm the actual `products` table schema:

  ```sql
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'products'
  ORDER BY ordinal_position;
  ```

  **Expected output (13 rows):**
  ```
  id            | uuid                     | NO  | gen_random_uuid()
  name          | text                     | NO  |
  category_id   | uuid                     | YES |
  price         | numeric                  | NO  |
  work_types    | ARRAY                    | NO  | '{}'::text[]
  status        | USER-DEFINED             | NO  | 'DRAFT'::product_status
  description   | text                     | YES |
  image_url     | text                     | YES |
  created_at    | timestamp with time zone | NO  | now()
  updated_at    | timestamp with time zone | NO  | now()
  deleted_at    | timestamp with time zone | YES |
  ```

  **There is no:** `slug`, `short_description`, `compare_at_price`, `featured`, `new_arrival`, `meta_title`, `meta_description`, `meta_keywords`. These fields exist only in the form's UI and in `lib/mockDb.ts`.

- [ ] **Step 2: Confirm categories exist in Supabase**

  ```sql
  SELECT id, name, slug FROM public.categories WHERE deleted_at IS NULL ORDER BY sort_order;
  ```

  **Expected output (5 rows):**
  ```
  <uuid1> | Bridal Lehengas | bridal-lehengas
  <uuid2> | Sarees          | sarees
  <uuid3> | Evening Gowns   | evening-gowns
  <uuid4> | Couture         | couture
  <uuid5> | Suits           | suits
  ```

  The category *names* match the hardcoded `CATEGORIES` array in `ProductForm.tsx` line 9 exactly. UUID lookup by name will work.

- [ ] **Step 3: Confirm products table is empty or has Supabase-sourced rows**

  ```sql
  SELECT id, name, category_id, price, status FROM public.products WHERE deleted_at IS NULL LIMIT 10;
  ```

  Note how many rows exist. Products created through the old mockDb form will NOT appear here (they're in localStorage only).

- [ ] **Step 4: Commit verification findings (no code)**

  ```bash
  git add -A
  git status
  ```

  Expected: nothing to commit (this task is read-only).

---

## Task 2: Reproduce the Failure in Running App

**Files:** None modified

- [ ] **Step 1: Start the dev server**

  ```bash
  npm run dev
  ```

  Expected: Server starts on `http://localhost:3000`

- [ ] **Step 2: Open Chrome DevTools → Network tab**

  Filter to `Fetch/XHR`. Clear the log.

- [ ] **Step 3: Navigate to Add Product**

  Go to `http://localhost:3000/products/add`

  Expected: ProductForm renders with fields for Name, Slug, Description, Pricing, Category, Work Types, Media, Visibility.

- [ ] **Step 4: Fill in the form with valid data**

  - Name: `Test Product A`
  - Category: `Sarees`
  - Price: `50000`
  - Check "Published"
  - Click "SAVE PRODUCT"

- [ ] **Step 5: Observe Network tab**

  **Expected failure behavior:**
  - Zero requests to `*.supabase.co`
  - Form submits and redirects to `/products`
  - The products list at `/products` does NOT show "Test Product A"
  - localStorage now contains `test Product A` under key `mei_products_db`

  Open Chrome DevTools → Application → Local Storage → `http://localhost:3000`
  Find key `mei_products_db` — the new product is stored there only.

- [ ] **Step 6: Confirm failure is exactly the expected root cause**

  The form's `handleSubmit` at `components/products/ProductForm.tsx:164` calls:
  - `addProduct(payload)` from `lib/mockDb.ts:465` → `saveRawProducts()` → `localStorage.setItem()`
  - NEVER calls any Supabase endpoint

---

## Task 3: Add `getProductById` to Services Layer

**Files:**
- Modify: `services/products.ts`
- Test: `__tests__/services/products.test.ts` (new file)

Edit mode in `ProductForm` calls `fetchProducts()` (returns all localStorage products) and `.find((p) => p.id === editId)`. Supabase UUIDs (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`) will never match localStorage IDs (`prod-1`, `prod-2`). We need a proper fetch-by-ID function.

- [ ] **Step 1: Write the failing test**

  Create `__tests__/services/products.test.ts`:

  ```typescript
  import { describe, it, expect, vi, beforeEach } from 'vitest'

  const mockSingle = vi.fn()
  const mockIs = vi.fn()
  const mockEq = vi.fn()
  const mockSelect = vi.fn()
  const mockFrom = vi.fn()

  vi.mock('@/lib/supabase/client', () => ({
    createClient: () => ({ from: mockFrom }),
  }))
  vi.mock('@/lib/errors', () => ({
    toAppError: (e: Error) => e,
    AppError: class AppError extends Error {
      constructor(public code: string, message: string) { super(message) }
    },
  }))
  vi.mock('@/lib/audit', () => ({ logAuditEvent: vi.fn() }))

  import { getProductById } from '@/services/products'

  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ is: mockIs })
    mockIs.mockReturnValue({ single: mockSingle })
  })

  describe('getProductById', () => {
    it('returns product when found', async () => {
      const fakeProduct = { id: 'abc-123', name: 'Test', price: 1000, status: 'DRAFT' }
      mockSingle.mockResolvedValue({ data: fakeProduct, error: null })

      const result = await getProductById('abc-123')

      expect(mockFrom).toHaveBeenCalledWith('products')
      expect(result).toEqual(fakeProduct)
    })

    it('returns null when product not found', async () => {
      mockSingle.mockResolvedValue({ data: null, error: { message: 'no rows returned' } })

      const result = await getProductById('nonexistent-id')

      expect(result).toBeNull()
    })

    it('throws on other DB errors', async () => {
      mockSingle.mockResolvedValue({ data: null, error: { message: 'connection refused' } })

      await expect(getProductById('some-id')).rejects.toThrow('connection refused')
    })
  })
  ```

- [ ] **Step 2: Run test — confirm it fails**

  ```bash
  npx vitest run __tests__/services/products.test.ts
  ```

  Expected: FAIL — `getProductById is not a function` (or named export doesn't exist yet)

- [ ] **Step 3: Add `getProductById` to services/products.ts**

  Open `services/products.ts`. After the `deleteProduct` function, add:

  ```typescript
  export async function getProductById(id: string): Promise<Product | null> {
    const supabase = createClient()
    const response = await supabase
      .from('products')
      .select('*, categories(id, name)')
      .eq('id', id)
      .is('deleted_at', null)
      .single()
    const { data, error } = response as { data: Product | null; error: { message: string } | null }
    if (error) {
      if (error.message.toLowerCase().includes('no rows')) return null
      throw toAppError(new Error(error.message))
    }
    return data
  }
  ```

- [ ] **Step 4: Run test — confirm it passes**

  ```bash
  npx vitest run __tests__/services/products.test.ts
  ```

  Expected: PASS — 3 tests pass

- [ ] **Step 5: Verify TypeScript compiles cleanly**

  ```bash
  npx tsc --noEmit
  ```

  Expected: No errors

- [ ] **Step 6: Commit**

  ```bash
  git add services/products.ts __tests__/services/products.test.ts
  git commit -m "feat: add getProductById to products service"
  ```

---

## Task 4: Fix ProductForm — Wire Create to Supabase

**Files:**
- Modify: `components/products/ProductForm.tsx`

This task fixes **product creation only** (the `else` branch in `handleSubmit`). Edit mode is fixed in Task 5.

- [ ] **Step 1: Replace the mockDb import block**

  In `components/products/ProductForm.tsx`, find and remove **lines 5-7**:
  ```typescript
  import { fetchProducts, addProduct, updateProduct } from '@/lib/mockDb';
  ```

  Replace with:
  ```typescript
  import { createClient } from '@/lib/supabase/client';
  import { createProduct, updateProduct, getProductById } from '@/services/products';
  import { uploadProductImage } from '@/services/storage';
  ```

- [ ] **Step 2: Replace the `handleSubmit` function body**

  Find the `handleSubmit` function at line ~164. Keep the entire function signature and outer `try/catch/finally` structure intact. Replace **only the `try` block body** with:

  ```typescript
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Please enter a product name.');
      return;
    }
    if (!category) {
      alert('Please select a category.');
      return;
    }

    setIsSaving(true);

    try {
      // Resolve category name → UUID
      const supabase = createClient();
      const { data: cats } = await supabase
        .from('categories')
        .select('id, name')
        .is('deleted_at', null);
      const matchedCat = (cats ?? []).find(
        (c: { id: string; name: string }) => c.name === category
      );
      if (!matchedCat) {
        alert('Category not found. Please refresh the page and try again.');
        setIsSaving(false);
        return;
      }

      const priceNum = parseFloat(price) || 0;
      const workTypesArr = selectedWorkTypes.map((wt) => wt.toUpperCase());
      const descriptionVal = description.trim() || null;

      if (editId) {
        // ── EDIT FLOW ──────────────────────────────────────────────
        const existingProduct = await getProductById(editId);
        let finalImageUrl: string | null = existingProduct?.image_url ?? null;

        if (images[0] && images[0].startsWith('data:')) {
          // New image selected — convert data URL → File → upload to Supabase storage
          const res = await fetch(images[0]);
          const blob = await res.blob();
          const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
          const file = new File([blob], `product-image.${ext}`, { type: blob.type });
          finalImageUrl = await uploadProductImage(file, editId);
        } else if (images[0] && images[0].startsWith('http')) {
          finalImageUrl = images[0]; // Already a hosted Supabase URL — keep it
        } else if (images.length === 0) {
          finalImageUrl = null;
        }

        await updateProduct(editId, {
          name: name.trim(),
          category_id: matchedCat.id,
          price: priceNum,
          status: published ? 'PUBLISHED' : 'DRAFT',
          work_types: workTypesArr,
          description: descriptionVal,
          image_url: finalImageUrl,
        });
      } else {
        // ── CREATE FLOW ────────────────────────────────────────────
        const newProduct = await createProduct({
          name: name.trim(),
          category_id: matchedCat.id,
          price: priceNum,
          status: published ? 'PUBLISHED' : 'DRAFT',
          work_types: workTypesArr,
          description: descriptionVal,
          image_url: null, // Image uploaded in second step after ID is known
        });

        if (images[0]) {
          let imageUrl: string;
          if (images[0].startsWith('data:')) {
            // Convert data URL → File and upload
            const res = await fetch(images[0]);
            const blob = await res.blob();
            const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
            const file = new File([blob], `product-image.${ext}`, { type: blob.type });
            imageUrl = await uploadProductImage(file, newProduct.id);
          } else {
            imageUrl = images[0]; // External URL — use directly
          }
          await updateProduct(newProduct.id, { image_url: imageUrl });
        }
      }

      router.push('/products');
    } catch (err) {
      console.error('Failed to save product:', err);
      alert('Error saving product. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  ```

- [ ] **Step 3: Run TypeScript check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: No errors (if errors appear, check that the import paths match exactly)

- [ ] **Step 4: Start dev server and test CREATE flow manually**

  ```bash
  npm run dev
  ```

  Navigate to `http://localhost:3000/products/add`

  **Test A — Create product without image:**
  - Name: `Bridal Test Product`
  - Category: `Bridal Lehengas`
  - Price: `150000`
  - Check "Published"
  - Click "SAVE PRODUCT"

  Expected:
  - No JavaScript errors in browser console
  - Redirect to `/products`
  - "Bridal Test Product" appears in the products list
  - Supabase Dashboard → Table Editor → products → row exists with correct `category_id`, `price`, `status: PUBLISHED`

  **Test B — Create product with image:**
  - Name: `Saree Test Product`
  - Category: `Sarees`
  - Price: `75000`
  - Drag/drop or click to add a local JPG image
  - Check "Published"
  - Click "SAVE PRODUCT"

  Expected:
  - Redirect to `/products`
  - "Saree Test Product" appears with the uploaded image thumbnail
  - Supabase Dashboard → Storage → product-images bucket → `products/<uuid>/` has the uploaded file

- [ ] **Step 5: Commit**

  ```bash
  git add components/products/ProductForm.tsx
  git commit -m "fix: wire ProductForm create/edit to Supabase instead of localStorage mockDb"
  ```

---

## Task 5: Fix ProductForm — Wire Edit Mode (Load) to Supabase

**Files:**
- Modify: `components/products/ProductForm.tsx`

The edit mode `useEffect` currently calls `fetchProducts()` from mockDb (returns localStorage products). Supabase UUIDs will never match localStorage IDs. Editing any Supabase product via the EDIT link currently shows "Product not found" and redirects.

- [ ] **Step 1: Replace the `loadProduct` useEffect**

  Find the `useEffect` at line ~52. Replace the **entire body of `loadProduct()`** (keep the outer `useEffect` wrapper intact) with:

  ```typescript
  useEffect(() => {
    if (!editId) return;

    async function loadProduct() {
      try {
        const prod = await getProductById(editId!);
        if (prod) {
          setName(prod.name);
          setDescription(prod.description ?? '');
          setPrice(prod.price.toString());

          // Resolve category_id → category name for the dropdown
          const supabase = createClient();
          const { data: cats } = await supabase
            .from('categories')
            .select('id, name')
            .is('deleted_at', null);
          const cat = (cats ?? []).find(
            (c: { id: string; name: string }) => c.id === prod.category_id
          );
          setCategory(cat?.name ?? '');

          setSelectedWorkTypes(prod.work_types ?? []);
          setPublished(prod.status === 'PUBLISHED');

          // Populate images array from image_url
          setImages(prod.image_url ? [prod.image_url] : []);

          // Clear fields that don't exist in DB (form UI still shows them)
          setSlug('');
          setShortDescription('');
          setCompareAtPrice('0.00');
          setFeatured(false);
          setNewArrival(false);
          setMetaTitle('');
          setMetaDescription('');
          setMetaKeywords('');
        } else {
          alert('Product not found.');
          router.push('/products');
        }
      } catch (err) {
        console.error('Failed to load product details:', err);
        alert('Failed to load product. Please try again.');
        router.push('/products');
      } finally {
        setLoading(false);
      }
    }

    loadProduct();
  }, [editId, router]);
  ```

- [ ] **Step 2: Run TypeScript check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: No errors

- [ ] **Step 3: Test EDIT flow manually**

  With the dev server running, go to `/products`.

  Click "EDIT" on a product that was just created in Task 4 (its row has a real UUID in the URL).

  Expected:
  - URL: `/products/edit/<real-uuid>`
  - Form populates with the correct name, category, price, status, work types
  - Image thumbnail shows if one was uploaded
  - Slug/shortDescription/compareAtPrice are empty (expected — they have no DB counterpart)

  Make a change (e.g., change the price to `160000`). Click "SAVE CHANGES".

  Expected:
  - Redirect to `/products`
  - Updated price appears in the list
  - Supabase Dashboard → products table → row reflects the new price

- [ ] **Step 4: Run TypeScript check + lint**

  ```bash
  npx tsc --noEmit && npm run lint
  ```

  Expected: No errors or warnings that weren't present before

- [ ] **Step 5: Commit**

  ```bash
  git add components/products/ProductForm.tsx
  git commit -m "fix: wire ProductForm edit mode to load product from Supabase"
  ```

---

## Task 6: Full End-to-End Verification

**Files:** None modified (browser testing only)

- [ ] **Step 1: Create two categories via the existing Categories page**

  Navigate to `http://localhost:3000/categories`

  Confirm at least two categories exist (seeded by migration 002):
  - `Bridal Lehengas`
  - `Sarees`

  (No creation needed if seed data is present — just verify they show up.)

- [ ] **Step 2: Create Product A**

  Navigate to `/products/add`:
  - Name: `Verification Product A`
  - Category: `Bridal Lehengas`
  - Price: `185000`
  - Published: checked
  - Work Types: click `Zardozi` and `Aari`
  - Add a small JPG image via the upload area
  - Click "SAVE PRODUCT"

  Verify after redirect:
  - "Verification Product A" appears in the products list at `/products`
  - Image thumbnail renders correctly
  - Category column shows "Bridal Lehengas"
  - Price shows "₹1,85,000"
  - Status badge shows "PUBLISHED"
  - Work types show "ZARDOZI" and "AARI" badges

- [ ] **Step 3: Create Product B**

  Navigate to `/products/add`:
  - Name: `Verification Product B`
  - Category: `Sarees`
  - Price: `65000`
  - Published: unchecked (status = DRAFT)
  - No image
  - Click "SAVE PRODUCT"

  Verify:
  - "Verification Product B" appears in list with status "DRAFT"
  - Image placeholder icon shown (no image)

- [ ] **Step 4: Verify Product A in Supabase directly**

  Run in Supabase SQL Editor:
  ```sql
  SELECT
    p.id,
    p.name,
    c.name AS category_name,
    p.price,
    p.work_types,
    p.status,
    p.image_url
  FROM public.products p
  LEFT JOIN public.categories c ON c.id = p.category_id
  WHERE p.deleted_at IS NULL
  ORDER BY p.created_at DESC
  LIMIT 5;
  ```

  Expected: "Verification Product A" row with `category_name = 'Bridal Lehengas'`, `price = 185000`, `work_types = {ZARDOZI,AARI}`, `status = PUBLISHED`, `image_url` pointing to a Supabase storage URL.

- [ ] **Step 5: Edit Product A**

  Click "EDIT" on "Verification Product A".

  Confirm form populates: correct name, `Bridal Lehengas` selected in dropdown, `185000` price, "Published" checked, `ZARDOZI`/`AARI` selected work types, image thumbnail visible.

  Change price to `200000`. Click "SAVE CHANGES".

  Verify: products list shows updated `₹2,00,000`.

- [ ] **Step 6: Verify no console errors**

  Open Chrome DevTools → Console. Perform a full page reload at `/products`.

  Expected: No red errors. Yellow warnings about React/Next.js internals are acceptable.

---

## Task 7: Regression Testing

**Files:** None modified

Verify that pages unrelated to product creation are completely unaffected.

- [ ] **Step 1: Categories page**

  Navigate to `/categories`.

  Expected: Categories list renders. Add a test category, verify it appears. Delete it.

- [ ] **Step 2: Orders page**

  Navigate to `/orders`.

  Expected: Orders list renders with mock data (these still come from mockDb). No errors.

- [ ] **Step 3: Enquiries page**

  Navigate to `/enquiries`.

  Expected: Enquiries list renders. No errors.

- [ ] **Step 4: Banners page**

  Navigate to `/banners`.

  Expected: Banners list renders. Add/edit/delete a banner, verify it works (uses mockDb — this is fine, banners are not part of this fix).

- [ ] **Step 5: Settings page**

  Navigate to `/settings`.

  Expected: Settings form renders, values load, save works. No errors.

- [ ] **Step 6: Products DELETE still works**

  On the products list at `/products`, click "DELETE" on one of the test products created in Task 6.

  Expected: Confirmation dialog → product removed from list → soft-deleted in Supabase (`deleted_at` set).

- [ ] **Step 7: Final TypeScript + lint check**

  ```bash
  npx tsc --noEmit && npm run lint
  ```

  Expected: No new errors introduced by this fix.

- [ ] **Step 8: Final commit**

  ```bash
  git add -A
  git status
  ```

  Expected: no uncommitted changes (all changes committed in Tasks 3-5).

  If any are outstanding:
  ```bash
  git commit -m "fix: product creation and edit wired to Supabase backend"
  ```

---

## Deliverables Checklist

- [ ] **Root cause:** `ProductForm.tsx` imports `addProduct`/`updateProduct`/`fetchProducts` from `lib/mockDb.ts` which writes to localStorage. Products list reads from Supabase. No overlap.
- [ ] **Files changed:** `services/products.ts` (+ `getProductById`), `components/products/ProductForm.tsx` (replace 3 mockDb references with service layer calls)
- [ ] **Fix applied:** handleSubmit maps form fields → Supabase schema; loadProduct reads from Supabase and maps back
- [ ] **Verification evidence:** Products A and B visible in list, confirmed in Supabase Dashboard SQL
- [ ] **Regression results:** Categories, Orders, Enquiries, Banners, Settings unaffected

---

## Self-Review

**Spec coverage:**
- Phase 1 (Root Cause Discovery): Task 1 + Task 2 — confirmed by code inspection + runtime reproduction ✓
- Phase 2 (Database Verification): Task 1 — schema confirmed via SQL queries ✓
- Phase 3 (Product Creation Failure): Task 2 — manual reproduction with DevTools ✓
- Phase 4 (Surgical Fix): Tasks 3-5 — only `services/products.ts` and `ProductForm.tsx` modified ✓
- Phase 5 (Verification): Task 6 — full end-to-end create + edit + Supabase SQL check ✓
- Phase 6 (Regression Testing): Task 7 — all other pages verified ✓

**No placeholders:** All code blocks contain the complete, runnable implementation. ✓

**Type consistency:**
- `getProductById` returns `Promise<Product | null>` — matches how it's consumed in Task 4/5 ✓
- `createProduct` / `updateProduct` imported from `@/services/products` — same export names already in services file ✓
- `uploadProductImage(file, productId)` from `@/services/storage` — matches existing signature ✓
- `matchedCat.id` is the `category_id` UUID inserted into Supabase — correct FK ✓
- `work_types: workTypesArr` is `string[]` — matches `ProductUpdate` type in `types/database.ts` ✓
