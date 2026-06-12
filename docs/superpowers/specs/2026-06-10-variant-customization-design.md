# MEI Bridal Couture — Variant & Customization System Design

**Date:** 2026-06-10  
**Status:** Approved — ready for implementation planning  
**Branch:** feature/supabase-backend-integration  

---

## 1. Problem Statement

The current product model is single-image, single-price, with no variant support. MEI Bridal Couture requires:

- Multiple colors per product with per-color image galleries
- Multiple sizes (standard + custom) per product
- Customization types: Unstitched, Semi-Stitched, Standard Size, Custom Tailored
- Blouse-specific stitching options conditional on customization type
- Measurement collection driven by product, category, and customization type
- Variant-level pricing, stock, and SKU management
- Historical order accuracy via immutable snapshots
- Backward-compatible rollout (storefront reads same Supabase instance, no API gateway)

---

## 2. Architecture Decisions

| Decision | Choice | Reason |
|---|---|---|
| Size data | Normalized `size_systems` + `size_system_entries` tables | Reusable charts, reference measurements, future international sizing |
| Color data | Normalized `product_colors` table | Rich swatch data, per-color galleries require FK |
| Customization | Top-level `customization_type` enum; blouse config nested | Avoid variant explosion from blouse stitching as independent axis |
| Measurement fields | Fixed canonical enum + configurable templates | Bridal vocabulary is stable; avoid admin-driven field-builder complexity |
| Order items | Hybrid: `variant_id FK` (nullable) + `product_snapshot JSONB` + `variant_snapshot JSONB` | Relational analytics + immutable history |
| Migration strategy | Additive only in Phase 1; destructive cleanup only after storefront verified | Shared Supabase instance, storefront under development |
| Variant creation | Explicit-only; no cartesian auto-generation | Prevents combinatorial explosion |
| Storefront isolation | Compatibility views `v_products_storefront`, `v_product_colors_storefront` | Decouple storefront from raw table evolution |
| Transactional flows | Supabase Edge Functions for create-order, bulk-create-variants | Multi-table atomicity, stock decrement race condition prevention |

---

## 3. Complete Database Schema

### 3.1 New Enums (Migration 010)

```sql
CREATE TYPE customization_type AS ENUM (
  'UNSTITCHED', 'SEMI_STITCHED', 'STANDARD_SIZE', 'CUSTOM_TAILORED'
);

CREATE TYPE measurement_field_key AS ENUM (
  'bust', 'upper_bust', 'under_bust', 'waist', 'hip', 'shoulder',
  'blouse_length', 'sleeve_length', 'lehenga_length', 'bottom_length',
  'dupatta_length', 'torso_length', 'back_length', 'front_length',
  'height', 'armhole', 'neck_depth_front', 'neck_depth_back',
  'neck_circumference', 'bicep', 'wrist', 'elbow',
  'inseam', 'thigh', 'knee', 'calf', 'ankle'
);

CREATE TYPE media_type AS ENUM ('IMAGE', 'VIDEO');
```

### 3.2 Size Systems (Migration 011)

```sql
CREATE TABLE size_systems (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE TABLE size_system_entries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id  UUID NOT NULL REFERENCES size_systems(id),
  label      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  bust_cm    NUMERIC(5,1),
  waist_cm   NUMERIC(5,1),
  hip_cm     NUMERIC(5,1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (system_id, label)
);
```

### 3.3 Product Colors (Migration 012)

```sql
CREATE TABLE product_colors (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID NOT NULL REFERENCES products(id),
  label            TEXT NOT NULL,
  hex_code         TEXT,
  swatch_image_url TEXT,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ
);
```

### 3.4 Product Variants + Products Additions (Migration 013)

```sql
-- Additive extensions to products
ALTER TABLE products
  ADD COLUMN product_code                  TEXT,
  ADD COLUMN has_variants                  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN size_system_id                UUID REFERENCES size_systems(id),
  ADD COLUMN supported_customization_types customization_type[] NOT NULL DEFAULT '{}';

-- Backfill product_code, then enforce constraints
UPDATE products SET product_code = 'MEI-' || UPPER(LEFT(REGEXP_REPLACE(name, '\s+', '', 'g'), 6))
  || '-' || UPPER(SUBSTRING(id::TEXT, 1, 4))
  WHERE product_code IS NULL;
ALTER TABLE products ADD CONSTRAINT products_product_code_key UNIQUE (product_code);
ALTER TABLE products ALTER COLUMN product_code SET NOT NULL;

-- Core variant table
CREATE TABLE product_variants (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id         UUID NOT NULL REFERENCES products(id),
  color_id           UUID REFERENCES product_colors(id),
  size_entry_id      UUID REFERENCES size_system_entries(id),
  size_label         TEXT,
  customization_type customization_type NOT NULL,
  sku                TEXT UNIQUE,
  price_override     NUMERIC(12,2),
  stock_quantity      INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  track_inventory     BOOLEAN NOT NULL DEFAULT false,
  allow_backorder     BOOLEAN NOT NULL DEFAULT true,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
  is_available        BOOLEAN NOT NULL DEFAULT true,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_by          UUID REFERENCES auth.users(id),
  updated_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);

CREATE TRIGGER set_product_variants_updated_at
  BEFORE UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Explicit partial unique index (no UNIQUE NULLS NOT DISTINCT)
CREATE UNIQUE INDEX idx_pv_unique_combination
  ON product_variants (
    product_id,
    COALESCE(color_id::TEXT,      'NO_COLOR'),
    COALESCE(size_entry_id::TEXT, 'NO_SIZE'),
    customization_type
  )
  WHERE deleted_at IS NULL;
```

**Effective price rule:** `COALESCE(variant.price_override, product.price)`

**Inventory semantics:**
- `track_inventory = false` → made-to-order; stock_quantity ignored
- `allow_backorder = true` → orderable even at zero stock
- `low_stock_threshold` → admin alert boundary

### 3.5 Product Media (Migration 014)

```sql
CREATE TABLE product_media (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     UUID NOT NULL REFERENCES products(id),
  color_id       UUID REFERENCES product_colors(id),
  variant_id     UUID REFERENCES product_variants(id),
  url            TEXT NOT NULL,
  alt_text       TEXT,
  is_primary     BOOLEAN NOT NULL DEFAULT false,
  media_type     media_type NOT NULL DEFAULT 'IMAGE',
  thumbnail_url  TEXT,
  video_provider TEXT,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_by     UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ
);

-- One primary per product scope (no color)
CREATE UNIQUE INDEX idx_pm_primary_product
  ON product_media (product_id)
  WHERE is_primary = true AND color_id IS NULL AND deleted_at IS NULL;

-- One primary per color scope
CREATE UNIQUE INDEX idx_pm_primary_color
  ON product_media (product_id, color_id)
  WHERE is_primary = true AND color_id IS NOT NULL AND deleted_at IS NULL;
```

**Media hierarchy (resolution order):**
1. `variant_id` set → variant-specific
2. `color_id` set, `variant_id` NULL → color gallery
3. Both NULL → product-level (all variants)

### 3.6 Measurement Templates (Migration 015)

```sql
CREATE TABLE measurement_templates (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL,
  category_id        UUID REFERENCES categories(id),
  product_id         UUID REFERENCES products(id),
  customization_type customization_type,
  version            INTEGER NOT NULL DEFAULT 1,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  created_by         UUID REFERENCES auth.users(id),
  updated_by         UUID REFERENCES auth.users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ
);

CREATE TABLE measurement_template_fields (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES measurement_templates(id),
  field_key   measurement_field_key NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT false,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  help_text   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_id, field_key)
);
```

**Template resolution priority (most specific wins):**
1. `product_id` + `customization_type` (both match)
2. `product_id` only
3. `category_id` + `customization_type`
4. `category_id` only
5. Both NULL (global default)

**Versioning strategy:**
- **Non-structural change** (sort_order, help_text, is_required): increment `version` in-place on existing row.
- **Structural change** (field added or removed): create new row (`version + 1`, `is_active = true`), set old row `is_active = false`. Preserves field history without deleting records.
- Snapshots capture `measurement_template_id` + `measurement_template_version`.

### 3.7 Blouse Configurations (Migration 016)

```sql
CREATE TABLE blouse_configurations (
  id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id                     UUID NOT NULL REFERENCES products(id),
  customization_type             customization_type,
  includes_blouse                BOOLEAN NOT NULL DEFAULT true,
  -- Valid values: 'STITCHED', 'UNSTITCHED' only. Enforced at application layer.
  stitching_options              TEXT[] NOT NULL DEFAULT '{"STITCHED","UNSTITCHED"}',
  blouse_measurement_template_id UUID REFERENCES measurement_templates(id),
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique index (consistent with variant uniqueness strategy)
CREATE UNIQUE INDEX idx_bc_unique_combination
  ON blouse_configurations (
    product_id,
    COALESCE(customization_type::TEXT, 'ALL_TYPES')
  );
```

### 3.8 order_items Additions (Migration 017)

```sql
ALTER TABLE order_items
  ADD COLUMN variant_id       UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  ADD COLUMN product_snapshot JSONB,
  ADD COLUMN variant_snapshot JSONB;
```

**product_snapshot structure:**
```json
{ "id": "uuid", "name": "Noor Lehenga", "category": "Lehenga", "base_price": 45000 }
```

**variant_snapshot structure:**
```json
{
  "variant_name": "Ivory / 38 / Standard Size",
  "color": "Ivory White", "hex_code": "#FFFFF0",
  "size": "38", "customization_type": "STANDARD_SIZE",
  "sku": "NOOR-IVO-38-ST", "price": 45000,
  "blouse_stitching": "STITCHED",
  "measurement_template_id": "uuid",
  "measurement_template_version": 2,
  "measurements": { "bust": 36, "waist": 30 }
}
```

### 3.9 order_item_measurements (Migration 017, continued)

```sql
CREATE TABLE order_item_measurements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  field_key     measurement_field_key NOT NULL,
  value_cm      NUMERIC(6,1) NOT NULL CHECK (value_cm > 0),
  notes         TEXT,
  recorded_by   UUID REFERENCES auth.users(id),
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_item_id, field_key)
);
```

### 3.10 Performance Indexes (Migration 018)

```sql
CREATE INDEX idx_pv_product       ON product_variants(product_id)               WHERE deleted_at IS NULL;
CREATE INDEX idx_pv_color         ON product_variants(color_id)                  WHERE deleted_at IS NULL;
CREATE INDEX idx_pv_available     ON product_variants(product_id, is_available)  WHERE deleted_at IS NULL;
CREATE INDEX idx_pc_product       ON product_colors(product_id)                  WHERE deleted_at IS NULL;
CREATE INDEX idx_pm_product       ON product_media(product_id)                   WHERE deleted_at IS NULL;
CREATE INDEX idx_pm_color         ON product_media(product_id, color_id)         WHERE deleted_at IS NULL;
CREATE INDEX idx_mt_category      ON measurement_templates(category_id)           WHERE deleted_at IS NULL;
CREATE INDEX idx_mt_product       ON measurement_templates(product_id)            WHERE deleted_at IS NULL;
CREATE INDEX idx_mtf_template     ON measurement_template_fields(template_id);
CREATE INDEX idx_sse_system       ON size_system_entries(system_id, sort_order)  WHERE deleted_at IS NULL;
CREATE INDEX idx_oi_variant       ON order_items(variant_id);
CREATE INDEX idx_pv_type          ON product_variants(product_id, customization_type) WHERE deleted_at IS NULL;
```

### 3.11 RLS Policies (Migration 019)

All new tables enable RLS. Pattern follows existing `is_admin()` function.

| Table | Public SELECT | Admin CRUD |
|---|---|---|
| `product_colors` | Yes (deleted_at IS NULL) | Full |
| `product_variants` | Yes (available + not deleted) | Full |
| `product_media` | Yes (deleted_at IS NULL) | Full |
| `size_systems` | Yes | Full |
| `size_system_entries` | Yes | Full |
| `measurement_templates` | No | Full |
| `measurement_template_fields` | No | Full |
| `blouse_configurations` | No | Full |
| `order_item_measurements` | No | Full |

### 3.12 DB Functions (Migration 019, continued)

```sql
CREATE OR REPLACE FUNCTION generate_variant_sku(
  p_product_code TEXT,
  p_color        TEXT,
  p_size         TEXT,
  p_type         customization_type
) RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  type_code TEXT := CASE p_type
    WHEN 'UNSTITCHED'      THEN 'UN'
    WHEN 'SEMI_STITCHED'   THEN 'SS'
    WHEN 'STANDARD_SIZE'   THEN 'ST'
    WHEN 'CUSTOM_TAILORED' THEN 'CT'
  END;
BEGIN
  RETURN UPPER(
    p_product_code || '-' ||
    LEFT(REGEXP_REPLACE(COALESCE(p_color, 'DEF'), '\s+', '', 'g'), 3) || '-' ||
    REGEXP_REPLACE(COALESCE(p_size, 'STD'), '\s+', '', 'g') || '-' ||
    type_code
  );
END; $$;
```

### 3.13 Compatibility Views (Migration 020)

```sql
CREATE OR REPLACE VIEW v_products_storefront AS
SELECT
  p.*,
  COALESCE(
    (SELECT pm.url FROM product_media pm
     WHERE pm.product_id = p.id AND pm.is_primary = true
       AND pm.color_id IS NULL AND pm.deleted_at IS NULL LIMIT 1),
    p.image_url
  ) AS primary_image_url,
  COALESCE(
    (SELECT MIN(COALESCE(pv.price_override, p.price))
     FROM product_variants pv
     WHERE pv.product_id = p.id AND pv.deleted_at IS NULL AND pv.is_available = true),
    p.price
  ) AS effective_min_price
FROM products p WHERE p.deleted_at IS NULL;

CREATE OR REPLACE VIEW v_product_colors_storefront AS
SELECT
  pc.*,
  (SELECT pm.url FROM product_media pm
   WHERE pm.product_id = pc.product_id AND pm.color_id = pc.id
     AND pm.is_primary = true AND pm.deleted_at IS NULL LIMIT 1) AS primary_image_url
FROM product_colors pc WHERE pc.deleted_at IS NULL;
```

### 3.14 Seed Data (Migration 021)

```sql
INSERT INTO size_systems (name, description) VALUES
  ('MEI Standard', 'Indian numeric sizing based on bust measurement'),
  ('Blouse Sizes',  'Standard blouse sizes for choli/blouse pieces'),
  ('Free Size',     'One size fits all with adjustment allowance');

INSERT INTO size_system_entries (system_id, label, sort_order, bust_cm, waist_cm, hip_cm)
SELECT s.id, v.label, v.sort_order, v.bust, v.waist, v.hip
FROM size_systems s,
  (VALUES ('34',0,86.0,68.0,91.0),('36',1,91.0,73.0,96.0),
          ('38',2,96.0,78.0,101.0),('40',3,101.0,83.0,106.0),
          ('42',4,106.0,88.0,111.0),('44',5,111.0,93.0,116.0)) AS v(label,sort_order,bust,waist,hip)
WHERE s.name = 'MEI Standard';

INSERT INTO size_system_entries (system_id, label, sort_order)
SELECT id, 'Free Size', 0 FROM size_systems WHERE name = 'Free Size';
```

### 3.15 Backfill (Migration 022)

```sql
-- One default STANDARD_SIZE variant per existing product (no cartesian expansion)
INSERT INTO product_variants (
  product_id, customization_type, size_label, sku,
  price_override, stock_quantity, track_inventory, is_available
)
SELECT
  p.id,
  'STANDARD_SIZE',
  'Standard',
  generate_variant_sku(p.product_code, NULL, 'STD', 'STANDARD_SIZE'),
  NULL,
  0,
  false,
  true
FROM products p WHERE p.deleted_at IS NULL
ON CONFLICT DO NOTHING;

UPDATE products SET has_variants = true WHERE deleted_at IS NULL;
```

---

## 4. Storage Structure

```
product-images/ (public bucket)
  products/{productId}/                          -- product-level (existing)
  products/{productId}/colors/{colorId}/         -- color gallery (new)
  products/{productId}/colors/{colorId}/swatch   -- swatch image (new)
```

Existing storage RLS (`(storage.foldername(name))[1] = 'products'`) already covers deeper paths. No policy changes needed.

**Backward compat:** `products.image_url` continues to work. Phase 3 migration backfills a `product_media` row from `image_url` before the column is deprecated.

---

## 5. Service Layer

### New Services

| File | Key Functions |
|---|---|
| `services/product-colors.ts` | `getProductColors`, `createColor`, `updateColor`, `deleteColor`, `uploadSwatch` |
| `services/product-variants.ts` | `getProductVariants`, `createVariant`, `updateVariant`, `deleteVariant`, `getEffectivePrice` |
| `services/product-media.ts` | `getProductMedia`, `uploadMedia`, `reorderMedia`, `setPrimary`, `deleteMedia` |
| `services/size-systems.ts` | `getSizeSystems`, `getSizeSystemEntries`, `createSystem`, `createEntry`, `getSizeChart` |
| `services/measurement-templates.ts` | `getTemplates`, `createTemplate`, `updateTemplate`, `getTemplateFields`, `resolveTemplate` |
| `services/blouse-config.ts` | `getBlouseConfig`, `upsertBlouseConfig` |

### Enhanced Services

| File | Changes |
|---|---|
| `services/products.ts` | Add `getProductWithVariants(id)` joining colors, variants, media |
| `services/storage.ts` | Add `uploadColorSwatch(file, productId, colorId)`, `uploadProductMedia(file, productId, colorId?)` |
| `services/orders.ts` | Add `buildVariantSnapshot(variantId, measurements?)`, write `order_item_measurements` |

### Edge Functions

| Function | Trigger | Responsibility |
|---|---|---|
| `supabase/functions/create-order/` | POST from storefront checkout | Atomic: orders + order_items + order_item_measurements + stock decrement + snapshots |
| `supabase/functions/bulk-create-variants/` | Admin bulk create | Explicit tuple input, SKU collision check, audit log |
| `supabase/functions/resolve-measurement-template/` | Storefront + admin | Priority resolution, cacheable |
| `supabase/functions/set-primary-media/` | Admin media management | Atomic: unset existing primary → set new primary in single transaction; race-condition sensitive |

**Operational rule — stock decrement:** No client-side code may directly decrement `product_variants.stock_quantity`. All stock decrements must go through the `create-order` edge function which uses `UPDATE ... WHERE stock_quantity > 0` with a row-level lock. Violation of this rule risks overselling made-to-order inventory.

---

## 6. TanStack Query Architecture

```typescript
export const queryKeys = {
  products: {
    list:         (f)  => ['products', 'list', f]                       as const,
    detail:       (id) => ['products', id]                               as const,
    variants:     (id) => ['products', id, 'variants']                   as const,
    colors:       (id) => ['products', id, 'colors']                     as const,
    media:        (id, colorId?) => ['products', id, 'media', colorId ?? 'all'] as const,
    blouseConfig: (id) => ['products', id, 'blouse-config']              as const,
  },
  sizeSystems: {
    all:     ()   => ['size-systems']                as const,
    entries: (id) => ['size-systems', id, 'entries'] as const,
  },
  measurementTemplates: {
    resolved: (pid, cid, type) => ['mt', 'resolved', pid, cid, type] as const,
    fields:   (tid)            => ['mt', tid, 'fields']               as const,
  },
}
```

**Invalidation rules:**
- Variant create/update/delete → `['products', id, 'variants']`
- Color create/update → `['products', id, 'colors']` + `['products', id, 'variants']`
- Media upload/reorder → `['products', id, 'media', colorId]`
- Template change → `['mt', 'resolved', ...]`

**Optimistic updates:** variant stock changes and media reorder. All mutations: `onError` → rollback context.

---

## 7. Admin UI Architecture

### Route Additions

```
app/(app)/
  products/
    page.tsx               -- existing list + quick-create drawer (no change)
    [id]/edit/page.tsx     -- NEW: tabbed product editor
  settings/
    size-systems/page.tsx             -- NEW
    measurement-templates/page.tsx    -- NEW
```

### Product Edit Page — 5 Tabs

| Tab | Content |
|---|---|
| Basic Info | name, category, price, work_types (simplified free text), description, status, product_code |
| Colors & Variants | Color CRUD + VariantMatrix (explicit-only cells) |
| Media Gallery | Per-color image grid, upload, drag-reorder, set primary |
| Customization | Size system select, enabled customization types, blouse config |
| Measurements | Template assignment per customization type |

### Component List

```
components/products/
  ColorEditor.tsx               -- color CRUD + swatch upload
  VariantMatrix.tsx             -- explicit grid (colors × sizes × types)
  VariantEditor.tsx             -- single variant drawer
  MediaGallery.tsx              -- drag-reorder + upload + primary selection
  BlouseConfigForm.tsx          -- per-type blouse options
  MeasurementTemplateAssign.tsx -- template picker per customization type

components/settings/
  SizeSystemEditor.tsx          -- system CRUD + entries table
  SizeChartTable.tsx            -- size → bust/waist/hip display
  MeasurementTemplateEditor.tsx -- template + field picker from enum
```

### Work Types UI Change

Remove hardcoded `['ZARDOZI', 'AARI', ...]` datalist. Replace with plain free-text tag input (type + Enter). No schema change. `work_types TEXT[]` stays.

---

## 8. Storefront Integration Strategy

**Phase 3 storefront migration targets:**

1. Replace `products.image_url` reads with query on `v_products_storefront.primary_image_url`
2. Replace `products.price` reads with `v_products_storefront.effective_min_price`
3. Add color swatch selector → query `v_product_colors_storefront`
4. Add size selector → query `size_system_entries` via `products.size_system_id`
5. Add customization type selector → driven by `products.supported_customization_types`
6. Measurement form → driven by `resolve-measurement-template` edge function
7. Order creation → call `create-order` edge function with `variant_id` + measurements

Storefront never queries `product_variants` directly during transition. It reads compatibility views until migration is verified.

**Future international expansion:** `size_systems` already supports region-based size charts without schema changes. Adding an "EU Standard" or "US Standard" system requires only new rows in `size_systems` + `size_system_entries`, and assigning products to the appropriate system. No migrations needed.

---

## 9. Execution Roadmap

### Phase 1 — Schema Foundation (Week 1)

- [ ] Migrations 010–022 (enums, tables, indexes, RLS + DB functions, compat views, seed, backfill)
- [ ] Deploy to Supabase (staging first)

### Phase 1.5 — QA Verification (Week 1, after migrations)

Tests before any admin UI work:

- [ ] All tables/columns/types present
- [ ] Anon SELECT succeeds on `product_variants`, `product_colors`, `product_media`, size tables
- [ ] Anon INSERT/UPDATE/DELETE rejected on all tables
- [ ] Admin full CRUD on all tables
- [ ] Duplicate (product, color, size, type) → unique index violation
- [ ] Soft-deleted + new same-combo → allowed (index respects `WHERE deleted_at IS NULL`)
- [ ] Two `is_primary=true` same scope → unique index violation
- [ ] `generate_variant_sku('NOOR','Ivory White','38','STANDARD_SIZE')` → `NOOR-IVO-38-ST`
- [ ] `v_products_storefront` returns `primary_image_url` (from `image_url` fallback) and `effective_min_price`
- [ ] Existing storefront queries on `products` table unchanged

### Phase 2 — Service + Hook Layer (Week 1–2)

- [ ] New services: product-colors, product-variants, product-media, size-systems, measurement-templates, blouse-config
- [ ] Enhanced services: products, storage, orders
- [ ] New hooks for all services
- [ ] Edge functions: create-order, bulk-create-variants, resolve-measurement-template

### Phase 3 — Admin UI Foundation (Week 2)

- [ ] Product detail page route + tab shell (`/products/[id]/edit`)
- [ ] Tab 1: Basic Info (migrate existing form; add product_code field)
- [ ] Work types: simplified free-text tag input
- [ ] Tab 2: ColorEditor component
- [ ] Tab 3: MediaGallery component

### Phase 4 — Admin UI Variants & Settings (Week 3)

- [ ] Tab 2: VariantMatrix + VariantEditor
- [ ] Tab 4: Customization tab + BlouseConfigForm
- [ ] Tab 5: MeasurementTemplateAssign
- [ ] Settings: Size system admin page
- [ ] Settings: Measurement template admin page

### Phase 5 — Storefront Migration (Week 4)

- [ ] Storefront: variant selector (color, size, customization type)
- [ ] Storefront: measurement collection form
- [ ] Storefront: order creation → `create-order` edge function with snapshots
- [ ] Storefront: image from `v_products_storefront.primary_image_url`

### Phase 6 — Cleanup (Week 5, after Phase 5 verified)

- [ ] Backfill `product_media` rows from `products.image_url`
- [ ] Deprecate `products.image_url` (ALTER COLUMN or DROP)
- [ ] Remove compatibility shims once storefront fully migrated

---

## 10. Ticket Breakdown

### Schema (sequential)

| ID | Description |
|---|---|
| DB-001 | Migration 010: enums (customization_type, measurement_field_key, media_type) |
| DB-002 | Migration 011: size_systems, size_system_entries |
| DB-003 | Migration 012: product_colors |
| DB-004 | Migration 013: products additions + product_variants + partial unique index |
| DB-005 | Migration 014: product_media + primary image partial unique indexes |
| DB-006 | Migration 015: measurement_templates + measurement_template_fields |
| DB-007 | Migration 016: blouse_configurations |
| DB-008 | Migration 017: order_items additions + order_item_measurements |
| DB-009 | Migration 018: performance indexes (incl. idx_pv_type on product_id, customization_type) |
| DB-010 | Migration 019: RLS policies + generate_variant_sku DB function |
| DB-011 | Migration 020: compatibility views (v_products_storefront, v_product_colors_storefront) |
| DB-012 | Migration 021: seed size systems |
| DB-013 | Migration 022: backfill default variants |

### Phase 1.5 QA (after DB-013)

| ID | Description |
|---|---|
| QA-001 | Schema verification test suite |
| QA-002 | RLS verification (anon + admin) |
| QA-003 | Unique index constraint tests |
| QA-004 | SKU generation function tests |
| QA-005 | Snapshot structure integrity tests |
| QA-006 | Compatibility view smoke tests |

### Service + Hook Layer (parallel after QA)

| ID | Description |
|---|---|
| SVC-001 | product-colors service + useProductColors hooks |
| SVC-002 | product-variants service + useProductVariants hooks |
| SVC-003 | product-media service + useProductMedia hooks |
| SVC-004 | size-systems service + useSizeSystems hooks |
| SVC-005 | measurement-templates service + useMeasurementTemplates hooks |
| SVC-006 | blouse-config service + useBlouseConfig hooks |
| SVC-007 | products service: getProductWithVariants |
| SVC-008 | storage service: multi-path upload |
| SVC-009 | orders service: snapshot builder + order_item_measurements write |
| EF-001 | Edge function: create-order |
| EF-002 | Edge function: bulk-create-variants |
| EF-003 | Edge function: resolve-measurement-template |
| EF-004 | Edge function: set-primary-media (atomic primary swap) |

### Admin UI (sequential within product, settings parallel)

| ID | Description |
|---|---|
| UI-001 | Product detail page route + tab shell |
| UI-002 | Tab 1: Basic Info (migrate + product_code field) |
| UI-003 | Work types: simplified free-text tag input |
| UI-004 | Tab 2: ColorEditor component |
| UI-005 | Tab 3: MediaGallery component |
| UI-006 | Tab 2: VariantMatrix + VariantEditor |
| UI-007 | Tab 4: Customization + BlouseConfigForm |
| UI-008 | Tab 5: MeasurementTemplateAssign |
| UI-009 | Settings: Size system admin |
| UI-010 | Settings: Measurement template admin |

### Storefront

| ID | Description |
|---|---|
| SF-001 | Variant selector (color, size, customization type) |
| SF-002 | Measurement collection form |
| SF-003 | Order creation → create-order edge function |
| SF-004 | Image from compatibility view |

### Cleanup

| ID | Description |
|---|---|
| CLEAN-001 | Backfill product_media from products.image_url |
| CLEAN-002 | Deprecate products.image_url |

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| SKU collision on bulk create | `generate_variant_sku` DB function + UNIQUE constraint + edge function handles conflict |
| Primary image constraint violation on migration | Service layer uses upsert pattern: set new primary, then unset others in transaction |
| Template resolution returning wrong template | Unit-tested resolution function; version captured in snapshot for audit |
| Storefront breakage during migration | Compatibility views as stable query surface; `image_url` fallback in view until Phase 6 |
| Stock decrement race condition | `create-order` edge function uses `UPDATE ... WHERE stock_quantity > 0` with row lock |
| Variant matrix explosion | Explicit-only creation enforced in UI and `bulk-create-variants` (no cartesian mode) |
| `product_code` uniqueness on backfill | Backfill uses name + UUID fragment; admin can update to clean codes post-migration |
