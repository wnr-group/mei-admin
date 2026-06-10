---
title: Product Image Upload Feature
date: 2026-06-10
status: approved-for-implementation
---

# Product Image Upload Feature — Design Specification

## Overview

Add production-grade image upload capability to the product create/edit form in the admin dashboard. This feature enables admins to upload product images (primary visual identifier for bridal couture) to Supabase Storage and persist the image URL in the database.

**Scope**: UI + form integration only. Storage backend and database schema already exist and are working.

---

## Current State Assessment

### ✅ Already Implemented & Working
- Supabase authentication & RLS policies
- Product CRUD (create, read, update, delete)
- Storage bucket: `product-images` (accessible)
- Storage policies (admins can upload/delete, public can view)
- Storage service with upload function: `uploadProductImage(file, productId)`
- Database schema: `products.image_url` (nullable string)
- Product form: state variable `formImageUrl` already exists
- Product types: `Product`, `ProductInsert`, `ProductUpdate`

### ❌ Missing
- UI to select/upload images (file picker)
- Image preview display
- Upload progress feedback
- Error recovery flow
- Orchestration of create → upload → update flow

---

## Architecture Decision: Form-Level Orchestration

**Pattern**: Reuse existing hooks/services with form-level orchestration.

**Rationale**:
- Minimal changes to working systems
- Isolates new logic to page component level
- No new abstractions or patterns introduced
- Reduces regression risk
- Easier to test and reason about

**Components Involved**:
- `app/(app)/products/page.tsx` — existing form, add image upload UI + state
- `services/storage.ts` — reuse existing `uploadProductImage()` function
- `hooks/use-products.ts` — keep existing mutations untouched

---

## Data Flow

### Create Flow (New Product)

```
1. User selects image file
   ↓ Store in selectedImageFile state
   ↓ Generate preview URL via URL.createObjectURL(file)
   ↓ Store in imagePreviewUrl state
   
2. Admin fills form (name, category, price, status, work types)

3. Admin clicks "Publish Product"
   ↓ Validation: name, category, price required
   ↓ Call createProduct({ name, category_id, price, status, work_types, image_url: null })
   
4. Product created in database, receive productId
   ↓ If selectedImageFile exists:
   ├─ Set isUploadingImage = true
   ├─ Call uploadProductImage(selectedImageFile, productId)
   │  → Validates: file type (jpeg/png/webp/gif), size ≤ 5MB
   │  → Uploads to: products/${productId}/${timestamp}.${ext}
   │  → Returns public URL
   ├─ Call updateProduct(productId, { image_url: publicUrl })
   └─ Set isUploadingImage = false
   
5. Cleanup
   ├─ Revoke imagePreviewUrl via URL.revokeObjectURL()
   ├─ Clear selectedImageFile, imagePreviewUrl, uploadError
   └─ Close drawer
   
6. Refresh product list (TanStack Query invalidation)
```

### Edit Flow (Update Product)

```
1. Admin opens edit drawer
   ↓ Form populates with existing product data
   ↓ imagePreviewUrl = product.image_url (existing image displays)

2. Scenario A: No image change
   ├─ Admin modifies other fields (name, price, etc.)
   └─ On save: updateProduct() with changes, skip image logic

2. Scenario B: Image replacement
   ├─ Admin selects new image
   ├─ Store in selectedImageFile state
   ├─ Generate preview via URL.createObjectURL(file)
   ├─ Update imagePreviewUrl (show new preview)
   ├─ Keep formImageUrl unchanged (old URL still in form state)
   
3. Admin clicks "Save Changes"
   ↓ Call updateProduct(productId, { name, category_id, price, status, work_types, image_url: currentValue })
   ↓ On success:
   ├─ If selectedImageFile exists:
   │  ├─ Set isUploadingImage = true
   │  ├─ Call uploadProductImage(selectedImageFile, productId)
   │  ├─ Receive publicUrl
   │  ├─ Call updateProduct(productId, { image_url: publicUrl })
   │  │  ⚠️ At this point: new image in storage, old image still in storage (no cleanup)
   │  └─ Set isUploadingImage = false
   └─ Clear selectedImageFile, imagePreviewUrl, uploadError
   
4. Cleanup
   ├─ Revoke imagePreviewUrl
   └─ Close drawer
```

---

## Component State

### New Local State (in products/page.tsx)

```typescript
// Image upload state
const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)
const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
const [isTemporaryPreview, setIsTemporaryPreview] = useState(false)  // Track if preview is blob URL
const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
const [uploadError, setUploadError] = useState<string | null>(null)

// Safety: prevent state updates on unmounted component
const isMountedRef = useRef(true)

useEffect(() => {
  return () => {
    isMountedRef.current = false
    // Cleanup blob URL on unmount
    if (isTemporaryPreview && imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl)
    }
  }
}, [])
```

### State Lifecycle

**On drawer open (create mode)**:
```typescript
setSelectedImageFile(null)
setImagePreviewUrl(null)
setIsTemporaryPreview(false)
setUploadState('idle')
setUploadError(null)
```

**On drawer open (edit mode)**:
```typescript
setSelectedImageFile(null)
setImagePreviewUrl(product.image_url || null)
setIsTemporaryPreview(false)  // Existing image is persisted, not temporary
setUploadState('idle')
setUploadError(null)
```

**On file selection**:
```typescript
const file = event.target.files?.[0]
if (file) {
  // Validate before processing
  const validationError = validateImageFile(file)
  if (validationError) {
    setUploadError(validationError)
    return
  }
  
  // Cleanup previous temporary preview if exists
  if (isTemporaryPreview && imagePreviewUrl) {
    URL.revokeObjectURL(imagePreviewUrl)
  }
  
  // Create new preview
  const preview = URL.createObjectURL(file)
  setSelectedImageFile(file)
  setImagePreviewUrl(preview)
  setIsTemporaryPreview(true)  // ← Mark as temporary blob URL
  setUploadError(null)
  setUploadState('idle')
}
```

**On image removal** (optional "change" button):
```typescript
if (isTemporaryPreview && imagePreviewUrl) {
  URL.revokeObjectURL(imagePreviewUrl)
}
setSelectedImageFile(null)
setImagePreviewUrl(product?.image_url || null)  // Restore original
setIsTemporaryPreview(false)
setUploadError(null)
```

**On drawer close**:
```typescript
// Cleanup only temporary blob URLs
if (isTemporaryPreview && imagePreviewUrl) {
  URL.revokeObjectURL(imagePreviewUrl)
}
setSelectedImageFile(null)
setImagePreviewUrl(null)
setIsTemporaryPreview(false)
setUploadError(null)
setUploadState('idle')
```

---

## UI Design

### Location
Immediately after "Product Name" field in the product form drawer.

### Components

**Image Upload Section**:
```
Label: "Product Image"

Preview Area:
├─ If imagePreviewUrl exists → show thumbnail
│  ├─ alt={formName || 'Product preview'}
│  ├─ onError fallback to placeholder
│  └─ Clickable to change image
├─ Else → show placeholder (camera icon + "No image")

File Input:
├─ Type: file
├─ Accept: image/jpeg,image/png,image/webp,image/gif
├─ aria-label: "Select product image"
├─ Button text: "Upload Image" or "Change Image" (if image exists)
├─ Hidden input with onChange handler
├─ Disabled during uploadState === 'uploading'

Change/Remove Buttons:
├─ Only show if image exists
├─ "Change Image" → triggers file input
├─ "Remove" → clears preview, revokes blob URL
├─ Disabled during uploadState === 'uploading'

Loading State:
├─ During uploadState === 'uploading': show spinner + "Uploading image..."
└─ Disable file input and buttons

Error State:
├─ Display uploadError message if present (non-blocking inline)
├─ Provide retry button or option to select different file
├─ Error clears on successful retry or new file selection
└─ Allow admin to retry without reopening drawer

Accessibility:
├─ aria-label on buttons
├─ aria-describedby for error messages
├─ Keyboard navigation support
├─ Focus visible states
└─ Proper semantic HTML
```

### Styling (Preserve Existing Patterns)

- Use existing form field styling: `border-b border-[#E8E0D5]`
- Label: `text-[10px] font-bold tracking-widest text-zinc-400 uppercase`
- Image preview: `w-[100px] h-[100px] object-cover border border-[#E8E0D5]`
- File input button: Match existing secondary button style
- Error text: `text-[12px] text-red-600 mt-1`
- Loading indicator: Existing spinner component or inline text

### Layout

```
Product Image
[Preview Thumbnail 100x100] [Upload Button] [Remove Button if preview]
Loading spinner (if uploading)
Error message (if upload failed, recoverable)
```

---

## Error Handling & Recovery

### Validation Errors (Client-Side)

**Invalid file type**:
- Message: "File type not allowed. Use: image/jpeg, image/png, image/webp, image/gif"
- Recovery: Select different file
- Impact: None (upload never attempted)

**File too large (>5MB)**:
- Message: "File too large. Maximum size is 5MB."
- Recovery: Select smaller file
- Impact: None (upload never attempted)

### Upload Errors (After Product Creation)

**Product created, but image upload fails**:
- State: productId exists in DB, image_url is NULL
- Message: "Product created successfully, but image upload failed. Retry from the edit screen."
- Recovery: Admin can edit product, upload image again
- Impact: Product is usable without image (acceptable temporary state)
- No automatic rollback or cleanup

**Product created, image uploaded, but update fails**:
- State: productId exists, image in storage, image_url not updated in DB
- Message: "Product created, but image linking failed. Refresh and retry from edit screen."
- Recovery: Edit product, image field empty, re-upload
- Impact: Image orphaned in storage temporarily (acceptable, no cleanup job)
- No automatic cleanup

### Error Display

- Inline error message in form (non-blocking)
- Message disappears on successful retry
- Save button remains disabled during failed state
- No modal/toast spam
- Allows graceful recovery without navigation

---

## UI State Management

### Save Button Disabled When

```
- uploadState === 'uploading'
- createProductMutation.isPending === true
- updateProductMutation.isPending === true
```

### File Input & Change/Remove Buttons Disabled When

```
- uploadState === 'uploading'
- createProductMutation.isPending === true
- updateProductMutation.isPending === true
```

### Loading Messages

```
- During mutation: "Saving updates..."
- During upload: "Uploading image..."
```

### Drawer Close Handling

- Allow close even during upload (soft warning acceptable)
- On close during upload: object URLs properly revoked in cleanup
- Use isMountedRef to prevent state updates after unmount
- No UI traps or forced locks

---

## Save Handler Implementation Details

### Create Product with Image

```typescript
const handleSaveProduct = async (e: React.FormEvent) => {
  e.preventDefault()
  
  // Validation
  if (!formName || !formPrice || !formCategoryId) return
  
  try {
    // Step 1: Create product WITHOUT image_url
    const createdProduct = await createProductMutation.mutateAsync({
      name: formName,
      category_id: formCategoryId,
      price: parseInt(formPrice, 10),
      status: formStatus,
      work_types: formWorkTypes,
      image_url: null  // ← Important: no image URL yet
    })
    
    if (!isMountedRef.current) return
    
    // Step 2: Upload image if selected
    if (selectedImageFile) {
      setUploadState('uploading')
      try {
        const publicUrl = await uploadProductImage(selectedImageFile, createdProduct.id)
        
        if (!isMountedRef.current) return
        
        // Step 3: Update product with image URL
        await updateProductMutation.mutateAsync({
          id: createdProduct.id,
          updates: { image_url: publicUrl }
        })
        
        if (!isMountedRef.current) return
        setUploadState('success')
      } catch (uploadErr) {
        if (!isMountedRef.current) return
        
        // Product created, but upload failed (recoverable)
        const errorMsg = uploadErr instanceof Error ? uploadErr.message : 'Image upload failed'
        setUploadError(`${errorMsg}. You can retry from the edit screen.`)
        setUploadState('error')
        // Keep drawer open, allow retry
        return
      } finally {
        if (isMountedRef.current) {
          // Cleanup temporary blob URL only if not already cleaned
          if (isTemporaryPreview && imagePreviewUrl) {
            URL.revokeObjectURL(imagePreviewUrl)
          }
        }
      }
    } else {
      // No image selected, just cleanup
      if (isTemporaryPreview && imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl)
      }
    }
    
    // Step 4: Clear state and close drawer (only if successful)
    if (isMountedRef.current) {
      setSelectedImageFile(null)
      setImagePreviewUrl(null)
      setIsTemporaryPreview(false)
      setUploadError(null)
      setUploadState('idle')
      setIsDrawerOpen(false)
    }
    
  } catch (err) {
    if (!isMountedRef.current) return
    
    // Create failed (product never created, don't upload)
    const errorMsg = err instanceof Error ? err.message : 'Failed to create product'
    alert(errorMsg)
    setUploadState('idle')
  }
}
```

### Update Product with Image

```typescript
const handleSaveProduct = async (e: React.FormEvent) => {
  e.preventDefault()
  
  if (!editingProduct) return
  
  try {
    // Step 1: Update product with current form values
    const updates: ProductUpdate = {
      name: formName,
      category_id: formCategoryId,
      price: parseInt(formPrice, 10),
      status: formStatus,
      work_types: formWorkTypes
    }
    
    // Don't include image_url if we're uploading new image
    // (will update separately after upload)
    if (!selectedImageFile) {
      updates.image_url = formImageUrl
    }
    
    await updateProductMutation.mutateAsync({
      id: editingProduct.id,
      updates
    })
    
    if (!isMountedRef.current) return
    
    // Step 2: Upload new image if selected
    if (selectedImageFile) {
      setUploadState('uploading')
      try {
        const publicUrl = await uploadProductImage(selectedImageFile, editingProduct.id)
        
        if (!isMountedRef.current) return
        
        // Step 3: Update image_url (separate mutation call for image-only update)
        // Using direct service call to avoid mutation state collision
        const { updateProduct: updateProductDirectly } = await import('@/services/products')
        await updateProductDirectly(editingProduct.id, { image_url: publicUrl })
        
        if (!isMountedRef.current) return
        setUploadState('success')
      } catch (uploadErr) {
        if (!isMountedRef.current) return
        
        // Product updated, but image upload failed (recoverable)
        const errorMsg = uploadErr instanceof Error ? uploadErr.message : 'Image upload failed'
        setUploadError(`${errorMsg}. You can retry from the edit screen.`)
        setUploadState('error')
        return
      } finally {
        // Cleanup only temporary blob URLs
        if (isMountedRef.current && isTemporaryPreview && imagePreviewUrl) {
          URL.revokeObjectURL(imagePreviewUrl)
        }
      }
    } else {
      // No new image, just cleanup
      if (isTemporaryPreview && imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl)
      }
    }
    
    // Step 4: Clear state and close drawer (only if successful)
    if (isMountedRef.current) {
      setSelectedImageFile(null)
      setImagePreviewUrl(null)
      setIsTemporaryPreview(false)
      setUploadError(null)
      setUploadState('idle')
      setIsDrawerOpen(false)
    }
    
  } catch (err) {
    if (!isMountedRef.current) return
    
    // Update failed, don't upload image
    const errorMsg = err instanceof Error ? err.message : 'Failed to save product'
    alert(errorMsg)
    setUploadState('idle')
  }
}
```

---

## Image Validation Consolidation

**Current state**: `validateImageFile()` exists in `services/storage.ts`

**Required improvement**: Centralize to prevent divergence

**Create** `lib/validators/image.ts`:

```typescript
export interface ImageValidationError {
  code: 'INVALID_TYPE' | 'TOO_LARGE'
  message: string
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
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

**Update** `services/storage.ts` to import and use this validator instead of duplicating.

**Update** form component to import and use this validator.

This ensures consistency across all layers.

---

## Existing Code to Preserve

**DO NOT modify**:
- `services/products.ts` — createProduct(), updateProduct()
- `hooks/use-products.ts` — useCreateProduct(), useUpdateProduct(), useDeleteProduct()
- `services/storage.ts` — uploadProductImage() (reuse as-is)
- Product table structure & RLS policies
- Category CRUD
- Authentication & admin role checks
- Audit logging (continues to work automatically)

---

## Testing Requirements

### Unit: Image Selection & Preview
- Valid file → preview displays via URL.createObjectURL()
- Invalid file type → validation error shows
- File too large → validation error shows
- Select same file twice → object URL properly managed

### Integration: Create Flow
- Create product without image → success, image_url = null
- Create product with image → product created, image uploaded, URL saved
- Cancel during upload → product created, image discarded (recoverable)
- Upload fails after create → product safe, retry from edit screen

### Integration: Edit Flow
- Edit without changing image → update succeeds, image untouched
- Replace image → new image uploaded, URL updated, old image remains in storage
- Cancel during upload → product unchanged, retry

### UI/UX
- Save button disabled during upload
- File input disabled during upload
- Error message displays and clears on retry
- Preview displays immediately on selection
- No layout shifts or CLS
- No console errors or warnings
- Drawer close works even during upload

### Regression
- Existing products still display with images
- Edit form still loads existing product data
- Category/status/work types still work
- Other admin features unaffected
- Auth still works
- Audit logging still works

---

## Rollout Plan

1. **Implementation** → code changes, unit tests
2. **Local verification** → manual testing in dev environment
3. **Code review** → peer review for safety
4. **Testing** → comprehensive test cases from "Testing Requirements"
5. **PR** → merge to feature branch
6. **Staging verification** → final checks in staging if available
7. **Production deployment** → merge to main

---

## Success Criteria

✅ Image upload UI displays in correct location
✅ File picker accepts image files
✅ Preview shows selected image before upload
✅ Create flow: product created first, then image uploaded, then URL saved
✅ Edit flow: product updated, then image uploaded, then URL saved
✅ Upload validation prevents invalid files
✅ Error messages are clear and recoverable
✅ Object URLs are properly cleaned up (no memory leaks)
✅ Save button disabled during upload
✅ No regressions in existing features
✅ No TypeScript errors
✅ No lint errors
✅ No console errors/warnings

---

## Notes for Implementation

### Memory Safety — CRITICAL

**Blob URL Management**:
- Never revoke persisted Supabase URLs (only revoke blob URLs)
- Use `isTemporaryPreview` flag to track which URLs are temporary
- Revoke on:
  - Component unmount
  - New file selected (revoke old blob first)
  - Successful product save
  - Drawer close
  - Image removal

**Bad Pattern** (DON'T):
```typescript
if (imagePreviewUrl && !formImageUrl?.includes(imagePreviewUrl)) {
  URL.revokeObjectURL(imagePreviewUrl)
}
```
Reason: `includes()` is unreliable, may revoke persisted URLs

**Good Pattern** (DO):
```typescript
if (isTemporaryPreview && imagePreviewUrl) {
  URL.revokeObjectURL(imagePreviewUrl)
}
```

### Async Safety

**Mounted Check**:
- Use `isMountedRef` to track component mount state
- Check `isMountedRef.current` before state updates after async operations
- Prevents: "Warning: Can't perform a React state update on an unmounted component"
- Prevents: Memory leaks, stale state updates

**Example**:
```typescript
await someAsyncOperation()
if (!isMountedRef.current) return
setError(null)  // Safe to set state
```

**Finally Blocks**:
- Use `finally` for cleanup that must run regardless of success/error
- Prevents: Stuck loading states if exception occurs in any branch
- Example: `setUploadState('uploading')` in try, always reset in finally

### Race Conditions

**Upload Prevention**:
- Upload deferred until save (not on select) prevents double uploads
- Save button disabled during upload prevents multiple submits
- Using separate mutation for image-only update avoids mutation state collision

**State Mutations**:
- Don't use same TanStack mutation twice for unrelated operations
- Use direct service calls for secondary updates
- Prevents: optimistic update conflicts, stale cache invalidations

### Error Isolation

**Product Creation Failures**:
- If create fails: don't upload image
- Image upload never attempted on failed product

**Image Upload Failures**:
- If upload fails after create: product still exists (acceptable)
- Show recoverable error message
- Allow retry from edit screen without creating new product

**Product Update Failures**:
- If update fails: don't upload new image
- Previous image remains unchanged in DB

**Image URL Update Failures**:
- If image URL update fails after successful upload:
  - Image exists in storage
  - Product missing image_url in DB
  - Show message to retry from edit screen
  - No automatic cleanup

### Atomicity Safeguards

**NOT a transactional system**:
- Accept that intermediate states can occur (product without image)
- These are recoverable and safe
- Simpler than attempting transactions
- No rollback logic

**Example safe sequence**:
1. Create product → succeeds ✓
2. Upload image → succeeds ✓
3. Update image URL → fails ✗

Result: Product exists, image exists in storage, but image_url null in DB
Recovery: Admin retries from edit screen, update succeeds on retry

### UI Stability

**No Form Reset Until Success**:
- Keep form populated during error states
- Admin can retry without re-entering data
- Clear form only after full success

**Graceful Degradation**:
- If image upload fails: product still created, usable without image
- Not ideal, but safe and recoverable
- Better than losing entire product creation

### Image Rendering Safety

**Broken Image Handling**:
```tsx
<img 
  src={imageUrl}
  alt={formName || 'Product preview'}
  onError={(e) => {
    e.currentTarget.src = '/placeholder-product.png'
  }}
/>
```

Prevents: Broken image icons in UI

### No Image Cleanup

- Old images when replaced: intentionally left in storage
- Safer than automatic deletion
- Prevents accidental data loss from race conditions
- Can implement cleanup jobs later if needed
- Manual cleanup possible if needed

### Extensibility

**Upload State Machine**:
```typescript
type UploadState = 'idle' | 'uploading' | 'success' | 'error'
```
More extensible than boolean flags
Easier to add: progress bars, retry states, analytics later

**Centralized Validators**:
- File validation in `lib/validators/image.ts`
- Reused by UI layer and storage service
- Prevents divergence over time
- Single source of truth for validation rules

