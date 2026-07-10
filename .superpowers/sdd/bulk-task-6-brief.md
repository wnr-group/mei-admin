# Task 6 Brief: Wire `ImportPageClient.tsx` to real bulk import flow

## Overview

Replace the entire contents of `components/products/import/ImportPageClient.tsx` with a fully functional implementation that:
1. Orchestrates parse → group → validate pipeline (already exists from MEI-42)
2. Shows grouped product preview tree
3. Performs duplicate-name pre-import check (`findExistingProductNames`)
4. Calls `bulkImportProducts` with abort signal and progress reporting
5. Shows per-stage progress overlay during import
6. Displays results via `ImportResultSummary`
7. Invalidates product list cache and returns to products page

## Exact Requirements (from Plan Section: Task 6)

### Files to modify:
- **Modify:** `components/products/import/ImportPageClient.tsx` (full file replacement — code provided in plan)

### Interfaces consumed:
- `bulkImportProducts`, `findExistingProductNames`, `BulkImportSummary`, `ImportStage` from `@/services/product-import`
- `ImportResultSummary` component (Task 5)
- `useQueryClient` from `@tanstack/react-query`
- Existing MEI-42 pipeline functions: `parseAndValidateFile`, `groupRowsByProduct`, `validateGroupingResult`, `isValidFile`, `downloadTemplate`

### Key state management:
- `importStatus`: 'idle' | 'importing' | 'done'
- `importStage`: current stage from callback (used for overlay label)
- `importSummary`: full BulkImportSummary result
- `abortControllerRef`: holds AbortController, aborted on unmount
- Progress callback: `onProgress: setImportStage` to update overlay label

### Key behavior:
1. **Idempotency check:** before import, call `findExistingProductNames([group.name...])` and show `window.confirm()` with matches (exact pattern from Plan "Accidental duplicate file re-upload")
2. **Abort on unmount:** useEffect cleanup aborts controller
3. **Abort check before setState:** after await bulkImportProducts, check `controller.signal.aborted` and return early if true (prevents unmounted component setState warning)
4. **Import button disabled:** when `importStatus !== 'idle'`
5. **Progress overlay:** shows "Importing… (stage label from STAGE_LABELS)" while importing
6. **Results:** when done, show `ImportResultSummary` component with full summary
7. **Cache invalidation:** `queryClient.invalidateQueries({ queryKey: ['products'] })` after successful import
8. **Exit:** "Back to Products" link when done

### Layout/styling:
- Full-page centered design matching existing MEI-42 pages
- Breadcrumb: Products / Bulk Import
- Download CSV Template button (top right)
- Format Guide section
- Upload card
- Preview tree (when status === 'success')
- Results card (when importStatus === 'done')
- Fixed footer bar with Cancel / Import buttons (or Back when done)
- Error toast (red, auto-dismiss after 6s)
- Importing overlay (translucent, centered spinner message)

### Manual smoke test (Task 6, Step 4):
1. Download template, upload unmodified → preview renders, Import enabled
2. Click Import → overlay cycles through all 6 stage labels
3. Results card shows "2 of 2 products imported successfully"
4. Download Report → JSON file downloads
5. Click Back to Products → newly imported products visible without manual refresh
6. Re-upload template → confirmation dialog lists 2 existing names
7. Check Supabase: 2 new products, colors, media, 1 audit log with BULK_IMPORT action
8. Upload again, navigate away mid-import → no "state update on unmounted component" warning

## Verification steps:
1. Type check: `npx tsc --noEmit` → no errors
2. Lint: `npx eslint components/products/import/ImportPageClient.tsx` → clean
3. Build: `npm run build` → succeeds
4. Manual smoke test: all 8 steps above pass

## Report File
Report to: `.superpowers/sdd/bulk-task-6-report.md`
