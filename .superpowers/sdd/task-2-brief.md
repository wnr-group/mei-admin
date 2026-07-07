# Task 2: CSV Parsing Module (parse.ts)

## Objective
Implement `lib/csv-import/parse.ts` to parse CSV files using PapaParse with RFC4180 compliance and proper header validation.

## Deliverables

Create `lib/csv-import/parse.ts` with:

### Function: `parseCSV(csvText: string): ParseResult`
- **Input:** Raw CSV text (string)
- **Output:** `ParseResult` (from types.ts)
- **Purpose:** Use PapaParse to parse CSV into row objects with header as keys

**Implementation details:**
- Use `Papa.parse(csvText, { header: true, skipEmptyLines: true })`
- If PapaParse encounters parsing errors (e.g., unclosed quotes), include them in result
- Return `ParseResult` with:
  - `data`: array of row objects (each row is `Record<string, string>`)
  - `errors`: any PapaParse errors
  - `meta.fields`: the parsed headers (column names)

### Function: `validateHeaders(headers: string[] | undefined): FileValidationError | null`
- **Input:** Parsed headers from PapaParse (`meta.fields`)
- **Output:** `FileValidationError` if invalid, `null` if headers are valid
- **Purpose:** Ensure the CSV has the required columns

**Required headers (exact column names, case-sensitive):**
- `name`
- `category_name`
- `price`
- `status`
- `work_types`
- `short_description`
- `description`
- `color_label`
- `image_url`

**Validation rules:**
- Trim whitespace from each header before comparison
- All 9 required headers must be present
- Column order does NOT matter
- Unknown extra columns are OK (silently ignored)
- Duplicate headers should be treated as an error (use PapaParse's detection if available, or check manually)
- If headers are missing/malformed, return error with type 'header' and clear message

### Function: `parseAndValidateFile(csvText: string): { result: ParseResult | null; fileError: FileValidationError | null; rows: Array<Record<string, string>> | null }`
- **Input:** Raw CSV text
- **Output:** Object with parsed result, any file-level errors, and cleaned rows (headers validated, empty rows filtered)
- **Purpose:** One-shot function to parse CSV and validate file structure

**Implementation:**
1. Handle empty file → return `fileError: { type: 'empty', message: 'CSV file is empty' }`
2. Parse with PapaParse
3. If PapaParse failed → return `fileError: { type: 'parser', message: ... }`
4. Validate headers → if error, return it
5. If headers OK, return cleaned rows

## Requirements

- Import PapaParse: `import Papa from 'papaparse'`
- Use types from `lib/csv-import/types.ts`
- TypeScript strict mode (no `any`)
- Pure functions only
- No console.log, no side effects
- Handle edge cases:
  - Empty file
  - Header-only file (no data rows)
  - Quoted fields with commas/newlines
  - Escaped quotes within quoted fields
  - UTF-8 BOM (PapaParse handles this)
  - Trailing blank rows (PapaParse's skipEmptyLines should skip these)

## Testing

Write unit tests (Vitest) in `lib/csv-import/parse.test.ts`:

1. **Test:** parseCSV with quoted fields
   - Input: CSV with quoted field containing comma: `"name","category_name","price"..."Product A","Bridal","45000"`
   - Assert: parsed correctly, data array has correct columns

2. **Test:** parseCSV with quoted newline
   - Input: CSV with quoted multiline description
   - Assert: description preserved with newline

3. **Test:** parseCSV with escaped quotes
   - Input: CSV with escaped quotes inside quoted field: `"desc","title ""Lehenga"" edition",...`
   - Assert: unescaped correctly

4. **Test:** validateHeaders with missing required column
   - Input: headers missing `price`
   - Assert: returns FileValidationError with type 'header'

5. **Test:** validateHeaders with unknown extra column
   - Input: headers include `unknown_column`
   - Assert: returns null (valid)

6. **Test:** parseAndValidateFile with empty file
   - Input: empty string
   - Assert: returns `fileError.type === 'empty'`

7. **Test:** parseAndValidateFile with valid CSV
   - Input: minimal valid CSV (header + 1 data row)
   - Assert: returns cleaned rows, no fileError

8. **Test:** parseAndValidateFile with header-only
   - Input: CSV header row, no data
   - Assert: returns cleaned rows as empty array

9. **Test:** parseAndValidateFile with trailing blank rows
   - Input: CSV with 2 data rows followed by blank rows
   - Assert: cleaned rows has exactly 2 entries

10. **Test:** UTF-8 with special characters
    - Input: CSV with UTF-8 accents/symbols in description
    - Assert: parsed correctly

## Acceptance Criteria

✅ PapaParse used (not custom parser)
✅ All required headers validated with trimming
✅ Unknown extra columns don't crash
✅ RFC4180 compliance (quoted fields, escaped quotes, multiline)
✅ All 10 unit tests passing
✅ No console.log, no side effects
✅ TypeScript strict mode passes
