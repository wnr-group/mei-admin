# Task 5: Template Generation (template.ts)

## Objective
Implement `lib/csv-import/template.ts` to generate a downloadable CSV template with examples and explanatory comments.

## Deliverables

Create `lib/csv-import/template.ts` with:

### Function: `generateCSVTemplate(): string`
- **Input:** None
- **Output:** CSV string (plain text, ready for download)
- **Purpose:** Generate a CSV template file that admins can download, fill out, and upload

**Template content:**

The template should contain:
1. **Header row:** Exact column names (no extra whitespace)
   ```
   name,category_name,price,status,work_types,short_description,description,color_label,image_url
   ```

2. **Example 1: Single-color product**
   ```
   Bridal Lehenga A1,Bridal Lehengas,45000,PUBLISHED,Zardozi;Kundan,A stunning bridal lehenga with gold embroidery,This piece features intricate zardozi work with kundan embellishments. Perfect for wedding ceremonies.,,"https://example.com/lehenga-a1.jpg"
   ```

3. **Example 2: Multi-color product (3 rows with same name)**
   ```
   Evening Gown B1,Evening Gowns,35000,PUBLISHED,Cut;Thread,Elegant evening gown available in multiple colors,"A timeless evening gown with sophisticated design. Features premium fabric and expert tailoring.","Red","https://example.com/gown-b1-red-front.jpg"
   Evening Gown B1,,,,,,,,"https://example.com/gown-b1-red-back.jpg"
   Evening Gown B1,,,,,,,"Gold","https://example.com/gown-b1-gold-front.jpg"
   ```

**Key points:**
- Use double quotes for fields containing commas or newlines (RFC4180)
- Single-color product has blank color_label (shows as empty,,)
- Multi-color product repeats name, leaves other anchor fields blank on non-first rows
- Description can span multiple lines within quotes (as shown in the example)
- URLs are real-looking placeholders (e.g., https://example.com/...)
- Use realistic values for the domain (WNR group or MEI bridal)

### Function: `downloadTemplate(filename: string = 'MEI-Bulk-Import-Template.csv'): void`
- **Input:** Optional filename (default 'MEI-Bulk-Import-Template.csv')
- **Output:** Triggers browser download
- **Purpose:** Used in UI to make download button work

**Implementation (browser-only, client-side):**
1. Call `generateCSVTemplate()` to get CSV string
2. Create a Blob from the CSV string: `new Blob([csvString], { type: 'text/csv;charset=utf-8;' })`
3. Create a temporary URL: `URL.createObjectURL(blob)`
4. Create a temporary <a> element with:
   - href = the blob URL
   - download = filename
5. Append to document, click, remove
6. Revoke the blob URL to free memory

**Note:** This function has a side effect (browser download) and should only be called from React component event handlers. It's a bridge function between pure template generation and browser interaction.

### Export: `TEMPLATE_FILENAME`
- Constant string: `'MEI-Bulk-Import-Template.csv'`
- Used as default for downloads

## Requirements

- Use types from `lib/csv-import/types.ts`
- TypeScript strict mode
- generateCSVTemplate must be a pure function (no side effects)
- downloadTemplate must only be called in browser context (uses browser APIs)
- CSV must be RFC4180 compliant (properly quoted fields with special characters)
- Example data should be realistic but not tied to production database
- No console.log

## Testing

Write unit tests (Vitest) in `lib/csv-import/template.test.ts`:

1. **Test:** generateCSVTemplate returns a string
   - Assert: result is typeof 'string'

2. **Test:** generated template contains all headers
   - Input: generateCSVTemplate()
   - Assert: first line contains all 9 column names

3. **Test:** generated template has example products
   - Input: generateCSVTemplate()
   - Assert: result contains "Bridal Lehenga A1" and "Evening Gown B1"

4. **Test:** multi-color product shown correctly
   - Input: generateCSVTemplate()
   - Assert: "Evening Gown B1" appears 3 times, second row has empty price/category

5. **Test:** template is valid CSV (can be parsed)
   - Input: generateCSVTemplate()
   - Assert: PapaParse can parse it without errors (use PapaParse in test)

6. **Test:** quoted fields with commas/newlines
   - Input: generateCSVTemplate()
   - Assert: example description with newline is properly quoted

7. **Test:** TEMPLATE_FILENAME constant exists
   - Assert: TEMPLATE_FILENAME === 'MEI-Bulk-Import-Template.csv'

## Acceptance Criteria

✅ Template includes both single-color and multi-color examples
✅ RFC4180 compliance (quoted multiline fields)
✅ All 7 unit tests passing
✅ Pure generateCSVTemplate function
✅ downloadTemplate works in browser (not testable in Vitest, but must be correct)
✅ TypeScript strict mode passes
