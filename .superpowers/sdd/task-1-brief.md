# Task 1: Core Types and Interfaces (types.ts)

## Objective
Define TypeScript types and interfaces for the entire CSV import pipeline. This is the foundation for all downstream modules.

## Deliverables

Create `lib/csv-import/types.ts` with the following:

1. **RowError** interface
   - `row: number` (1-indexed CSV row number)
   - `field: string` (column name where error occurred)
   - `message: string` (human-readable error description)

2. **ParseResult** interface (from PapaParse)
   - `data: Record<string, string>[]` (array of row objects)
   - `errors: ParseError[]` (PapaParse errors if any)
   - `meta: { fields?: string[] }` (parsed headers)

3. **ProductColor** interface
   - `label: string` (color label)
   - `imageUrls: string[]` (one or more image URLs for this color)

4. **ProductImage** interface
   - `url: string` (image URL)
   - `isFromRow: number` (1-indexed CSV row that contributed this image)

5. **ProductGroup** interface (after grouping)
   - `name: string` (product name, normalized)
   - `rawName: string` (original name from CSV)
   - `originalRowIndex: number` (1-indexed row of the anchor/first row)
   - `categoryName: string | null` (from anchor row, may be null initially)
   - `price: number | null` (parsed price, or null if unparsed/invalid)
   - `rawPrice: string` (unparsed price string from CSV)
   - `status: string | null` (PUBLISHED or DRAFT, or null if invalid)
   - `rawStatus: string` (unparsed status from CSV)
   - `workTypes: string[]` (from anchor row, normalized to known enum values, empty array if none)
   - `rawWorkTypes: string` (unparsed semicolon-separated string)
   - `shortDescription: string | null` (from anchor row, or null)
   - `description: string | null` (from anchor row, or null)
   - `colors: ProductColor[]` (array of colors with their images, in first-seen order)
   - `primaryImages: ProductImage[]` (images from rows with blank color_label)
   - `errors: RowError[]` (validation errors for this group, empty if valid)
   - `groupRowIndices: number[]` (all 1-indexed row numbers that belong to this group)

6. **GroupingResult** interface
   - `groups: ProductGroup[]` (grouped products, in order of first appearance)
   - `unassignedRows: UnassignedRow[]` (rows with blank product name)

7. **UnassignedRow** interface
   - `rowIndex: number` (1-indexed row number)
   - `rawData: Record<string, string>` (the full row from CSV)
   - `error: RowError` (error describing why it couldn't be grouped)

8. **ValidationContext** interface
   - `categories: { id: string; name: string }[]` (loaded category list for validation)
   - `allowedWorkTypes: string[]` (WORK_TYPES enum values from ProductForm)
   - `allowedStatuses: string[]` (['PUBLISHED', 'DRAFT'])

9. **FileValidationError** interface
   - `type: 'header' | 'empty' | 'parser'` (classification of file-level error)
   - `message: string` (human-readable error)

10. **TemplateExample** interface (for template generation)
    - `name: string` (example product name)
    - `categoryName: string` (example category)
    - `price: number` (example price)
    - `status: string` (PUBLISHED or DRAFT)
    - `workTypes: string` (semicolon-separated example)
    - `shortDescription: string` (short desc)
    - `description: string` (long desc)
    - `colorLabel: string` (color label, empty for primary image)
    - `imageUrl: string` (example image URL)

## Requirements

- TypeScript strict mode
- No `any` types
- Export all types
- No utility functions in this file (types only)
- Each type should be sufficiently detailed to represent the full state at that stage of the pipeline

## Testing

No unit tests needed for types.ts itself (it's a definition file).

## Acceptance Criteria

✅ All types are exported and properly documented
✅ No circular dependencies
✅ TypeScript strict mode passes
