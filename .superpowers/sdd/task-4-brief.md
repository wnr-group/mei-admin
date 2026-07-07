# Task 4: Validation Module (validate.ts)

## Objective
Implement `lib/csv-import/validate.ts` to validate grouped products against a set of rules and categories, producing per-row/per-product error details.

## Deliverables

Create `lib/csv-import/validate.ts` with:

### Function: `normalizeForComparison(value: string, caseSensitive: boolean = false): string`
- **Input:** value (string), caseSensitive (boolean)
- **Output:** Normalized string (trimmed, spaces collapsed; optionally lowercased)
- **Purpose:** Consistent comparison for status, category, work types

**Implementation:**
- Trim leading/trailing whitespace
- Collapse multiple consecutive spaces to single space
- If caseSensitive is false, lowercase the result
- If caseSensitive is true, preserve case

### Function: `validateProductGroup(group: ProductGroup, context: ValidationContext): ProductGroup`
- **Input:** ProductGroup (from grouping), ValidationContext (categories + allowed enums)
- **Output:** Same ProductGroup with `errors` populated
- **Purpose:** Run all validations on the group and attach error details

**Validations:**

1. **Product name:** Already present (from grouping)
   - Blank name check happens in grouping stage

2. **Product category (anchor row only):**
   - If categoryName is blank/null: add error
     - Field: "category_name"
     - Message: "Required field is empty"
   - If categoryName is non-blank:
     - Find matching category (case-insensitive) in context.categories
     - If not found: add error
       - Field: "category_name"
       - Message: `Unknown category "${group.categoryName}"`

3. **Price (anchor row only):**
   - If rawPrice is blank/null: add error
     - Field: "price"
     - Message: "Required field is empty"
   - If rawPrice is non-blank:
     - Try to parse as number: `Number(rawPrice.trim())`
     - If NaN or contains non-digit characters (except single dot, spaces, leading/trailing whitespace):
       - Add error
       - Field: "price"
       - Message: `"${rawPrice}" is not a valid number`
     - If parsed number is negative:
       - Add error
       - Field: "price"
       - Message: `Price must be non-negative (got ${parsedPrice})`
     - If valid non-negative number: set group.price = parsedPrice
     - Reject: currency symbols, thousands separators (commas), multiple dots, invalid decimals
     - Accept: "45000", "45000.00", " 45000 ", "45000.5"

4. **Status (anchor row only):**
   - If rawStatus is blank/null: add error
     - Field: "status"
     - Message: "Required field is empty"
   - If rawStatus is non-blank:
     - Normalize: trim, collapse spaces
     - Check against context.allowedStatuses (after case-insensitive comparison)
     - If not in allowed list: add error
       - Field: "status"
       - Message: `Invalid status "${group.rawStatus}". Allowed: PUBLISHED, DRAFT`
     - If valid: set group.status = normalized status (uppercase)

5. **Work types (optional):**
   - If rawWorkTypes is blank/empty: set workTypes to [], no error
   - If non-blank:
     - Split by semicolon: `rawWorkTypes.split(';')`
     - Trim and collapse spaces in each item
     - For each work type:
       - Check against context.allowedWorkTypes (case-insensitive match)
       - If not found: add error
         - Field: "work_types"
         - Message: `Unknown work type "${originalValue}"` (use original before normalization)
       - If found: add normalized (titlecase or as-appears in allowedWorkTypes)
     - Set group.workTypes to array of validated work types

6. **Short description (optional):**
   - Trim and preserve
   - If exceeds 300 characters (if short_description validation exists in ProductForm):
     - Check ProductForm.tsx for actual limit; if none exists, skip this validation
   - Set group.shortDescription = trimmed value or null if blank

7. **Description (optional):**
   - Trim and preserve (never modify multiline content)
   - Set group.description = trimmed value or null if blank

8. **Conflicting repeated product fields (multi-row groups only):**
   - For groups with more than one row (multi-color products):
   - For each anchor field (categoryName, price, status, workTypes, shortDescription, description):
     - Check non-anchor rows to see if they have non-blank values for these fields
     - If any non-anchor row has a non-blank value for an anchor field:
       - Normalize both anchor and non-anchor value
       - If they DON'T match (after normalization): add error
         - Field: the conflicting field name
         - Message: `Conflicting ${fieldName}: anchor row has "${anchorValue}", but row ${rowIndex} has "${nonAnchorValue}"`
       - If they DO match: no error (allowed)
   - Note: Non-anchor rows are expected to omit these fields; but if they include them and they conflict, that's an error

9. **Images:**
   - If product has no colors and no primary images: add error
     - Field: "image_url"
     - Message: "Product must have at least one image (color image or primary image)"
   - Individual image URLs are NOT validated for format (plain strings are OK)

### Function: `validateGroupingResult(result: GroupingResult, context: ValidationContext): GroupingResult`
- **Input:** GroupingResult from grouping stage, ValidationContext
- **Output:** Same result with all groups and unassignedRows validated (errors populated)
- **Purpose:** Run validation on all groups and unassigned rows

**Implementation:**
- For each ProductGroup in result.groups:
  - Call validateProductGroup(group, context)
- For each UnassignedRow in result.unassignedRows:
  - Error already set during grouping ("Missing product name")
- Return result

### Function: `isValidFile(result: GroupingResult): boolean`
- **Input:** GroupingResult (already validated)
- **Output:** boolean
- **Purpose:** Check if entire import is valid (no errors at any level)

**Implementation:**
- Return true only if:
  - Every group in groups has errors.length === 0
  - unassignedRows.length === 0

## Requirements

- Use types from `lib/csv-import/types.ts`
- TypeScript strict mode (no `any`)
- Pure functions only
- No console.log
- Handle all edge cases gracefully
- Never silently hide conflicting data
- Validation errors must be specific (row number, field name, clear message)

## Testing

Write unit tests (Vitest) in `lib/csv-import/validate.test.ts`:

1. **Test:** normalizeForComparison
   - "  PUBLISHED  " → "published" (case-insensitive)
   - "Aari; Zardozi" → "aari; zardozi" (with collapsing)

2. **Test:** validateProductGroup with missing category
   - Input: group with blank categoryName
   - Assert: errors include "category_name" field with "Required field is empty"

3. **Test:** validateProductGroup with unknown category
   - Input: group with categoryName "Gownz" (not in categories)
   - Assert: errors include message `Unknown category "Gownz"`

4. **Test:** validateProductGroup with invalid price
   - Input: group with rawPrice "abc"
   - Assert: errors include message `"abc" is not a valid number`

5. **Test:** validateProductGroup with negative price
   - Input: group with rawPrice "-1000"
   - Assert: errors include message about non-negative

6. **Test:** validateProductGroup with invalid status
   - Input: group with rawStatus "ARCHIVED"
   - Assert: errors include message about allowed statuses

7. **Test:** validateProductGroup with valid work type
   - Input: group with rawWorkTypes "Zardozi;Kundan"
   - Assert: group.workTypes = ["Zardozi", "Kundan"], no error

8. **Test:** validateProductGroup with unknown work type
   - Input: group with rawWorkTypes "Zardozi;Unknown"
   - Assert: errors include message `Unknown work type "Unknown"`

9. **Test:** validateProductGroup with conflicting price in multi-row group
   - Input: 2 rows of same product, anchor price "45000", non-anchor price "50000"
   - Assert: errors include conflict message

10. **Test:** validateProductGroup with matching repeated price (no error)
    - Input: 2 rows, anchor price "45000", non-anchor price "45000"
    - Assert: no error for price field

11. **Test:** validateProductGroup with no images
    - Input: group with empty colors and empty primaryImages
    - Assert: errors include "image_url" field with "must have at least one image"

12. **Test:** validateGroupingResult processes all groups
    - Input: GroupingResult with 3 groups (2 valid, 1 with error)
    - Assert: exactly 1 group has errors

13. **Test:** isValidFile returns true when clean
    - Input: GroupingResult with all groups valid, no unassigned rows
    - Assert: isValidFile(result) === true

14. **Test:** isValidFile returns false when any errors
    - Input: GroupingResult with 1 invalid group
    - Assert: isValidFile(result) === false

## Acceptance Criteria

✅ All field validations implemented (name, category, price, status, work_types, descriptions, images)
✅ Conflicting repeated product fields detected and reported
✅ Validation errors are specific (row, field, message)
✅ All 14 unit tests passing
✅ No silent data loss
✅ TypeScript strict mode passes
