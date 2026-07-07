# Task 3: Grouping Logic (group.ts)

## Objective
Implement `lib/csv-import/group.ts` to group CSV rows by product name, tracking colors and images in the order they appear in the file.

## Deliverables

Create `lib/csv-import/group.ts` with:

### Function: `normalizeProductName(name: string): string`
- **Input:** Raw product name from CSV
- **Output:** Normalized name (trimmed, repeated spaces collapsed to single space)
- **Purpose:** Create a consistent grouping key for product names

**Implementation:**
- Trim leading/trailing whitespace
- Collapse multiple consecutive spaces to single space
- Do NOT lowercase (case is preserved for display)

### Function: `groupRowsByProduct(rows: Array<Record<string, string>>): GroupingResult`
- **Input:** Array of parsed CSV rows (from parse.ts output)
- **Output:** `GroupingResult` with `groups` and `unassignedRows`
- **Purpose:** Group rows by product name, identify anchor rows, track colors and images

**Algorithm:**
1. Initialize empty Map<normalizedName, ProductGroup>
2. Initialize empty array for unassignedRows
3. Walk through rows in order (maintain file order)
4. For each row:
   - Get `name` value (trim whitespace)
   - If name is blank/empty:
     - Add to unassignedRows with error "Missing product name — cannot be grouped into a product"
     - Continue to next row
   - Normalize name
   - If this is the first occurrence of normalized name:
     - Create new ProductGroup (anchor row):
       - name: normalized name
       - rawName: original name from row
       - originalRowIndex: 1-indexed row number
       - categoryName: from row (may be null/invalid, will validate later)
       - price: from row (may be null/invalid, will validate later)
       - rawPrice: from row
       - status: from row (may be null/invalid, will validate later)
       - rawStatus: from row
       - workTypes: from row (semicolon-separated, will normalize later)
       - rawWorkTypes: from row
       - shortDescription: from row
       - description: from row
       - colors: empty array
       - primaryImages: empty array
       - errors: empty array
       - groupRowIndices: [current 1-indexed row]
   - If not the first occurrence (non-anchor row):
     - Add current 1-indexed row to groupRowIndices
     - Extract color_label and image_url from this row
     - If color_label is blank/empty:
       - This is a primary image row
       - Add image_url to primaryImages (create ProductImage with url and isFromRow)
     - If color_label is non-blank:
       - Check if this color already exists in the group's colors array
       - If yes: append image_url to that color's imageUrls
       - If no: create new ProductColor with label and imageUrls: [image_url]
5. Return GroupingResult with groups and unassignedRows

**Key behaviors:**
- Preserve file order: products and colors appear in first-seen order
- Rows with blank `color_label` are ALWAYS primary images (regardless of other fields)
- Repeated color labels attach multiple images to one color
- Non-anchor rows ignore non-image/non-color fields (category, price, status, etc.)
- Row numbers are 1-indexed (row 1 is header, row 2 is first data row)

## Requirements

- Use types from `lib/csv-import/types.ts`
- TypeScript strict mode (no `any`)
- Pure function only, no side effects
- No console.log
- Maintain file order throughout
- Handle edge cases:
  - Product with only primary images (no colors)
  - Product with multiple colors, some with one image, some with multiple
  - Product with only color images (no primary images)
  - Blank names (unassigned)
  - Whitespace-only names (treat as blank)

## Testing

Write unit tests (Vitest) in `lib/csv-import/group.test.ts`:

1. **Test:** normalizeProductName
   - Input: "  Product A  " → Assert: "Product A"
   - Input: "Product  B" → Assert: "Product B"

2. **Test:** groupRowsByProduct with single-color product
   - Input: 1 row with name, blank color_label, one image_url
   - Assert: 1 group, 1 primary image, 0 colors

3. **Test:** groupRowsByProduct with multi-color product
   - Input: 3 rows (same name, different color labels, multiple images for one color)
   - Assert: 1 group, 2 colors with correct image counts, file order preserved

4. **Test:** groupRowsByProduct with primary + color images
   - Input: 4 rows (1 primary, 3 color)
   - Assert: 1 group, 1 primary image, correct colors and images

5. **Test:** groupRowsByProduct with multiple products
   - Input: 5 rows (2 products: product A twice, product B thrice)
   - Assert: 2 groups, correct row indices per group

6. **Test:** groupRowsByProduct with blank product name
   - Input: 1 row with blank name
   - Assert: unassignedRows has 1 entry with error

7. **Test:** groupRowsByProduct preserves order
   - Input: 6 rows (product B first, then product A, then product B again)
   - Assert: groups in order [productB, productA], productB.colors in first-seen order

8. **Test:** groupRowsByProduct with repeated color labels
   - Input: 3 rows (same product, same color label twice)
   - Assert: 1 color with 2 images

9. **Test:** groupRowsByProduct with mixed blank/non-blank names
   - Input: 4 rows (1 valid name, 1 blank, 1 valid different name, 1 blank)
   - Assert: 2 groups, 2 unassignedRows

10. **Test:** groupRowsByProduct returns empty groups for empty input
    - Input: []
    - Assert: groups = [], unassignedRows = []

## Acceptance Criteria

✅ Grouping preserves file order (products and colors)
✅ Anchor row correctly identified (first occurrence)
✅ Primary images (blank color_label) collected separately
✅ Color images grouped by color_label with repeated labels attaching multiple images
✅ Unassigned rows (blank name) identified and tracked
✅ All 10 unit tests passing
✅ No side effects, no console.log
✅ TypeScript strict mode passes
