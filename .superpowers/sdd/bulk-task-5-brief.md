# Task 5 Brief: Add `ImportResultSummary` component

## Overview

Create a `'use client'` React component that renders the outcome of a completed bulk import: aggregate counts (products/colors/media created), timing, throughput, and a detailed failure list with error codes. Include a "Download Report" button that exports the full summary as JSON.

## Exact Requirements (from Plan Section: Task 5)

### Files to create:
- **Create:** `components/products/import/ImportResultSummary.tsx`

### Interface consumed:
- `BulkImportSummary` type from `@/services/product-import`

### Props:
```ts
interface ImportResultSummaryProps {
  summary: BulkImportSummary;
}
```

### Rendering:
1. **Success line:** "✓ X of Y products imported successfully" with green CheckCircle2 icon
2. **Metric chips:** 6 chips with 11px uppercase tracking-widest styling:
   - "X product(s) created"
   - "X color(s) created"
   - "X media row(s) created"
   - "Took [duration]" (ms/s formatting)
   - "X products/sec" (throughput)
   - (optional extra metrics as fits design)
3. **Failure section:** (only if failureCount > 0)
   - Red border/background, styled consistently with admin theme
   - Heading: "FAILED (X)" in red
   - List of failed products with:
     - Product name (bold)
     - Error code in `[brackets]` (e.g., `[CATEGORY_NOT_FOUND]`)
     - Error message
   - XCircle icon per item
4. **Download button:** "Download Report" with Download icon, click → JSON file downloads as `bulk-import-report-[timestamp].json`

### Design system:
- Light theme only: white/cream background, #c9a465 gold accents
- 11px uppercase tracking-widest for labels
- 13px body text for headings, smaller for details
- No dark mode, no CSS modules
- Tailwind utility classes inline

### Helper functions:
- `formatDuration(ms: number): string` — returns "Xms" or "X.Xs" based on magnitude
- `downloadReport(summary: BulkImportSummary): void` — creates Blob, ObjectURL, anchor download pattern (same as template.ts pattern in MEI-42)

## Verification steps:
1. Type check: `npx tsc --noEmit` → no errors
2. Lint: `npx eslint components/products/import/ImportResultSummary.tsx` → clean

## Report File
Report to: `.superpowers/sdd/bulk-task-5-report.md`
