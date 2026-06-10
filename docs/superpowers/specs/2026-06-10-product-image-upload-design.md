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
const [isUploadingImage, setIsUploadingImage] = useState(false)
const [uploadError, setUploadError] = useState<string | null>(null)
```

### State Lifecycle

**On drawer open (create mode)**:
```typescript
setSelectedImageFile(null)
setImagePreviewUrl(null)
setIsUploadingImage(false)
setUploadError(null)
```

**On drawer open (edit mode)**:
```typescript
setSelectedImageFile(null)
setImagePreviewUrl(null)  // Don't override formImageUrl
setIsUploadingImage(false)
setUploadError(null)
```

**On file selection**:
```typescript
const file = event.target.files?.[0]
if (file) {
  validateImageFile(file)  // Throws AppError if invalid
  setSelectedImageFile(file)
  setImagePreviewUrl(URL.createObjectURL(file))
  setUploadError(null)
}
```

**On image removal** (optional "change" button):
```typescript
if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
setSelectedImageFile(null)
setImagePreviewUrl(null)
```

**On drawer close**:
```typescript
// Revoke if not saved/uploaded
if (imagePreviewUrl && !formImageUrl?.includes(imagePreviewUrl)) {
  URL.revokeObjectURL(imagePreviewUrl)
}
setSelectedImageFile(null)
setImagePreviewUrl(null)
setUploadError(null)
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
├─ Else if formImageUrl exists (edit mode) → show existing image
└─ Else → show placeholder (camera icon + "No image")

File Input:
├─ Type: file
├─ Accept: image/*
├─ Button text: "Upload Image" or "Change Image" (if image exists)
├─ Hidden input with onChange handler

Loading State:
├─ During isUploadingImage: show spinner + "Uploading image..."
└─ Disable file input

Error State:
├─ Display uploadError message if present
├─ Non-blocking inline message
└─ Allow retry by selecting new file
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
- isUploadingImage === true
- createProductMutation.isPending === true
- updateProductMutation.isPending === true
```

### File Input Disabled When

```
- isUploadingImage === true
- createProductMutation.isPending === true
- updateProductMutation.isPending === true
```

### Drawer Close Prevention

- Discourage close during upload (can be soft: "Changes may be lost")
- But allow close if user insists (don't trap UI)
- On close: revoke object URLs properly

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
    
    // Step 2: Upload image if selected
    if (selectedImageFile) {
      setIsUploadingImage(true)
      try {
        const publicUrl = await uploadProductImage(selectedImageFile, createdProduct.id)
        
        // Step 3: Update product with image URL
        await updateProductMutation.mutateAsync({
          id: createdProduct.id,
          updates: { image_url: publicUrl }
        })
      } catch (uploadErr) {
        // Product created, but upload failed (recoverable)
        setUploadError('Image upload failed. You can retry from the edit screen.')
        setIsUploadingImage(false)
        // Don't close drawer, let admin retry
        return
      }
    }
    
    // Step 4: Cleanup
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    setSelectedImageFile(null)
    setImagePreviewUrl(null)
    setUploadError(null)
    setIsUploadingImage(false)
    
    // Step 5: Close drawer
    setIsDrawerOpen(false)
    
  } catch (err) {
    // Create failed (product never created)
    alert('Failed to create product')
  }
}
```

### Update Product with Image

```typescript
const handleSaveProduct = async (e: React.FormEvent) => {
  e.preventDefault()
  
  if (!editingProduct) return
  
  try {
    // Step 1: Update product with current form values (excluding new image)
    await updateProductMutation.mutateAsync({
      id: editingProduct.id,
      updates: {
        name: formName,
        category_id: formCategoryId,
        price: parseInt(formPrice, 10),
        status: formStatus,
        work_types: formWorkTypes,
        // Don't include image_url unless we're replacing it
        ...(selectedImageFile ? {} : { image_url: formImageUrl })
      }
    })
    
    // Step 2: Upload new image if selected
    if (selectedImageFile) {
      setIsUploadingImage(true)
      try {
        const publicUrl = await uploadProductImage(selectedImageFile, editingProduct.id)
        
        // Step 3: Update image_url
        await updateProductMutation.mutateAsync({
          id: editingProduct.id,
          updates: { image_url: publicUrl }
        })
      } catch (uploadErr) {
        // Update succeeded, upload failed (recoverable)
        setUploadError('Image upload failed. You can retry from the edit screen.')
        setIsUploadingImage(false)
        return
      }
    }
    
    // Step 4: Cleanup
    if (imagePreviewUrl && !formImageUrl?.includes(imagePreviewUrl)) {
      URL.revokeObjectURL(imagePreviewUrl)
    }
    setSelectedImageFile(null)
    setImagePreviewUrl(null)
    setUploadError(null)
    setIsUploadingImage(false)
    
    // Step 5: Close drawer
    setIsDrawerOpen(false)
    
  } catch (err) {
    // Update failed, state rolled back
    alert('Failed to save product')
  }
}
```

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

**Memory Safety**:
- Always call `URL.revokeObjectURL()` for preview URLs that aren't saved
- Call on: unmount, image replace, successful save, drawer close

**Race Conditions**:
- Upload deferred until save (not on select) prevents double uploads
- Save button disabled during upload prevents multiple submits

**Atomicity Safeguards**:
- Product creation is separate from image upload
- If upload fails, product still exists (acceptable, recoverable)
- No automatic rollbacks (too risky)
- Admin can retry from edit screen

**No Image Cleanup**:
- Old images in storage when replaced: intentionally left alone
- Safer than automatic deletion
- Can implement cleanup jobs later if needed
- Prevents accidental data loss

