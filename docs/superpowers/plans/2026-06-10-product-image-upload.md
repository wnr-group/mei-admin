# Product Image Upload Feature — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add production-grade image upload UI to the product create/edit form with safe async handling, memory management, and error recovery.

**Architecture:** Form-level orchestration with deferred upload-on-save pattern. Creates/updates product first, then uploads image, then updates image_url. Minimal changes to existing hooks/services.

**Tech Stack:** React 19, TypeScript, TanStack Query, Supabase client, URL.createObjectURL API

**Production Safety Priorities:**
- Unmount-only cleanup (no stale cleanup triggers)
- Static imports (no dynamic imports in mutation flows)
- Form error state (no browser alerts)
- Number validation (no NaN silently passing)
- Duplicate submit protection (early return checks)
- Centralized cleanup helpers (DRY principle)

---

## File Structure

### Create
- `lib/validators/image.ts` — Centralized image file validation

### Modify
- `services/storage.ts` — Update to use centralized validator
- `app/(app)/products/page.tsx` — Add image upload UI + state + handlers

---

## Phase 1: Setup & Validation

### Task 1: Create Centralized Image Validator

**Files:**
- Create: `lib/validators/image.ts`

**Purpose:** Single source of truth for image validation rules, used by both UI and storage service.

- [ ] **Step 1: Create file with validation function**

Create file `lib/validators/image.ts`:

```typescript
export interface ImageValidationError {
  code: 'INVALID_TYPE' | 'TOO_LARGE'
  message: string
}

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB

export function validateImageFile(file: File): ImageValidationError | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      code: 'INVALID_TYPE',
      message: `File type not allowed. Use: ${ALLOWED_TYPES.join(', ')}`
    }
  }

  if (file.size > MAX_SIZE_BYTES) {
    return {
      code: 'TOO_LARGE',
      message: 'File too large. Maximum size is 5MB.'
    }
  }

  return null
}
```

- [ ] **Step 2: Verify file exists and has correct exports**

Run: `cat lib/validators/image.ts`

Expected: File contains `ImageValidationError` interface and `validateImageFile()` function

- [ ] **Step 3: Commit**

```bash
git add lib/validators/image.ts
git commit -m "feat: add centralized image file validation utility"
```

---

### Task 2: Update Storage Service to Use Validator

**Files:**
- Modify: `services/storage.ts:1-30`

**Purpose:** Replace duplicated validation logic with centralized validator, prevent divergence.

- [ ] **Step 1: Read current storage.ts file**

Run: `head -30 services/storage.ts`

Expected: See current ALLOWED_TYPES and MAX_SIZE_BYTES definitions

- [ ] **Step 2: Update imports and replace validation**

In `services/storage.ts`, replace lines 1-30:

```typescript
import { createClient } from '@/lib/supabase/client'
import { AppError, toAppError } from '@/lib/errors'
import { validateImageFile } from '@/lib/validators/image'

const BUCKET = 'product-images'

export async function uploadProductImage(file: File, productId: string): Promise<string> {
  const validationError = validateImageFile(file)
  if (validationError) {
    throw new AppError('VALIDATION_ERROR', validationError.message)
  }

  const supabase = createClient()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `products/${productId}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) throw toAppError(error)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function deleteProductImage(imageUrl: string): Promise<void> {
  const supabase = createClient()
  const marker = `/storage/v1/object/public/${BUCKET}/`
  const idx = imageUrl.indexOf(marker)
  if (idx === -1) return
  const path = imageUrl.slice(idx + marker.length)

  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw toAppError(error)
}
```

- [ ] **Step 3: Verify the file**

Run: `head -35 services/storage.ts`

Expected: New imports at top, `validateImageFile()` called in `uploadProductImage()`

- [ ] **Step 4: Commit**

```bash
git add services/storage.ts
git commit -m "refactor: use centralized image validator in storage service"
```

---

## Phase 2: Core State & Safety

### Task 3: Add Image Upload State and Safety Setup

**Files:**
- Modify: `app/(app)/products/page.tsx:1-80`

**Purpose:** Add all state variables, mounted safety, cleanup helper, and proper effect setup.

- [ ] **Step 1: Add imports at top of file**

At top of `app/(app)/products/page.tsx`, add to existing imports:

```typescript
import { validateImageFile } from '@/lib/validators/image'
import { uploadProductImage } from '@/services/storage'
import { updateProduct as updateProductDirectly } from '@/services/products'
import type { ProductUpdate } from '@/types'
```

- [ ] **Step 2: Add state declarations**

After line 38 (`const [formImageUrl, setFormImageUrl] = useState('')`), add:

```typescript
  // Image upload state
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [isTemporaryPreview, setIsTemporaryPreview] = useState(false)
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
```

- [ ] **Step 3: Add mounted refs, cleanup helper, and effects**

After the state declarations, add:

```typescript
  // Safety: prevent state updates on unmounted component
  const isMountedRef = useRef(true)

  // Track latest preview values for cleanup
  const previewUrlRef = useRef<string | null>(null)
  const isTemporaryPreviewRef = useRef(false)

  // Helper to cleanup preview URL safely
  const cleanupPreviewUrl = () => {
    if (isTemporaryPreviewRef.current && previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
    }
  }

  // Sync refs with state (runs on state changes)
  useEffect(() => {
    previewUrlRef.current = imagePreviewUrl
    isTemporaryPreviewRef.current = isTemporaryPreview
  }, [imagePreviewUrl, isTemporaryPreview])

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      isMountedRef.current = false
      cleanupPreviewUrl()
    }
  }, [])
```

- [ ] **Step 4: Verify state variables and safety setup**

Run: `grep -n "useState.*uploadState\|cleanupPreviewUrl\|isMountedRef" app/\\(app\\)/products/page.tsx | head -10`

Expected: Output shows new state, cleanup helper, and refs defined

- [ ] **Step 5: Commit**

```bash
git add app/\\(app\\)/products/page.tsx
git commit -m "feat: add image upload state with safety setup and cleanup helper"
```

---

## Phase 3: Event Handlers

### Task 4: Implement Image File Selection Handler

**Files:**
- Modify: `app/(app)/products/page.tsx` (add handler function before handleOpenAdd)

**Purpose:** Handle file selection, validate, create preview, manage blob URLs with cleanup helper.

- [ ] **Step 1: Add file selection handler**

Before the `handleOpenAdd` function (around line 65), add:

```typescript
  // Handle image file selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0]
    if (!file) return

    // Validate file
    const validationError = validateImageFile(file)
    if (validationError) {
      setUploadError(validationError.message)
      e.currentTarget.value = ''
      return
    }

    // Cleanup previous temporary preview
    cleanupPreviewUrl()

    // Create new preview
    const preview = URL.createObjectURL(file)
    setSelectedImageFile(file)
    setImagePreviewUrl(preview)
    setIsTemporaryPreview(true)
    setUploadError(null)
    setFormError(null)
    setUploadState('idle')
    e.currentTarget.value = ''
  }
```

- [ ] **Step 2: Add image removal handler**

After `handleImageSelect`, add:

```typescript
  // Remove selected image
  const handleRemoveImage = () => {
    cleanupPreviewUrl()
    setSelectedImageFile(null)
    setImagePreviewUrl(editingProduct?.image_url || null)
    setIsTemporaryPreview(false)
    setUploadError(null)
    setFormError(null)
  }
```

- [ ] **Step 3: Verify handlers are defined**

Run: `grep -n "handleImageSelect\|handleRemoveImage" app/\\(app\\)/products/page.tsx`

Expected: Line numbers for both handler functions

- [ ] **Step 4: Commit**

```bash
git add app/\\(app\\)/products/page.tsx
git commit -m "feat: add image selection and removal handlers"
```

---

### Task 5: Update Drawer Open Handlers

**Files:**
- Modify: `app/(app)/products/page.tsx:handleOpenAdd and handleOpenEdit`

**Purpose:** Initialize image state correctly when opening drawer, use cleanup helper.

- [ ] **Step 1: Update handleOpenAdd**

Replace `const handleOpenAdd = () => {` function (around line 75):

```typescript
  const handleOpenAdd = () => {
    setEditingProduct(null)
    setFormName('')
    setFormCategoryId(categories[0]?.id ?? '')
    setFormPrice('')
    setFormStatus('PUBLISHED')
    setFormWorkTypes([])
    setWorkInput('')
    setFormImageUrl('')
    cleanupPreviewUrl()
    setSelectedImageFile(null)
    setImagePreviewUrl(null)
    setIsTemporaryPreview(false)
    setUploadState('idle')
    setUploadError(null)
    setFormError(null)
    setIsDrawerOpen(true)
  }
```

- [ ] **Step 2: Update handleOpenEdit**

Replace `const handleOpenEdit = (product: Product) => {` function (around line 90):

```typescript
  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product)
    setFormName(product.name)
    setFormCategoryId(product.category_id ?? '')
    setFormPrice(product.price.toString())
    setFormStatus(product.status)
    setFormWorkTypes(product.work_types ?? [])
    setWorkInput('')
    setFormImageUrl(product.image_url ?? '')
    cleanupPreviewUrl()
    setSelectedImageFile(null)
    setImagePreviewUrl(product.image_url || null)
    setIsTemporaryPreview(false)
    setUploadState('idle')
    setUploadError(null)
    setFormError(null)
    setIsDrawerOpen(true)
  }
```

- [ ] **Step 3: Verify updated handlers**

Run: `grep -A 8 "const handleOpenEdit" app/\\(app\\)/products/page.tsx | head -10`

Expected: Output shows cleanupPreviewUrl() called in handlers

- [ ] **Step 4: Commit**

```bash
git add app/\\(app\\)/products/page.tsx
git commit -m "feat: initialize image state in drawer handlers with cleanup"
```

---

## Phase 4: Save Logic

### Task 6: Replace handleSaveProduct with Production-Safe Implementation

**Files:**
- Modify: `app/(app)/products/page.tsx:handleSaveProduct`

**Purpose:** Implement both create and edit flows with duplicate submit protection, proper error handling, and safe async cleanup.

- [ ] **Step 1: Replace entire handleSaveProduct function**

Find the existing `handleSaveProduct` function and replace it completely with:

```typescript
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault()

    // Prevent duplicate submissions (early return)
    if (
      uploadState === 'uploading' ||
      createProductMutation.isPending ||
      updateProductMutation.isPending
    ) {
      return
    }

    if (!formName || !formPrice || !formCategoryId) return

    // Validate price safely
    const priceNum = Number(formPrice)
    if (Number.isNaN(priceNum)) {
      setFormError('Invalid price')
      return
    }

    try {
      if (editingProduct) {
        // ===== EDIT FLOW =====
        const updates: ProductUpdate = {
          name: formName,
          category_id: formCategoryId,
          price: priceNum,
          status: formStatus,
          work_types: formWorkTypes
        }

        // Don't include image_url if uploading new image (will update separately)
        if (!selectedImageFile) {
          updates.image_url = formImageUrl
        }

        await updateProductMutation.mutateAsync({
          id: editingProduct.id,
          updates
        })

        if (!isMountedRef.current) return

        // Upload new image if selected
        if (selectedImageFile) {
          setUploadState('uploading')
          try {
            const publicUrl = await uploadProductImage(selectedImageFile, editingProduct.id)

            if (!isMountedRef.current) return

            // Update image_url with direct service call (avoid mutation state collision)
            await updateProductDirectly(editingProduct.id, { image_url: publicUrl })

            if (!isMountedRef.current) return
            setUploadState('success')
          } catch (uploadErr) {
            if (!isMountedRef.current) return

            // Product updated, upload failed (recoverable)
            const errorMsg = uploadErr instanceof Error ? uploadErr.message : 'Image upload failed'
            setUploadError(`${errorMsg}. You can retry from the edit screen.`)
            setUploadState('error')
            return
          } finally {
            // Always cleanup blob URL
            if (isMountedRef.current) {
              cleanupPreviewUrl()
            }
          }
        } else {
          // No new image, just cleanup
          cleanupPreviewUrl()
        }
      } else {
        // ===== CREATE FLOW =====
        const createdProduct = await createProductMutation.mutateAsync({
          name: formName,
          category_id: formCategoryId,
          price: priceNum,
          status: formStatus,
          work_types: formWorkTypes,
          image_url: null
        })

        if (!isMountedRef.current) return

        // Upload image if selected
        if (selectedImageFile) {
          setUploadState('uploading')
          try {
            const publicUrl = await uploadProductImage(selectedImageFile, createdProduct.id)

            if (!isMountedRef.current) return

            // Update product with image URL
            await updateProductMutation.mutateAsync({
              id: createdProduct.id,
              updates: { image_url: publicUrl }
            })

            if (!isMountedRef.current) return
            setUploadState('success')
          } catch (uploadErr) {
            if (!isMountedRef.current) return

            // Product created, upload failed (recoverable)
            const errorMsg = uploadErr instanceof Error ? uploadErr.message : 'Image upload failed'
            setUploadError(`${errorMsg}. You can retry from the edit screen.`)
            setUploadState('error')
            return
          } finally {
            // Always cleanup blob URL
            if (isMountedRef.current) {
              cleanupPreviewUrl()
            }
          }
        } else {
          // No image selected, just cleanup
          cleanupPreviewUrl()
        }
      }

      // Success: clear state and close drawer
      if (isMountedRef.current) {
        setSelectedImageFile(null)
        setImagePreviewUrl(null)
        setIsTemporaryPreview(false)
        setUploadError(null)
        setFormError(null)
        setUploadState('idle')
        setIsDrawerOpen(false)
      }
    } catch (err) {
      if (!isMountedRef.current) return

      // Create/Update failed (don't upload image)
      const errorMsg = err instanceof Error ? err.message : 'Failed to save product'
      setFormError(errorMsg)
      setUploadState('idle')
    }
  }
```

- [ ] **Step 2: Verify both flows are present**

Run: `grep -n "EDIT FLOW\|CREATE FLOW\|Prevent duplicate" app/\\(app\\)/products/page.tsx`

Expected: Output shows duplicate protection and both flows defined

- [ ] **Step 3: Commit**

```bash
git add app/\\(app\\)/products/page.tsx
git commit -m "feat: implement production-safe save handler with both flows

- Add early return duplicate submit protection
- Use Number() with NaN validation (not parseInt)
- Use static import for updateProductDirectly (not dynamic)
- Use cleanupPreviewUrl helper consistently
- Replace alert() with formError state
- Add proper finally block cleanup
- Handle both create and edit flows safely"
```

---

## Phase 5: UI Implementation

### Task 7: Add Image Upload UI to Form Drawer

**Files:**
- Modify: `app/(app)/products/page.tsx` (drawer form)

**Purpose:** Add file input, preview, buttons, and error display immediately after Product Name field.

- [ ] **Step 1: Find Product Name field**

Run: `grep -n "Product Name" app/\\(app\\)/products/page.tsx`

Expected: Around line 357-369

- [ ] **Step 2: Add image upload section after Product Name**

After the closing `</div>` of the Product Name field, insert:

```typescript
                {/* Product Image Upload */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
                    Product Image
                  </label>

                  <div className="space-y-3">
                    {/* Preview Image */}
                    {imagePreviewUrl ? (
                      <div className="relative inline-block">
                        <img
                          src={imagePreviewUrl}
                          alt={formName || 'Product preview'}
                          className="w-[100px] h-[100px] object-cover border border-[#E8E0D5]"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                        {uploadState === 'uploading' && (
                          <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
                            <div className="text-[10px] text-zinc-600 font-medium">Uploading...</div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-[100px] h-[100px] bg-[#F5F5F5] border border-[#E8E0D5] flex items-center justify-center text-zinc-400">
                        <ImageIcon className="w-8 h-8 stroke-[1.5]" />
                      </div>
                    )}

                    {/* File Input */}
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                      onChange={handleImageSelect}
                      disabled={uploadState === 'uploading' || createProductMutation.isPending || updateProductMutation.isPending}
                      className="hidden"
                      id="image-input"
                      aria-label="Select product image"
                    />

                    {/* Buttons */}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => document.getElementById('image-input')?.click()}
                        disabled={uploadState === 'uploading' || createProductMutation.isPending || updateProductMutation.isPending}
                        className="border border-[#B38B5D] text-[#B38B5D] hover:bg-[#FAF6F0] disabled:text-zinc-300 disabled:border-zinc-200 px-3 py-2 text-[11px] font-bold uppercase transition-colors"
                        aria-label={imagePreviewUrl ? 'Change product image' : 'Upload product image'}
                      >
                        {imagePreviewUrl ? 'Change Image' : 'Upload Image'}
                      </button>

                      {imagePreviewUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          disabled={uploadState === 'uploading' || createProductMutation.isPending || updateProductMutation.isPending}
                          className="border border-red-300 text-red-600 hover:bg-red-50 disabled:text-zinc-300 disabled:border-zinc-200 px-3 py-2 text-[11px] font-bold uppercase transition-colors"
                          aria-label="Remove product image"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {/* Error Message */}
                    {uploadError && (
                      <div className="text-[12px] text-red-600 mt-2" role="alert" aria-live="polite">
                        {uploadError}
                      </div>
                    )}
                  </div>
                </div>
```

- [ ] **Step 3: Verify UI is in place**

Run: `grep -n "Product Image\|Change Image\|Upload Image" app/\\(app\\)/products/page.tsx | head -5`

Expected: Multiple matches showing UI components

- [ ] **Step 4: Commit**

```bash
git add app/\\(app\\)/products/page.tsx
git commit -m "feat: add image upload UI with preview and buttons"
```

---

### Task 8: Add Form Error Display and Update Save Button

**Files:**
- Modify: `app/(app)/products/page.tsx` (form and save button)

**Purpose:** Show form errors (price validation, etc) and disable save button during upload.

- [ ] **Step 1: Add form error display at top of form**

Find the drawer form (around line 354 `<form onSubmit={handleSaveProduct}`), add after opening form tag:

```typescript
                {formError && (
                  <div className="text-[12px] text-red-600 mb-4" role="alert" aria-live="polite">
                    {formError}
                  </div>
                )}
```

- [ ] **Step 2: Update Save button disabled state and text**

Find the Save button (around line 500-506), replace:

```typescript
              <button
                type="submit"
                form="drawer-form"
                disabled={uploadState === 'uploading' || createProductMutation.isPending || updateProductMutation.isPending}
                className={`flex-1 text-[10px] font-bold tracking-widest py-4 transition-colors uppercase rounded-none ${
                  uploadState === 'uploading' || createProductMutation.isPending || updateProductMutation.isPending
                    ? 'bg-zinc-300 text-zinc-500 cursor-not-allowed'
                    : 'bg-[#B38B5D] hover:bg-[#A37B4D] text-white'
                }`}
              >
                {uploadState === 'uploading' ? 'Uploading image...' : editingProduct ? 'Save Changes' : 'Publish Product'}
              </button>
```

- [ ] **Step 3: Update loading overlay to show upload state**

Find the loading overlay (around line 156-160), replace:

```typescript
      {(createProductMutation.isPending || updateProductMutation.isPending || deleteProductMutation.isPending || uploadState === 'uploading') && (
        <div className="fixed inset-0 bg-white/50 z-50 flex items-center justify-center">
          <div className="text-zinc-500 font-medium text-xs">
            {uploadState === 'uploading' ? 'Uploading image...' : 'Saving updates...'}
          </div>
        </div>
      )}
```

- [ ] **Step 4: Verify button and overlay updates**

Run: `grep -n "uploadState === 'uploading'\|Uploading image" app/\\(app\\)/products/page.tsx | head -5`

Expected: Multiple matches showing upload state handling

- [ ] **Step 5: Commit**

```bash
git add app/\\(app\\)/products/page.tsx
git commit -m "feat: add form error display and update UI for upload state

- Show form-level errors (price validation, etc)
- Disable save button during upload
- Show upload progress message
- Update loading overlay for upload state"
```

---

## Phase 6: Verification & Testing

### Task 9: TypeScript and Lint Check

**Files:**
- All modified files

**Purpose:** Verify no TypeScript or lint errors before testing.

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`

Expected: No errors reported

- [ ] **Step 2: Run ESLint**

Run: `npm run lint`

Expected: No errors (warnings OK if non-blocking)

- [ ] **Step 3: Fix any issues and commit if needed**

If fixes were needed:
```bash
git add .
git commit -m "fix: resolve TypeScript and lint issues"
```

---

### Task 10: Manual Test - Create Without Image

**Purpose:** Verify create flow works without image upload.

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

Expected: Starts at localhost:3000

- [ ] **Step 2: Navigate to products, click ADD PRODUCT**

Open: `http://localhost:3000/app/products`

Click: "ADD PRODUCT" button

Expected: Drawer opens with form fields and image upload section with placeholder

- [ ] **Step 3: Fill form without image**

Enter:
- Product Name: "Test Product 1"
- Category: (select any)
- Price: "5000"
- Status: "PUBLISHED"
- Work Types: add "ZARDOZI"

Skip image upload

- [ ] **Step 4: Click Publish Product**

Expected:
- Product created
- Drawer closes
- Product appears in list
- No image thumbnail (placeholder)

- [ ] **Step 5: Verify in Supabase**

Check products table: verify new product has `image_url = NULL`

- [ ] **Step 6: Check console**

Press F12, check console

Expected: No errors or warnings

---

### Task 11: Manual Test - Create With Image

**Purpose:** Verify complete create → upload → update flow.

- [ ] **Step 1: Open add product drawer**

Click "ADD PRODUCT"

Expected: Drawer opens, image section shows placeholder

- [ ] **Step 2: Select image**

Click "Upload Image", select a JPEG/PNG from your computer

Expected:
- Preview thumbnail appears
- Button changes to "Change Image"
- "Remove" button appears
- No error message

- [ ] **Step 3: Fill form**

Enter:
- Product Name: "Test With Image"
- Category: (select any)
- Price: "10000"
- Status: "PUBLISHED"
- Work Types: add "EMBROIDERY"

- [ ] **Step 4: Click Publish Product**

Expected:
- Save button shows "Uploading image..."
- Loading overlay appears
- Upload completes
- Drawer closes
- Product appears with thumbnail

- [ ] **Step 5: Verify database and storage**

Check Supabase:
- Products: verify `image_url` contains public URL
- Storage: verify file in `product-images/products/{productId}/`

- [ ] **Step 6: Verify thumbnail**

In products list, see image displays correctly

---

### Task 12: Manual Test - Edit with Image Replacement

**Purpose:** Verify edit flow with image replacement.

- [ ] **Step 1: Click EDIT on product with image**

Expected:
- Drawer opens
- Existing image displays
- Form populated

- [ ] **Step 2: Select new image**

Click "Change Image", select different image

Expected:
- Preview updates to new image
- "Remove" button present
- No error

- [ ] **Step 3: Modify price field**

Change price to test form update

- [ ] **Step 4: Click Save Changes**

Expected:
- Product updates immediately
- Image uploads (shows "Uploading image...")
- Drawer closes
- Product list refreshes
- New image displays in thumbnail

- [ ] **Step 5: Verify storage**

In Supabase storage, verify BOTH old and new images exist

Expected: Old image not deleted (by design)

---

### Task 13: Manual Test - Error Cases

**Purpose:** Verify error handling and recovery.

- [ ] **Step 1: Test invalid file type**

Click "Upload Image", try to select PDF/TXT file

Expected:
- Error message shown
- File not selected
- Can retry with different file

- [ ] **Step 2: Test oversized file**

Try file > 5MB

Expected:
- Error message: "File too large. Maximum size is 5MB."
- File not selected
- Can retry

- [ ] **Step 3: Test invalid price**

In form, enter non-numeric price like "abc"

Click "Publish Product"

Expected:
- Error message: "Invalid price"
- Form preserved
- Can correct and retry

- [ ] **Step 4: Test remove image**

Select image, click "Remove"

Expected:
- Preview disappears
- Button changes to "Upload Image"
- "Remove" button disappears
- No console errors

- [ ] **Step 5: Test drawer close during upload**

Select image, click save, immediately close drawer during "Uploading image..."

Expected:
- Drawer closes (no UI trap)
- No memory leaks
- No console errors

---

### Task 14: Regression Testing

**Purpose:** Verify existing functionality unchanged.

- [ ] **Step 1: Create product using form fields only**

Create product without touching image feature

Expected: Works exactly as before

- [ ] **Step 2: Edit product without changing image**

Open product, modify name/price, ignore image

Expected:
- Product updates
- Image unchanged
- No upload occurs

- [ ] **Step 3: Test category CRUD**

Navigate to categories, verify create/edit/delete

Expected: Unaffected

- [ ] **Step 4: Test other sections**

Check orders, enquiries, banners, settings

Expected: All work normally

- [ ] **Step 5: Test auth**

Log out, log back in

Expected: Auth flow unchanged

---

### Task 15: Final Verification

**Purpose:** Confirm all success criteria met.

- [ ] **Checklist: All Features Working**

- ✅ Image upload UI in correct location (after Product Name)
- ✅ File picker accepts image files
- ✅ Preview shows selected image before upload
- ✅ Create flow: product created first, image uploaded, URL saved
- ✅ Edit flow: product updated, image uploaded, URL saved
- ✅ Upload validation prevents invalid files
- ✅ Error messages clear and recoverable
- ✅ Object URLs cleaned up (no memory leaks)
- ✅ Save button disabled during upload
- ✅ Form errors displayed (price validation)
- ✅ No regressions in existing features
- ✅ No TypeScript errors
- ✅ No lint errors
- ✅ No console errors/warnings

- [ ] **Step 1: Run full checks**

Run: `npx tsc --noEmit && npm run lint`

Expected: Clean output

- [ ] **Step 2: Check browser console one final time**

F12 → Console

Expected: No errors, no warnings

- [ ] **Step 3: Final commit**

```bash
git add .
git commit -m "feat: complete product image upload implementation

Production-grade implementation with:
- Safe async lifecycle (unmount-only cleanup)
- Static imports (no dynamic import in flows)
- Form error display (no alerts)
- Number validation (with NaN check)
- Duplicate submit protection
- Centralized cleanup helpers
- Both create and edit flows
- Comprehensive error recovery
- Full accessibility support
- No regressions in existing features"
```

---

## Summary

**17 Tasks Total:**
- Phase 1 (2 tasks): Setup & validation
- Phase 2 (3 tasks): State & safety
- Phase 3 (2 tasks): Event handlers
- Phase 4 (1 task): Save logic
- Phase 5 (2 tasks): UI & buttons
- Phase 6 (7 tasks): Testing & verification

**Production Priorities Met:**
✅ Unmount-only cleanup
✅ Static imports
✅ Form error state (no alerts)
✅ Number validation
✅ Duplicate submit protection
✅ Centralized cleanup helpers
✅ Comprehensive error recovery
✅ Accessibility attributes
✅ No regressions
✅ Memory-safe

