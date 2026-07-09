# Color-Grouped Media Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire existing color/media components into the admin ProductForm (edit mode), and add a color swatch filter to the storefront ImageGallery.

**Architecture:** Admin edit mode mounts the already-built `ColorList` + `MediaGallery` components directly into `ProductForm`, replacing the flat image uploader. On the storefront, the products service query is extended to join `product_colors`, the `Product` type gains `colors` and `coloredMedia` fields, and `ImageGallery` gains a color swatch bar with filter-highlight behavior.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Supabase, Tailwind CSS v4, `@tanstack/react-query` (admin), `next/image` (storefront)

## Global Constraints

- No dark mode — light-only across both apps
- Sharp corners (border-radius: 0) everywhere
- Gold `#c9a465` / `#B38B5D` for active states, CTAs, swatches ring
- Cream background `#FAF8F5`, border `#E8E0D5`
- `'use client'` only when hooks/interactivity needed
- Server Components for data fetching
- Tailwind utilities inline; no CSS modules
- TypeScript strict — no `any`, no `as never`
- Admin dev port: 3000 (from `npm run dev` in `mei-admin/`)
- Storefront dev port: 3000 (from `npm run dev` in `mei/`)

---

## File Map

**mei-admin (admin panel):**
- Modify: `components/products/ProductForm.tsx` — wire ColorList + MediaGallery in edit mode; add note in create mode; remove image upload from edit submit path

**mei (storefront):**
- Modify: `src/lib/supabase/database.ts` — add `product_colors` table type
- Modify: `src/types/index.ts` — add `colors` and `coloredMedia` to `Product`
- Modify: `src/lib/services/products.ts` — extend SELECT, `ProductWithRelations`, and `_mapDbRowToProduct`
- Modify: `src/components/product/ImageGallery.tsx` — color swatch bar + dynamic thumbnails
- Modify: `src/app/shop/[slug]/page.tsx` — pass `colors` and `coloredMedia` props to `ImageGallery`

---

## Task 1: Wire ColorList + MediaGallery into ProductForm (admin edit mode)

**Files:**
- Modify: `components/products/ProductForm.tsx`

**Interfaces:**
- Consumes: `ColorList` from `@/components/products/colors/ColorList` — accepts `{ productId: string }`
- Consumes: `MediaGallery` from `@/components/products/media/MediaGallery` — accepts `{ productId: string }`
- Consumes: existing `editId` prop on `ProductForm`

**Context:** The current MEDIA card (Card 5, right column, lines ~566–658) is a flat dropzone that saves only `images[0]` as `image_url`. In edit mode this should be replaced with `ColorList` + `MediaGallery`. In create mode a note is added below the existing uploader. The image upload logic in `handleSubmit` (lines ~212–235) must be removed for edit mode only — media is now managed directly via mutations, not through form submit.

- [ ] **Step 1: Add imports for ColorList and MediaGallery at the top of ProductForm.tsx**

Open `components/products/ProductForm.tsx`. After the existing imports (around line 11), add:

```tsx
import ColorList from '@/components/products/colors/ColorList'
import MediaGallery from '@/components/products/media/MediaGallery'
```

- [ ] **Step 2: Remove image upload logic from the edit submit path**

In `handleSubmit`, find the edit flow block (around line 211–235):

```tsx
if (editId) {
  // ── EDIT FLOW ──────────────────────────────────────────────
  const existingProduct = await getProductById(editId);
  let finalImageUrl: string | null = existingProduct?.image_url ?? null;

  if (images[0]?.startsWith('data:') && imageFiles[0] instanceof File) {
    // New image selected — use the original File directly (no fetch(data:) needed).
    finalImageUrl = await uploadProductImage(imageFiles[0], editId);
  } else if (images[0]?.startsWith('http')) {
    finalImageUrl = images[0];
  } else if (images.length === 0) {
    finalImageUrl = null;
  }

  await updateProduct(editId, {
    name: name.trim(),
    slug: slug.trim() || null,
    short_description: shortDescription.trim() || null,
    category_id: category,
    price: priceNum,
    status: published ? 'PUBLISHED' : 'DRAFT',
    work_types: workTypesArr,
    description: descriptionVal,
    image_url: finalImageUrl,
  });
}
```

Replace with (no image upload — media managed by MediaGallery mutations):

```tsx
if (editId) {
  // ── EDIT FLOW ──────────────────────────────────────────────
  // Media is managed by ColorList + MediaGallery — not through form submit.
  await updateProduct(editId, {
    name: name.trim(),
    slug: slug.trim() || null,
    short_description: shortDescription.trim() || null,
    category_id: category,
    price: priceNum,
    status: published ? 'PUBLISHED' : 'DRAFT',
    work_types: workTypesArr,
    description: descriptionVal,
  });
}
```

- [ ] **Step 3: Remove unused uploadProductImage import if no longer used elsewhere in the file**

Check if `uploadProductImage` is still referenced after Step 2. If the create flow (lines ~236–259) still uses it, leave the import. If not, remove:

```tsx
import { uploadProductImage } from '@/services/storage';
```

- [ ] **Step 4: Replace the MEDIA card content in edit mode**

Find the MEDIA card (Card 5) in the JSX — the `<div className="bg-white border border-[#E8E0D5] p-8 space-y-6">` block that starts around line 566 and contains the dropzone and thumbnail grid.

Replace the entire inner content of that card with a conditional:

```tsx
{/* Card 5: MEDIA / COLORS */}
<div className="bg-white border border-[#E8E0D5] p-8 space-y-8">
  {editId ? (
    <>
      <ColorList productId={editId} />
      <div className="border-t border-[#E8E0D5] pt-6">
        <MediaGallery productId={editId} />
      </div>
    </>
  ) : (
    <>
      <div className="flex justify-between items-center">
        <h3 className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
          MEDIA
        </h3>
        <span className="text-[9px] text-zinc-400 font-medium font-sans">
          {images.length}/10 images
        </span>
      </div>

      {/* Upload Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerFileInput}
        className={`border border-dashed p-8 text-center cursor-pointer transition-colors duration-200 flex flex-col items-center justify-center min-h-[160px] bg-[#FAF8F5]/30 ${
          isDragging
            ? 'border-[#B38B5D] bg-[#FAF8F5]/50'
            : 'border-[#E8E0D5] hover:border-[#B38B5D] hover:bg-[#FAF8F5]/10'
        }`}
      >
        <input
          type="file"
          id="image-file-input"
          multiple
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <Upload className="w-6 h-6 stroke-[1.5] text-zinc-400 mb-2" />
        <p className="text-[12px] text-zinc-500 font-medium">
          Click or drag images here
        </p>
      </div>

      {/* Thumbnail Display Grid */}
      <div className="flex flex-wrap gap-3 pt-2">
        {images.map((img, idx) => (
          <div
            key={idx}
            className="relative border border-[#E8E0D5] bg-[#E0E0E0] w-[60px] h-[90px] flex items-center justify-center overflow-hidden group"
          >
            <img
              src={img}
              alt={`Preview ${idx + 1}`}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            {idx === 0 && (
              <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[7px] font-bold text-center py-0.5 uppercase tracking-wider font-sans">
                Thumbnail
              </div>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveImage(idx);
              }}
              className="absolute right-0.5 top-0.5 bg-black/60 hover:bg-black text-white rounded-full p-0.5 transition-colors cursor-pointer"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        ))}
        {images.length === 0 && (
          <div className="border border-zinc-300 bg-[#E0E0E0] w-[60px] h-[90px] flex flex-col p-1.5 text-left text-zinc-500 select-none overflow-hidden">
            <span className="text-[9px] font-sans leading-none break-all text-zinc-600 font-medium">
              Thumbnail
            </span>
          </div>
        )}
        {images.length < 10 && (
          <button
            type="button"
            onClick={triggerFileInput}
            className="border border-zinc-300 bg-[#E0E0E0] w-[60px] h-[90px] hover:border-[#B38B5D] transition-colors flex items-center justify-center text-zinc-400 hover:text-zinc-600 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2]" />
          </button>
        )}
      </div>

      <p className="text-[10px] text-zinc-400 font-sans">
        Save the product to manage colors and additional images.
      </p>
    </>
  )}
</div>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd mei-admin && npx tsc --noEmit
```

Expected: no errors. Fix any type errors before proceeding.

- [ ] **Step 6: Smoke-test in the browser**

```bash
cd mei-admin && npm run dev
```

Navigate to `http://localhost:3000/products` → open any existing product to edit. Confirm the right column now shows "Colors" section and tabbed "All Media" / color tabs instead of the flat uploader. Open add product — confirm the flat uploader still shows with the "Save the product…" note.

- [ ] **Step 7: Commit**

```bash
cd mei-admin
git add components/products/ProductForm.tsx
git commit -m "feat: wire ColorList + MediaGallery into ProductForm edit mode"
```

---

## Task 2: Add product_colors to storefront DB types

**Files:**
- Modify: `src/lib/supabase/database.ts` (in `mei/`)

**Interfaces:**
- Produces: `Database["public"]["Tables"]["product_colors"]["Row"]` — used in Task 3

**Context:** The storefront's `database.ts` is a hand-maintained type file (not auto-generated). It is missing the `product_colors` table. The admin's equivalent has the same shape. The `product_media` row already exists in this file.

- [ ] **Step 1: Add the product_colors table type**

Open `src/lib/supabase/database.ts`. After the `product_media` block (around line 78), add:

```ts
      product_colors: {
        Row: { id: string; product_id: string; label: string; hex_code: string | null; swatch_image_url: string | null; sort_order: number; created_at: string; deleted_at: string | null }
        Insert: { id?: string; product_id: string; label: string; hex_code?: string | null; swatch_image_url?: string | null; sort_order?: number }
        Update: { label?: string; hex_code?: string | null; swatch_image_url?: string | null; sort_order?: number; deleted_at?: string | null }
      }
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd mei && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd mei
git add src/lib/supabase/database.ts
git commit -m "feat: add product_colors table type to storefront DB types"
```

---

## Task 3: Extend storefront Product type with colors and coloredMedia

**Files:**
- Modify: `src/types/index.ts` (in `mei/`)

**Interfaces:**
- Produces:
  ```ts
  type StorefrontColor = {
    id: string
    label: string
    hex_code: string | null
    swatch_image_url: string | null
    sort_order: number
  }
  // Added to Product:
  colors: StorefrontColor[]
  coloredMedia: { url: string; color_id: string | null }[]
  ```
- Consumed by: Task 4 (service mapper), Task 5 (ImageGallery), Task 6 (product page)

**Context:** `Product` in `src/types/index.ts` currently has `images: string[]` and `image_url`. We add two fields alongside (not replacing) for backward compat. `images` continues to serve all existing consumers (product cards, OG meta, etc.).

- [ ] **Step 1: Add StorefrontColor type and extend Product**

Open `src/types/index.ts`. Add the `StorefrontColor` type before the `Product` type, and add the two new fields to `Product`:

```ts
export type StorefrontColor = {
  id: string
  label: string
  hex_code: string | null
  swatch_image_url: string | null
  sort_order: number
}

export type Product = {
  id: string;
  name: string;
  slug: string;
  price: number;
  short_description: string | null;
  description: string | null;
  work_types: string[];
  status: ProductStatus;
  category_id: string | null;
  category: Pick<Category, "id" | "name" | "slug"> | null;
  image_url: string | null;
  images: string[];
  colors: StorefrontColor[];
  coloredMedia: { url: string; color_id: string | null }[];
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd mei && npx tsc --noEmit
```

Expected: errors on `_mapDbRowToProduct` (it doesn't return `colors`/`coloredMedia` yet) — these are fixed in Task 4. Any other errors fix now.

- [ ] **Step 3: Commit**

```bash
cd mei
git add src/types/index.ts
git commit -m "feat: add StorefrontColor type and colors/coloredMedia fields to Product"
```

---

## Task 4: Extend storefront products service to fetch and map colors

**Files:**
- Modify: `src/lib/services/products.ts` (in `mei/`)

**Interfaces:**
- Consumes: `StorefrontColor`, `Product` from `@/types` (Task 3)
- Consumes: `Database["public"]["Tables"]["product_colors"]["Row"]` (Task 2)
- Produces: `_mapDbRowToProduct` returning full `Product` including `colors` and `coloredMedia`

**Context:** The service has two SELECT strings (`SELECT` and `SELECT_INNER_CAT`) and one `ProductWithRelations` type. Both selects need `product_colors` added. The mapper needs to filter deleted colors, sort by `sort_order`, and build `coloredMedia` from the existing `product_media` join (which already selects `color_id` via the DB row, but the current SELECT only picks `url, sort_order, is_primary, deleted_at` — we need to also select `color_id`).

- [ ] **Step 1: Extend ProductWithRelations to include product_colors and color_id on media**

In `src/lib/services/products.ts`, find the `ProductWithRelations` type (around line 11). Replace it:

```ts
type ProductColorRow = Database["public"]["Tables"]["product_colors"]["Row"];

type ProductWithRelations = ProductRow & {
  categories: Pick<CategoryRow, "id" | "name" | "slug"> | null;
  product_media:
    | Pick<
        ProductMediaRow,
        "url" | "color_id" | "sort_order" | "is_primary" | "deleted_at"
      >[]
    | undefined;
  product_colors:
    | Pick<
        ProductColorRow,
        "id" | "label" | "hex_code" | "swatch_image_url" | "sort_order" | "deleted_at"
      >[]
    | undefined;
};
```

- [ ] **Step 2: Update both SELECT strings to include color_id in product_media and join product_colors**

Find the `SELECT` and `SELECT_INNER_CAT` constants (around line 69). Replace:

```ts
const SELECT =
  "*, categories(id, name, slug), product_media(url, color_id, sort_order, is_primary, deleted_at), product_colors(id, label, hex_code, swatch_image_url, sort_order, deleted_at)";

const SELECT_INNER_CAT =
  "*, categories!inner(id, name, slug), product_media(url, color_id, sort_order, is_primary, deleted_at), product_colors(id, label, hex_code, swatch_image_url, sort_order, deleted_at)";
```

- [ ] **Step 3: Update _mapDbRowToProduct to populate colors and coloredMedia**

Find `_mapDbRowToProduct` (around line 30). Replace the full function:

```ts
export function _mapDbRowToProduct(row: ProductWithRelations): Product {
  const activeMedia = (row.product_media ?? [])
    .filter((m) => m.deleted_at === null)
    .sort((a, b) => a.sort_order - b.sort_order);

  const images =
    activeMedia.length > 0
      ? activeMedia.map((m) => m.url)
      : row.image_url
      ? [row.image_url]
      : [];

  const coloredMedia = activeMedia.map((m) => ({
    url: m.url,
    color_id: m.color_id,
  }));

  const colors = (row.product_colors ?? [])
    .filter((c) => c.deleted_at === null)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c) => ({
      id: c.id,
      label: c.label,
      hex_code: c.hex_code,
      swatch_image_url: c.swatch_image_url,
      sort_order: c.sort_order,
    }));

  return {
    id: row.id,
    name: row.name,
    slug: row.slug ?? "",
    price: row.price,
    short_description: row.short_description,
    description: row.description,
    work_types: row.work_types ?? [],
    status: row.status,
    category_id: row.category_id,
    category: row.categories ?? null,
    image_url: row.image_url,
    images,
    colors,
    coloredMedia,
  };
}
```

- [ ] **Step 4: Verify TypeScript compiles with no errors**

```bash
cd mei && npx tsc --noEmit
```

Expected: no errors (the `Product` shape now matches what the mapper returns).

- [ ] **Step 5: Commit**

```bash
cd mei
git add src/lib/services/products.ts
git commit -m "feat: extend storefront products service to fetch and map product colors"
```

---

## Task 5: Rebuild ImageGallery with color swatch bar and dynamic thumbnails

**Files:**
- Modify: `src/components/product/ImageGallery.tsx` (in `mei/`)

**Interfaces:**
- Consumes:
  ```ts
  interface ImageGalleryProps {
    images: string[]
    coloredMedia?: { url: string; color_id: string | null }[]
    colors?: StorefrontColor[]
  }
  ```
- Produces: Updated `ImageGallery` component

**Context:** The current component has a hardcoded 4-slot grid with "Front view" / "Embroidery detail" labels and 2 grey placeholders. This is replaced with: main image → color swatch bar (conditional) → dynamic thumbnail strip (up to 4, with +N overflow). Filter logic: `null` activeColorId = show all; otherwise show images where `color_id === activeColorId` OR `color_id === null` (uncolored always visible). `StorefrontColor` is imported from `@/types`.

- [ ] **Step 1: Write the full updated ImageGallery component**

Replace the entire contents of `src/components/product/ImageGallery.tsx`:

```tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import type { StorefrontColor } from "@/types";

interface ImageGalleryProps {
  images: string[];
  coloredMedia?: { url: string; color_id: string | null }[];
  colors?: StorefrontColor[];
}

const isSupabaseUrl = (url?: string | null) =>
  !!url &&
  url.startsWith("https://") &&
  url.includes(".supabase.co/storage/v1/object/public/");

export default function ImageGallery({
  images,
  coloredMedia,
  colors,
}: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeColorId, setActiveColorId] = useState<string | null>(null);

  const allImages = (images || []).filter(Boolean);

  if (allImages.length === 0) {
    return (
      <div className="relative aspect-[3/4] w-full bg-[#faf8f5] border border-[#e8e0d5]/40 flex items-center justify-center">
        <span className="text-[#9a9a9a] text-xs uppercase tracking-wider font-semibold select-none font-inter">
          No Image Available
        </span>
      </div>
    );
  }

  // Derive visible images based on active color filter
  const visibleImages =
    !activeColorId || !coloredMedia
      ? allImages
      : coloredMedia
          .filter(
            (m) => m.color_id === activeColorId || m.color_id === null
          )
          .map((m) => m.url)
          .filter(Boolean);

  const displayImages = visibleImages.length > 0 ? visibleImages : allImages;
  const safeIndex = activeIndex < displayImages.length ? activeIndex : 0;

  const hasColors = colors && colors.length > 0;

  function handleColorClick(colorId: string | null) {
    setActiveColorId(colorId);
    setActiveIndex(0);
  }

  const thumbnails = displayImages.slice(0, 4);
  const overflowCount = displayImages.length > 4 ? displayImages.length - 4 : 0;

  return (
    <div className="space-y-4">
      {/* Main Image */}
      <div className="relative aspect-[3/4] w-full bg-[#faf8f5] border border-[#e8e0d5]/40">
        <Image
          src={displayImages[safeIndex]}
          alt="Product image"
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
          unoptimized={isSupabaseUrl(displayImages[safeIndex])}
        />
      </div>

      {/* Color Swatch Bar — only when colors exist */}
      {hasColors && (
        <div className="flex items-center gap-2 flex-wrap">
          {/* "All" pill */}
          <button
            type="button"
            onClick={() => handleColorClick(null)}
            className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest border transition-all cursor-pointer ${
              activeColorId === null
                ? "border-[#c9a465] text-[#c9a465] bg-white"
                : "border-[#e8e0d5] text-[#9a9a9a] bg-white hover:border-[#c9a465]"
            }`}
          >
            All
          </button>

          {colors!.map((color) => (
            <button
              key={color.id}
              type="button"
              onClick={() => handleColorClick(color.id)}
              title={color.label}
              className={`w-7 h-7 border-2 transition-all cursor-pointer flex-shrink-0 ${
                activeColorId === color.id
                  ? "border-[#c9a465]"
                  : "border-transparent hover:border-[#c9a465]/50"
              }`}
            >
              {color.swatch_image_url ? (
                <Image
                  src={color.swatch_image_url}
                  alt={color.label}
                  width={28}
                  height={28}
                  className="w-full h-full object-cover"
                  unoptimized={isSupabaseUrl(color.swatch_image_url)}
                />
              ) : (
                <span
                  className="block w-full h-full"
                  style={{
                    backgroundColor: color.hex_code ?? "#e8e0d5",
                  }}
                />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Thumbnails Row */}
      <div className="grid grid-cols-4 gap-3">
        {thumbnails.map((url, idx) => (
          <button
            key={`${url}-${idx}`}
            type="button"
            onClick={() => setActiveIndex(idx)}
            className={`relative h-20 border bg-white cursor-pointer transition-all duration-200 overflow-hidden ${
              safeIndex === idx
                ? "border-[#c9a465]"
                : "border-[#e8e0d5] hover:border-[#c9a465]"
            }`}
          >
            <Image
              src={url}
              alt={`View ${idx + 1}`}
              fill
              sizes="80px"
              className="object-cover"
              unoptimized={isSupabaseUrl(url)}
            />
            {/* +N overflow indicator on last slot */}
            {idx === 3 && overflowCount > 0 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-white text-xs font-bold font-inter">
                  +{overflowCount}
                </span>
              </div>
            )}
          </button>
        ))}

        {/* Fill remaining slots with empty placeholders */}
        {Array.from({ length: Math.max(0, 4 - thumbnails.length) }).map(
          (_, i) => (
            <div
              key={`empty-${i}`}
              className="h-20 bg-[#faf8f5] border border-[#e8e0d5]/40"
            />
          )
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd mei && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd mei
git add src/components/product/ImageGallery.tsx
git commit -m "feat: add color swatch bar and dynamic thumbnails to ImageGallery"
```

---

## Task 6: Pass colors and coloredMedia from product page to ImageGallery

**Files:**
- Modify: `src/app/shop/[slug]/page.tsx` (in `mei/`)

**Interfaces:**
- Consumes: `Product.colors`, `Product.coloredMedia` (Task 3)
- Consumes: updated `ImageGallery` props (Task 5)

**Context:** The product detail page at `src/app/shop/[slug]/page.tsx` fetches the product server-side and passes `product.images` to `ImageGallery`. The call is on line 137. We add the two new props.

- [ ] **Step 1: Update the ImageGallery call to pass the new props**

In `src/app/shop/[slug]/page.tsx`, find (around line 137):

```tsx
<ImageGallery images={product.images} />
```

Replace with:

```tsx
<ImageGallery
  images={product.images}
  coloredMedia={product.coloredMedia}
  colors={product.colors}
/>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd mei && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Smoke-test in the browser**

```bash
cd mei && npm run dev
```

Navigate to any product page on `http://localhost:3000`. Confirm:
- Products with no colors: gallery looks the same as before (no swatch bar, thumbnails show the images)
- Products with colors (if any exist in the DB): color swatch bar appears, clicking "All" or a swatch filters images appropriately
- Uncolored images always visible regardless of active swatch

- [ ] **Step 4: Commit**

```bash
cd mei
git add src/app/shop/[slug]/page.tsx
git commit -m "feat: pass product colors and coloredMedia to ImageGallery on product page"
```
