# Category Storage Bucket Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `services/storage.ts` so category image functions use the `category-images` bucket instead of the `product-images` bucket.

**Architecture:** Split the single `const BUCKET = 'product-images'` into two constants — `PRODUCT_BUCKET` and `CATEGORY_BUCKET` — and route each function family to its own bucket. The `category-images` bucket already exists in the DB (migration `012_categories_extended_schema.sql`, lines 15-70) with full insert/update/delete/select RLS policies; no migration changes needed.

**Tech Stack:** TypeScript, Vitest (unit tests), Supabase Storage JS client (`@supabase/supabase-js`).

---

## File Map

| Action | File |
|--------|------|
| Modify | `services/storage.ts` (lines 5, 18, 23, 29, 34, 49, 54, 60, 65) |
| Modify | `__tests__/services/storage.test.ts` (add bucket-routing tests and `remove` mock) |

---

### Task 1: Add Failing Bucket-Routing Tests

**Files:**
- Modify: `__tests__/services/storage.test.ts`

- [ ] **Step 1: Replace the file with the expanded test suite**

The changes vs. the current file:
1. Import all 4 storage functions (not just `uploadProductImage`).
2. Add `mockRemove` to the mock chain so delete functions can be tested.
3. Add `remove: mockRemove` to the `beforeEach` return value.
4. Add a bucket assertion to the existing `uploadProductImage` tests.
5. Add new `describe` blocks for `deleteProductImage`, `uploadCategoryImage`, and `deleteCategoryImage`.

Write `__tests__/services/storage.test.ts` with this exact content:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError } from '@/lib/errors'
import { validateImageFile } from '@/lib/validators/image'

const mockUpload = vi.fn()
const mockGetPublicUrl = vi.fn()
const mockRemove = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    storage: {
      from: mockFrom,
    },
  }),
}))

const {
  uploadProductImage,
  deleteProductImage,
  uploadCategoryImage,
  deleteCategoryImage,
} = await import('@/services/storage')

describe('Storage Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({
      upload: mockUpload,
      getPublicUrl: mockGetPublicUrl,
      remove: mockRemove,
    })
  })

  describe('validateImageFile', () => {
    it('should return error for unsupported file type', () => {
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' })
      const result = validateImageFile(file)

      expect(result).not.toBeNull()
      expect(result?.code).toBe('INVALID_TYPE')
      expect(result?.message).toContain('Invalid file type')
    })

    it('should return error for file exceeding size limit', () => {
      const largeBuffer = new Uint8Array(6 * 1024 * 1024)
      const file = new File([largeBuffer], 'large.jpg', { type: 'image/jpeg' })
      const result = validateImageFile(file)

      expect(result).not.toBeNull()
      expect(result?.code).toBe('TOO_LARGE')
      expect(result?.message).toContain('exceeds')
    })

    it('should return null for valid JPEG files', () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      expect(validateImageFile(file)).toBeNull()
    })

    it('should return null for valid PNG files', () => {
      const file = new File(['test'], 'test.png', { type: 'image/png' })
      expect(validateImageFile(file)).toBeNull()
    })

    it('should return null for valid WebP files', () => {
      const file = new File(['test'], 'test.webp', { type: 'image/webp' })
      expect(validateImageFile(file)).toBeNull()
    })

    it('should return null for valid GIF files', () => {
      const file = new File(['test'], 'test.gif', { type: 'image/gif' })
      expect(validateImageFile(file)).toBeNull()
    })

    it('should return null for files at exactly 5MB limit', () => {
      const buffer = new Uint8Array(5 * 1024 * 1024)
      const file = new File([buffer], 'test.jpg', { type: 'image/jpeg' })
      expect(validateImageFile(file)).toBeNull()
    })
  })

  describe('uploadProductImage', () => {
    it('should validate file before uploading', async () => {
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' })

      try {
        await uploadProductImage(file, 'product-1')
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(AppError)
        expect((err as AppError).code).toBe('VALIDATION_ERROR')
      }

      expect(mockUpload).not.toHaveBeenCalled()
    })

    it('should call storage.from with product-images bucket', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      mockUpload.mockResolvedValue({ error: null })
      mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.com/image.jpg' } })

      await uploadProductImage(file, 'product-1')

      expect(mockFrom).toHaveBeenCalledWith('product-images')
    })

    it('should call storage.upload for valid files', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      mockUpload.mockResolvedValue({ error: null })
      mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.com/image.jpg' } })

      const url = await uploadProductImage(file, 'product-1')

      expect(url).toBe('https://example.com/image.jpg')
      expect(mockUpload).toHaveBeenCalled()
    })

    it('should construct correct path with productId', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      mockUpload.mockResolvedValue({ error: null })
      mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.com/image.jpg' } })

      await uploadProductImage(file, 'product-123')

      const uploadPath = mockUpload.mock.calls[0][0]
      expect(uploadPath).toMatch(/^products\/product-123\/\d+\.jpg$/)
    })
  })

  describe('deleteProductImage', () => {
    it('should use product-images bucket and extract correct path', async () => {
      mockRemove.mockResolvedValue({ error: null })
      const url =
        'https://abc.supabase.co/storage/v1/object/public/product-images/products/p1/123.jpg'

      await deleteProductImage(url)

      expect(mockFrom).toHaveBeenCalledWith('product-images')
      expect(mockRemove).toHaveBeenCalledWith(['products/p1/123.jpg'])
    })

    it('should not call remove for URLs not matching product-images bucket', async () => {
      const url =
        'https://abc.supabase.co/storage/v1/object/public/category-images/categories/c1/123.jpg'

      await deleteProductImage(url)

      expect(mockRemove).not.toHaveBeenCalled()
    })
  })

  describe('uploadCategoryImage', () => {
    it('should call storage.from with category-images bucket', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      mockUpload.mockResolvedValue({ error: null })
      mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.com/cat.jpg' } })

      await uploadCategoryImage(file, 'cat-1')

      expect(mockFrom).toHaveBeenCalledWith('category-images')
    })

    it('should construct correct path with categoryId', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      mockUpload.mockResolvedValue({ error: null })
      mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.com/cat.jpg' } })

      await uploadCategoryImage(file, 'cat-42')

      const uploadPath = mockUpload.mock.calls[0][0]
      expect(uploadPath).toMatch(/^categories\/cat-42\/\d+\.jpg$/)
    })

    it('should validate file before uploading', async () => {
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' })

      try {
        await uploadCategoryImage(file, 'cat-1')
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(AppError)
        expect((err as AppError).code).toBe('VALIDATION_ERROR')
      }

      expect(mockUpload).not.toHaveBeenCalled()
    })
  })

  describe('deleteCategoryImage', () => {
    it('should use category-images bucket and extract correct path', async () => {
      mockRemove.mockResolvedValue({ error: null })
      const url =
        'https://abc.supabase.co/storage/v1/object/public/category-images/categories/c1/123.jpg'

      await deleteCategoryImage(url)

      expect(mockFrom).toHaveBeenCalledWith('category-images')
      expect(mockRemove).toHaveBeenCalledWith(['categories/c1/123.jpg'])
    })

    it('should not call remove for URLs not matching category-images bucket', async () => {
      const url =
        'https://abc.supabase.co/storage/v1/object/public/product-images/products/p1/123.jpg'

      await deleteCategoryImage(url)

      expect(mockRemove).not.toHaveBeenCalled()
    })
  })
})
```

- [ ] **Step 2: Run the tests and verify the new bucket tests FAIL**

```
npx vitest run __tests__/services/storage.test.ts
```

Expected output (partial — some tests will pass, bucket-routing tests will fail):
```
FAIL  __tests__/services/storage.test.ts
 × uploadProductImage > should call storage.from with product-images bucket
   AssertionError: expected "spy" to have been called with arguments: [ 'product-images' ]
   Received calls: [ [ 'product-images' ] ]
   ... (this may pass depending on pre-existing behavior)

 × uploadCategoryImage > should call storage.from with category-images bucket
   AssertionError: expected "spy" to have been called with arguments: [ 'category-images' ]
   Received calls: [ [ 'product-images' ] ]

 × deleteCategoryImage > should use category-images bucket and extract correct path
   AssertionError: expected "spy" to not have been called
```

> If the `uploadProductImage` bucket test happens to pass (the old code did use `product-images`), that is expected — the critical failures are in `uploadCategoryImage` and `deleteCategoryImage`.

---

### Task 2: Fix the Storage Service Implementation

**Files:**
- Modify: `services/storage.ts`

- [ ] **Step 1: Replace `services/storage.ts` with the corrected implementation**

```ts
import { createClient } from '@/lib/supabase/client'
import { AppError, toAppError } from '@/lib/errors'
import { validateImageFile } from '@/lib/validators/image'

const PRODUCT_BUCKET = 'product-images'
const CATEGORY_BUCKET = 'category-images'

export async function uploadProductImage(file: File, productId: string): Promise<string> {
  const validationError = validateImageFile(file)
  if (validationError) {
    throw new AppError('VALIDATION_ERROR', validationError.message)
  }

  const supabase = createClient()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `products/${productId}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from(PRODUCT_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) throw toAppError(error)

  const { data } = supabase.storage.from(PRODUCT_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function deleteProductImage(imageUrl: string): Promise<void> {
  const supabase = createClient()
  const marker = `/storage/v1/object/public/${PRODUCT_BUCKET}/`
  const idx = imageUrl.indexOf(marker)
  if (idx === -1) return
  const path = imageUrl.slice(idx + marker.length)

  const { error } = await supabase.storage.from(PRODUCT_BUCKET).remove([path])
  if (error) throw toAppError(error)
}

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
  if (idx === -1) return
  const path = imageUrl.slice(idx + marker.length)

  const { error } = await supabase.storage.from(CATEGORY_BUCKET).remove([path])
  if (error) throw toAppError(error)
}
```

- [ ] **Step 2: Run the tests and verify ALL pass**

```
npx vitest run __tests__/services/storage.test.ts
```

Expected output:
```
 ✓ __tests__/services/storage.test.ts (18)
   ✓ Storage Service > validateImageFile (7)
   ✓ Storage Service > uploadProductImage (4)
   ✓ Storage Service > deleteProductImage (2)
   ✓ Storage Service > uploadCategoryImage (3)
   ✓ Storage Service > deleteCategoryImage (2)

 Test Files  1 passed (1)
 Tests       18 passed (18)
```

- [ ] **Step 3: Run the full test suite to check for regressions**

```
npx vitest run
```

Expected: all tests pass, no regressions.

- [ ] **Step 4: Type-check**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```
git add services/storage.ts __tests__/services/storage.test.ts
git commit -m "fix: route category image functions to category-images storage bucket"
```

---

### Task 3: End-to-End Verification Against Local Supabase

**Files:** none (manual verification)

- [ ] **Step 1: Confirm the `category-images` bucket exists in local Supabase**

```
npx supabase db reset
```

This replays all migrations including `012_categories_extended_schema.sql` which creates the `category-images` bucket. Then open the Supabase Studio at `http://127.0.0.1:54323` → Storage → verify `category-images` bucket is listed alongside `product-images`.

> If Supabase is already running and you only want to apply the latest migrations without resetting data:
> ```
> npx supabase migration up
> ```

- [ ] **Step 2: Start the dev server**

```
npm run dev
```

- [ ] **Step 3: Upload a category image via the admin UI**

1. Open `http://localhost:3000` and log in.
2. Navigate to Categories.
3. Create or edit any category and upload an image.
4. After saving, inspect the returned `image_url` in the category record (either via the UI or Supabase Studio → Table Editor → `categories` table).

Expected: the URL contains `/storage/v1/object/public/category-images/`, not `product-images`.

- [ ] **Step 4: Verify the file appeared in the correct bucket**

In Supabase Studio → Storage → `category-images` → confirm the uploaded file is present under `categories/<id>/`.
