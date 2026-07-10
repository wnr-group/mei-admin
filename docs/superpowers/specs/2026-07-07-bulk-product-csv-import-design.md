# Bulk Product Import: CSV Template + Upload + Validation Preview

**Ticket:** MEI-42
**Date:** 2026-07-07
**Status:** Approved for planning

## Summary

Add a bulk-import entry point in the admin products section. Admins download a
CSV template, fill it out (one row per product, or one row per color for
multi-color products), upload it, and see a grouped, validated preview before
importing. **This ticket covers template download, upload, parsing, grouping,
and validation preview only — no rows are written to the database.** Clicking
"Import" on a valid file shows a notice that the write-to-DB step isn't
implemented yet; that is a separate follow-up ticket.

## Scope

**In scope:**
- Bulk Import entry point on the Products list page
- Downloadable CSV template with example single-color and multi-color products
- Written format guide + annotated example table explaining the CSV convention
- Client-side CSV parsing (PapaParse)
- Grouping parsed rows into products/colors/images
- Field-level and file-level validation
- Grouped preview UI (product → color → image tree) with inline errors
- Import button, correctly enabled/disabled based on validation state

**Out of scope (future ticket):**
- Actually writing parsed/validated products, colors, and media to Supabase
- Checking imported product names against existing DB products for duplicates
- Any server-side/API-route CSV handling — this is 100% client-side parsing

## Data Model Recap

Existing tables this import conceptually targets (not written to in this
ticket):

- `products`: `name`, `category_id`, `price`, `work_types text[]`, `status
  ('PUBLISHED'|'DRAFT')`, `short_description`, `description`, `image_url`
- `product_colors`: `product_id`, `label`, (no CSV column for `hex_code`/
  `swatch_image_url` in this ticket)
- `product_media`: `product_id`, `color_id` (nullable), `url`, `is_primary`,
  `sort_order` — a row with `color_id = null` and `is_primary = true` is the
  product's primary image; a row with `color_id` set belongs to that color

`WORK_TYPES` accepted values (from `components/products/ProductForm.tsx`):
`Aari, Zardozi, Mirror, Cut, Thread, Tailoring, Kundan` (case-insensitive
match against this list).

## CSV Format

**Columns, in order:**

```
name, category_name, price, status, work_types, short_description, description, color_label, image_url
```

**Multi-row-per-product convention:** Rows sharing the same `name` (exact
string match) belong to the same product. Within a group, **the first row to
appear in the file** ("the anchor row") supplies the product-level fields:
`category_name`, `price`, `status`, `work_types`, `short_description`,
`description`. Every other row in the group only needs `name` +
(`color_label` and/or `image_url`) — other columns on non-anchor rows are
ignored if present.

- A row with a blank `color_label` contributes its `image_url` as a **primary
  product image** (`product_media` with `color_id = null`).
- A row with a non-blank `color_label` contributes its `image_url` to that
  color (creating the color the first time its label is seen for this
  product). The same `color_label` can repeat across multiple rows for the
  same product to attach multiple images to one color.

**Field reference:**

| Column | Required | Format / accepted values |
|---|---|---|
| `name` | Every row | Non-empty string; used as the grouping key |
| `category_name` | Anchor row only | Must case-insensitively match an existing category's `name` |
| `price` | Anchor row only | Non-negative number (e.g. `45000` or `45000.00`) |
| `status` | Anchor row only | `PUBLISHED` or `DRAFT`, case-insensitive |
| `work_types` | Optional | Semicolon-separated list, e.g. `Zardozi;Kundan`; each value must match `WORK_TYPES` (case-insensitive) |
| `short_description` | Optional | ≤300 characters |
| `description` | Optional | Free text |
| `color_label` | Optional | Any string; blank = primary image row |
| `image_url` | Optional | Plain URL string, used as-is — no format validation in this ticket |

**Template file contents:** two example products —
1. A single-image product: one row, blank `color_label`, one `image_url`.
2. A multi-color product: three rows sharing one `name` — one color with a
   single image, another color with two rows (two images), demonstrating
   both the color-image link and the repeated-color-label-for-multiple-images
   convention.

## Parsing & Validation Pipeline

Pure, framework-free modules under `lib/csv-import/`, unit-tested with
Vitest:

- **`parse.ts`** — wraps PapaParse (`header: true, skipEmptyLines: true`) to
  turn CSV text into raw row objects. Surfaces a file-level error if the
  parsed header row doesn't match the expected column set.
- **`group.ts`** — walks raw rows in file order, groups by `name` (first
  occurrence = anchor), splits each group's rows into: shared fields (from
  the anchor), a list of colors (in first-seen order) each with their image
  URLs, and a list of primary (non-color) images. Rows with a blank `name`
  are collected separately as "unassigned rows" (can't be grouped).
- **`validate.ts`** — given the loaded category list, checks each group:
  missing/malformed anchor fields (`category_name`, `price`, `status`),
  unknown category name, unrecognized `work_types` values. Produces a
  `ProductGroup` with an attached `errors: RowError[]` (empty if valid).
- **`template.ts`** — generates the template CSV string (as plain text, no
  PapaParse needed for writing since the example data has no special
  characters to escape).

**Validation error tiers:**
- **File-level** (blocks any preview): unrecognized header row → single
  banner, no per-row detail. Empty file / header-only file → friendly empty
  state.
- **Row/group-level**: attached to the specific field on the specific
  product group, shown inline in that product's preview card. A product
  group with any error is "invalid"; the whole import is blocked from
  proceeding (Import disabled) if any group is invalid.
- Fully blank CSV rows (trailing empty lines) are silently skipped, not
  treated as errors.
- **Unassigned rows** (non-blank row with a blank `name`): treated the same
  as an invalid product group for blocking purposes — their presence
  disables Import — and are rendered in their own "Unassigned Rows" card at
  the bottom of the preview (below all grouped product cards), each with a
  "missing name — cannot be grouped into a product" error.

## UI

**Entry point:** Products list page (`app/(app)/products/page.tsx`) gets a
secondary "BULK IMPORT" button next to the existing gold "ADD PRODUCT"
button, linking to `/products/import`.

**Page (`app/(app)/products/import/page.tsx`):**

1. **Header** — breadcrumb (`Products / Bulk Import`), title, "Download CSV
   Template" button.
2. **Format Guide card** — collapsible, expanded by default (same collapse
   pattern as the SEO card in `ProductForm.tsx`). Contains: written
   explanation of the multi-row convention, a column reference table
   (required?, format/accepted values), and an annotated example showing a
   single-color and multi-color product side by side.
3. **Upload card** — drag-and-drop `.csv` dropzone, reusing the visual
   pattern from `ProductForm`'s media uploader.
4. **Preview section** (after a file parses) — `PreviewTree` of
   `ProductPreviewCard`s (one card per product group) plus a summary line,
   e.g. "12 products, 2 with errors". Each card is an indented tree:

   ```
   ▶ Product: Bridal Lehenga A2         [Category: Bridal Lehengas]  [₹45,000]  [DRAFT]
      ├─ Color: Red
      │    └─ image: red-front.jpg
      ├─ Color: Gold
      │    ├─ image: gold-front.jpg
      │    └─ image: gold-back.jpg

   ▶ Product: Evening Gown B1  ⚠ 2 errors
      ✘ price: "abc" is not a valid number
      ✘ category_name: "Gownz" does not match any category
      (no colors — primary image only)
      └─ image: gown-b1.jpg
   ```

5. **Unassigned Rows card** (only rendered if any exist) — appears below the
   product cards, listing each non-blank row that had a blank `name`, with
   its "missing name — cannot be grouped into a product" error.
6. **Footer bar** — Cancel (back to `/products`) + Import button.

**States:** empty (no file) → parsing (brief spinner) → previewing (tree) →
file-level error (banner, no tree, re-upload prompt).

**Import button:** disabled when no file uploaded, a file-level error
exists, or any product group has validation errors. When enabled and
clicked, shows a notice ("Bulk import isn't available yet — this previews
and validates only") rather than performing any write — actual DB writes are
a separate follow-up ticket.

## File/Component Structure

```
lib/csv-import/
  parse.ts
  group.ts
  validate.ts
  template.ts
  types.ts

components/products/import/
  FormatGuide.tsx
  ImportDropzone.tsx
  PreviewTree.tsx
  ProductPreviewCard.tsx

app/(app)/products/import/page.tsx
```

## Testing

- Unit tests (Vitest) for `parse.ts`, `group.ts`, `validate.ts` covering:
  header mismatch, empty file, single-color product, multi-color product
  (including repeated color label for multiple images), missing
  name/price/category/status, unknown category, invalid status, malformed
  price, unrecognized work type, blank trailing rows.
- Manual verification: download template → re-upload unmodified → confirm
  clean preview with both example products rendered correctly.

## Open Questions / Follow-ups

- Actual DB-writing import execution: separate ticket.
- Whether to check parsed product names against existing DB products for
  duplicates: separate ticket (out of scope here since nothing is written).
