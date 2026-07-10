# Task 6 Dispatcher (Ready after Task 5 approved)

## Task: Wire `ImportPageClient.tsx` to real bulk import flow

Brief: `.superpowers/sdd/bulk-task-6-brief.md`
Report: `.superpowers/sdd/bulk-task-6-report.md`

This is the final UI wiring task. The component orchestrates the complete import flow with real backend calls, progress reporting, and error handling.

## Implementation steps:

1. Replace entire `components/products/import/ImportPageClient.tsx` with code from brief
2. Key state: importStatus ('idle'|'importing'|'done'), importStage, importSummary, abortControllerRef
3. Workflow:
   - Parse/group/validate pipeline (existing MEI-42 functions)
   - Pre-import duplicate-name check with window.confirm
   - Create AbortController, thread through bulkImportProducts
   - Abort on unmount via useEffect cleanup
   - Check signal.aborted before setState after await (prevent unmounted component warning)
   - Show progress overlay with stage labels
   - Invalidate ['products'] cache after success
4. Type check: `npx tsc --noEmit`
5. Lint: `npx eslint components/products/import/ImportPageClient.tsx`
6. Build: `npm run build`
7. Manual smoke test: all 8 steps from brief
8. Commit: "Wire bulk import page to bulkImportProducts with progress stages and duplicate-name confirmation (MEI-43)"

## Manual smoke test (8 steps to verify before committing):
1. Download template, upload unmodified → preview renders, Import enabled
2. Click Import → overlay cycles through all 6 stage labels
3. Results show "2 of 2 products imported successfully"
4. Download Report → JSON file downloads
5. Click Back to Products → newly imported products visible (no manual refresh)
6. Re-upload template → confirmation dialog lists existing names
7. Check Supabase: 2 products, colors, media, 1 BULK_IMPORT audit log
8. Upload again, navigate away mid-import → no unmounted component warning

## No unit tests — UI orchestration component verified via manual smoke test + build
