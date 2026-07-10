# Task 4 Dispatcher (Ready after Task 3 approved)

## Task: Create `services/product-import.ts` — batch insert orchestration

This is the most complex task. It coordinates category resolution, slug/code generation, chunked batch inserts with fallback, color/media creation, and audit logging.

Brief: `.superpowers/sdd/bulk-task-4-brief.md`
Report: `.superpowers/sdd/bulk-task-4-report.md`

## High-level implementation flow:

1. **Modify `lib/audit.ts`** — add 'BULK_IMPORT' to AuditAction union
2. **Create comprehensive test suite** (`__tests__/services/product-import.test.ts`) with 26 test cases:
   - 13 tests for resolution helpers (category, slug, code, findExisting)
   - 13 tests for bulkImportProducts (happy path, chunking, concurrency, error handling, compensation)
3. **Create `services/product-import.ts`** with:
   - Type definitions (ImportStage, BulkImportOptions, BulkImportProductResult, BulkImportSummary)
   - Helper functions: resolveCategoryId, resolveUniqueSlug, resolveUniqueProductCode, findExistingProductNames
   - Helper functions: createColorsAndMedia, insertProductRowWithRetry, chunk utility
   - Main export: `bulkImportProducts(groups, categories, options): Promise<BulkImportSummary>`

## Key test cases to implement (13 bulkImportProducts tests):

1. Single product import happy path with primary image → success, all counts correct
2. Mismatched batch row count → falls back to per-row (defensive guard)
3. Batch insert colors/media → one call per table, URL deduplication (3 URLs → 2 unique)
4. Category resolution fails → no DB writes, recorded as failure
5. Slug collision → null after 20 attempts, recorded as SLUG_COLLISION
6. Concurrent unique-constraint collision → batch fails, falls back to per-row, re-resolves, succeeds
7. Transient network error → batch fails once, retried batch succeeds
8. RLS-denied insert → no retry, classified as RLS_DENIED
9. Color insert fails → compensates by soft-deleting product, recorded as failure
10. MAX_IMPORT_PRODUCTS ceiling (1001 products) → rejected outright before writes
11. Progress stages fire in order (all 6 stages)
12. Chunking verified (250 products → 2 chunks of 200+50)
13. Multiple products independently (one succeeds, one fails) → both reported separately

## Core implementation details:

**bulkImportProducts flow:**
1. Reject if groups.length > 1000
2. Resolve categories (drop failures)
3. Generate unique slugs/codes (drop failures)
4. Split into chunks of 200
5. For each chunk, batch insert products
   - If success + matching row count: use results
   - Else: fall back to per-row with unique-violation retry
6. For each successful product, create colors+media (one multi-row insert per table)
   - Deduplicate URLs by {colorId:url} or {primary:url} key
   - Mark is_primary: true for index 0 of each scope
   - If fails: soft-delete product, record failure
7. Compute metrics: successCount, failureCount, productsPerSecond, rowsPerSecond, averageChunkDurationMs
8. Log single BULK_IMPORT audit event with full metadata
9. Return BulkImportSummary

**Stable product mapping:**
- Pair by array position: batchData[i] with batch[i].group
- Defensive guard: if lengths don't match, fall back to per-row
- Per-row fallback naturally pairs within same loop iteration

**AbortController support:**
- Thread signal through every insert: query.abortSignal(signal)
- Before setState in success/error, check controller.signal.aborted and return early

## Imports to use:
- createClient from @/lib/supabase/client
- getProductBySlug, getProductByCode, deleteProduct from @/services/products
- generateSlug from @/lib/slug
- generateProductCode from @/lib/product-code
- normalizeForComparison from @/lib/csv-import/validate
- withRetry, withRetryableQuery from @/lib/retry
- classifyError, ImportStageError from @/lib/import-errors
- MAX_SLUG_CODE_ATTEMPTS, MAX_IMPORT_PRODUCTS, PRODUCT_INSERT_CHUNK_SIZE from @/lib/product-import-constants
- logAuditEvent from @/lib/audit
- captureError from @/lib/monitoring
- ProductGroup from @/lib/csv-import/types
- Json from @/types/database

## Test setup notes:
- Mock createClient and createUntypedClient (same mock)
- Mock generateProductCode to return 'MEI-TEST-CODE' by default
- Mock captureError (no-op in tests)
- Use createChain utility to mock Supabase query results
- Each test should focus on one specific scenario
- Use realistic ProductGroup fixture (makeGroup function)
