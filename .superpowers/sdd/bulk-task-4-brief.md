# Task 4 Brief: Create `services/product-import.ts` — resolution and batch insert

## Overview

Create the core `services/product-import.ts` module that:
1. Resolves product categories, unique slugs, unique product codes
2. Finds existing product names for idempotency safeguards
3. Batch-inserts products in chunks with per-row fallback on failure
4. Creates colors and media with deduplication and primary image marking
5. Compensates by soft-deleting products if colors/media creation fails
6. Reports progress through import stages
7. Logs a single audit event with throughput metrics

This is the most complex task and is thoroughly tested (13 tests in the main suite).

## Exact Requirements (from Plan Section: Task 4)

### Files to modify/create:
- **Modify:** `lib/audit.ts:4` — widen `AuditAction` to include `'BULK_IMPORT'`
- **Create:** `services/product-import.ts`
- **Create:** `__tests__/services/product-import.test.ts`

### Interfaces produced:
```ts
export type ImportStage = 'RESOLVING_CATEGORIES' | 'GENERATING_IDENTIFIERS' | 'CREATING_PRODUCTS' | 'CREATING_COLORS_AND_MEDIA' | 'LOGGING_AUDIT' | 'COMPLETED'

export interface BulkImportOptions {
  filename?: string
  onProgress?: (stage: ImportStage) => void
  signal?: AbortSignal  // for AbortController support
}

export interface BulkImportProductResult {
  name: string
  success: boolean
  productId?: string
  error?: string
  errorCode?: ImportErrorCode
}

export interface BulkImportSummary {
  successCount: number
  failureCount: number
  productsCreated: number
  colorsCreated: number
  mediaCreated: number
  rowsProcessed: number
  durationMs: number
  productsPerSecond: number
  rowsPerSecond: number
  averageChunkDurationMs: number
  results: BulkImportProductResult[]
}
```

### Functions to export:
1. `resolveCategoryId(categoryName: string, categories: Array<{id,name}>): string | null` — case-insensitive match
2. `resolveUniqueSlug(name: string, reservedSlugs: Set<string>): Promise<string | null>` — pre-check DB, add suffix if taken, max 20 attempts
3. `resolveUniqueProductCode(name: string, reservedCodes: Set<string>): Promise<string | null>` — same pattern as slug
4. `findExistingProductNames(names: string[]): Promise<string[]>` — case-insensitive match against non-deleted products
5. `bulkImportProducts(groups: ProductGroup[], categories, options?: BulkImportOptions): Promise<BulkImportSummary>`

### Key implementation details:

#### `bulkImportProducts` flow:
1. **Ceiling check:** reject if groups.length > MAX_IMPORT_PRODUCTS (1000)
2. **Progress:** fire onProgress('RESOLVING_CATEGORIES')
3. **Category resolution:** drop products whose category can't be resolved; record as failures
4. **Progress:** fire onProgress('GENERATING_IDENTIFIERS')
5. **Slug/code resolution:** for each remaining product, resolve unique slug/code; drop if either fails (20 attempts max each)
6. **Chunking:** split resolved products into chunks of PRODUCT_INSERT_CHUNK_SIZE (200)
7. **Progress:** fire onProgress('CREATING_PRODUCTS')
8. **Batch insert:** for each chunk, multi-row insert(); if returns mismatched row count or error, fall back to per-row inserts with unique-violation retry
9. **Progress:** fire onProgress('CREATING_COLORS_AND_MEDIA')
10. **Color/media:** for each successful product, create colors and media in one call per table (not per row); deduplicate image URLs; mark index 0 as is_primary
11. **Compensation:** if color/media fails, soft-delete the already-inserted product; catch and ignore compensation failures (use captureError)
12. **Progress:** fire onProgress('LOGGING_AUDIT')
13. **Audit:** call logAuditEvent with 'BULK_IMPORT' action and full metadata (filename, rowsProcessed, productsCreated, colorsCreated, mediaCreated, failureCount, durationMs, throughput metrics, productIds)
14. **Progress:** fire onProgress('COMPLETED')
15. **Return:** BulkImportSummary with all counts, timing, throughput, and per-product results

#### Throughput metrics:
- `productsPerSecond = successCount / (durationMs / 1000)` — default to count if durationMs rounds to 0
- `rowsPerSecond = rowsProcessed / (durationMs / 1000)`
- `averageChunkDurationMs = mean of per-chunk durations` — track this during chunk loop

#### Stable product mapping:
- Positional pairing: `batchData[i]` paired to `batch[i].group` (row order preserved by Postgres)
- Defensive check: if batchData.length !== batch.length, fall back to per-row path (never mis-pair)

#### AbortSignal support:
- Thread signal through every insert query (`query.abortSignal(signal)`)
- Before setState in success/error branches, check `controller.signal.aborted` and return early if true

### Test cases (13 tests):

1. **Single product import** — happy path with primary image
2. **Mismatched batch row count** — defensive fallback guard
3. **Batch insert colors/media** — one call per table, URL deduplication (3 URLs in, 1 dup → 2 inserted)
4. **Category resolution fails** — no DB writes attempted
5. **Slug collision** — null after 20 attempts
6. **Concurrent unique-constraint collision** — batch fails, falls back to per-row, re-resolves slug/code on collision, succeeds
7. **Transient network error** — batch fails once, retried batch succeeds
8. **RLS-denied** — no retry, classified correctly
9. **Color insert fails** — compensates by soft-deleting product
10. **MAX_IMPORT_PRODUCTS ceiling** — 1001 products rejected outright
11. **Progress stages fire in order** — all 6 stages in sequence
12. **Chunking** — 250 products, 2 chunks (200 + 50)
13. **Multiple products independently** — one succeeds, one fails (category not found); both reported correctly

## Imports needed:
```ts
import { createClient } from '@/lib/supabase/client'
import { getProductBySlug, getProductByCode, deleteProduct } from '@/services/products'
import { generateSlug } from '@/lib/slug'
import { generateProductCode } from '@/lib/product-code'
import { normalizeForComparison } from '@/lib/csv-import/validate'
import { withRetry, withRetryableQuery } from '@/lib/retry'
import { classifyError, ImportStageError, type ImportErrorCode } from '@/lib/import-errors'
import { MAX_SLUG_CODE_ATTEMPTS, MAX_IMPORT_PRODUCTS, PRODUCT_INSERT_CHUNK_SIZE } from '@/lib/product-import-constants'
import { logAuditEvent } from '@/lib/audit'
import { captureError } from '@/lib/monitoring'
import type { ProductGroup } from '@/lib/csv-import/types'
import type { Json } from '@/types/database'
```

## Verification steps:
1. Run tests: `npx vitest run __tests__/services/product-import.test.ts` → 26 tests pass (13 for resolution helpers + 13 for bulkImportProducts)
2. Type check: `npx tsc --noEmit` → no errors

## Report File
Report to: `.superpowers/sdd/bulk-task-4-report.md`
