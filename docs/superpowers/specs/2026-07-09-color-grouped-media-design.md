# Color-Grouped Media — Admin & Storefront

**Date:** 2026-07-09  
**Scope:** mei-admin (ProductForm) + mei (storefront ImageGallery)  
**Tickets:** MEI-46 (implied — color-grouped image management)

---

## Problem

The database already supports color-grouped media (`product_colors` + `product_media.color_id`). The bulk CSV import populates this structure. But:

1. **Admin create/edit** — `ProductForm` uses a flat single-image uploader that ignores `product_media` and `product_colors` entirely.
2. **Storefront gallery** — `ImageGallery` renders a hardcoded 4-slot grid with "Front view" / "Embroidery detail" labels. No color switcher. All images shown in a flat list.

Both gaps mean admins can't manually manage color-grouped media, and customers can't filter images by color variant.

---

## Decisions

- **Admin create mode:** keep the flat single-image uploader. Colors and media require a `product_id` to exist first. After saving, the admin lands on the edit page where full color+media management is available. A helper note communicates this.
- **Admin edit mode:** replace the flat MEDIA card with `ColorList` + `MediaGallery` — both already exist and are tested, just not wired into `ProductForm`.
- **Media save strategy:** React Query mutations — no form-submit dependency. Media saves immediately on action (same pattern as Shopify, same pattern as the existing `RuleList` component in categories).
- **Storefront filter behavior:** clicking a color swatch shows that color's images **plus all uncolored images** (general shots are always visible). Clicking again or clicking "All" deselects.
- **Storefront backward compat:** products with no colors defined show the gallery as-is — no swatch bar rendered, no visual regression.

---

## Admin — ProductForm Changes

### Create mode (no `editId`)

No change to the media section structure. Replace the card header note to say:

> "Save the product to manage colors and additional images."

The existing single-image dropzone stays and continues to populate `image_url` as the primary fallback.

### Edit mode (`editId` present)

Replace the entire MEDIA card (Card 5, right column) with two stacked sections:

**Section A — COLORS**  
Mount `<ColorList productId={editId} />` directly.  
This gives: list of colors, Add Color button, edit/delete per color — all already implemented.

**Section B — MEDIA**  
Mount `<MediaGallery productId={editId} />` directly.  
This gives: "All Media" tab + one tab per color, upload per tab, drag-to-reorder, set-primary, soft-delete — all already implemented.

No changes needed to `ColorList`, `ColorFormDialog`, `MediaGallery`, `MediaGrid`, `MediaUploader`, or `MediaCard`. The wiring is purely in `ProductForm`.

### `handleSubmit` change

Remove the image upload logic from the edit flow (`uploadProductImage` call + `image_url` update on `updateProduct`). In edit mode, media is managed directly via `MediaGallery` mutations — not through the form submit. The `image_url` column on the product row continues to serve as the storefront fallback and is left unchanged on edit.

---

## Storefront — Data Layer Changes

### `services/product-colors.ts` (new file in mei)

A minimal read-only service to fetch colors for a product on the storefront:

```ts
export type StorefrontColor = {
  id: string
  label: string
  hex_code: string | null
  swatch_image_url: string | null
  sort_order: number
}

export async function getProductColors(productId: string): Promise<StorefrontColor[]>
```

Queries `product_colors` where `product_id = $1` and `deleted_at IS NULL`, ordered by `sort_order`.

### `types/index.ts` — extend `Product`

Add:
```ts
colors: StorefrontColor[]
```

### `lib/services/products.ts` — extend query and mapper

**SELECT clause:** add `product_colors(id, label, hex_code, swatch_image_url, sort_order, deleted_at)` to the join.

**`_mapDbRowToProduct`:** 
- Filter colors where `deleted_at IS NULL`, sort by `sort_order`
- Map `product_media` to include `color_id` in the mapped shape (currently only `url`, `sort_order`, `is_primary`, `deleted_at` are selected)
- Return `colors` on the Product

**`ImageWithColor` type (internal to mapper):**
```ts
type ImageWithColor = { url: string; color_id: string | null; sort_order: number }
```

The `images: string[]` field on `Product` stays unchanged (all media urls, sorted) for backward compat. The new `colors` field carries the color metadata. The gallery uses `color_id` from the media join to know which images belong to which color.

Since the `images` array and color-filtering both need `color_id`, extend `Product.images` to a richer type **or** add a parallel `coloredMedia` field. Prefer a parallel field to avoid breaking existing consumers of `images`:

```ts
coloredMedia: { url: string; color_id: string | null }[]
```

---

## Storefront — ImageGallery Redesign

**Props change:**
```ts
interface ImageGalleryProps {
  images: string[]             // unchanged — backward compat
  coloredMedia?: { url: string; color_id: string | null }[]
  colors?: StorefrontColor[]
}
```

**State:**
```ts
const [activeIndex, setActiveIndex] = useState(0)
const [activeColorId, setActiveColorId] = useState<string | null>(null)  // null = All
```

**Derived visible images:**
```ts
const visibleImages = !activeColorId
  ? (coloredMedia ?? images.map(url => ({ url, color_id: null }))).map(m => m.url)
  : (coloredMedia ?? [])
      .filter(m => m.color_id === activeColorId || m.color_id === null)
      .map(m => m.url)
```

When `activeColorId` changes, reset `activeIndex` to 0.

**Layout (top to bottom):**

1. **Main image** — unchanged `aspect-[3/4]`, shows `visibleImages[activeIndex]`

2. **Color swatch bar** — only rendered when `colors && colors.length > 0`:
   - "All" pill (active when `activeColorId === null`)
   - One swatch per color: circle showing `hex_code` background, or small `swatch_image_url` image if present; tooltip/label on hover; gold ring when active
   - Gap between pills: `gap-2`, centered

3. **Thumbnails row** — replaces the hardcoded 4-slot grid:
   - Shows up to first 4 of `visibleImages` as thumbnail buttons
   - If more than 4, show `+N` indicator on slot 4
   - Gold border on active thumbnail
   - No hardcoded "Front view" / "Embroidery detail" labels — plain thumbnails only

**Storefront page (`app/shop/[slug]/page.tsx`):**

Pass the new props:
```tsx
<ImageGallery
  images={product.images}
  coloredMedia={product.coloredMedia}
  colors={product.colors}
/>
```

---

## File Touch List

**mei-admin:**
- `components/products/ProductForm.tsx` — wire ColorList + MediaGallery in edit mode; add note in create mode; remove image upload from edit submit

**mei:**
- `src/lib/services/products.ts` — extend SELECT, mapper, ProductWithRelations type
- `src/lib/services/product-colors.ts` — new read-only storefront colors service
- `src/types/index.ts` — add `colors` and `coloredMedia` to `Product`
- `src/components/product/ImageGallery.tsx` — color swatch bar + dynamic thumbnails
- `src/app/shop/[slug]/page.tsx` — pass new props to ImageGallery

**No changes needed:**
- `components/products/colors/*` — already complete
- `components/products/media/*` — already complete
- `hooks/use-product-colors.ts` — already complete
- `services/product-colors.ts` (admin) — already complete

---

## Out of Scope

- Swatch image upload in `ColorFormDialog` (hex_code is sufficient for now)
- Drag-to-reorder colors on admin
- Color-based pricing or availability
- Mobile swipe gestures on storefront gallery
