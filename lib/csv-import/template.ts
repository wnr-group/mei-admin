/**
 * CSV Template Generation
 *
 * Generates downloadable CSV templates for bulk product imports.
 * Includes example products (single-color and multi-color variants)
 * to guide admins through the import process.
 */

export const TEMPLATE_FILENAME = 'MEI-Bulk-Import-Template.csv';

/**
 * Generates a CSV template string with headers and example products.
 *
 * The template includes:
 * - Header row with all required column names
 * - Example 1: Single-color product (Bridal Lehenga A1)
 * - Example 2: Multi-color product (Evening Gown B1 with 3 rows)
 *
 * The CSV is RFC4180 compliant with proper quoting for fields
 * containing commas, newlines, or double quotes.
 *
 * @returns A CSV string ready for download or file save
 */
export function generateCSVTemplate(): string {
  const header =
    'name,category_name,price,status,work_types,short_description,description,color_label,image_url';

  // Example 1: Single-color product (no color label, single image)
  const example1 = [
    'Bridal Lehenga A1',
    'Bridal Lehengas',
    '45000',
    'DRAFT',
    'Zardozi;Kundan',
    'A stunning bridal lehenga with gold embroidery',
    '"This piece features intricate zardozi work with kundan embellishments. Perfect for wedding ceremonies."',
    '',
    '"https://example.com/lehenga-a1.jpg"',
  ].join(',');

  // Example 2a: Multi-color product, first row (anchor row with all metadata)
  const example2a = [
    'Evening Gown B1',
    'Evening Gowns',
    '35000',
    'DRAFT',
    'Cut;Thread',
    'Elegant evening gown available in multiple colors',
    '"A timeless evening gown with sophisticated design. Features premium fabric and expert tailoring."',
    'Red',
    '"https://example.com/gown-b1-red-front.jpg"',
  ].join(',');

  // Example 2b: Multi-color product, second row (same product, different image/color info)
  const example2b = ['Evening Gown B1', '', '', '', '', '', '', '', '"https://example.com/gown-b1-red-back.jpg"'].join(',');

  // Example 2c: Multi-color product, third row (same product, different color)
  const example2c = [
    'Evening Gown B1',
    '',
    '',
    '',
    '',
    '',
    '',
    'Gold',
    '"https://example.com/gown-b1-gold-front.jpg"',
  ].join(',');

  return [header, example1, example2a, example2b, example2c].join('\n');
}

/**
 * Triggers a browser download of the CSV template.
 *
 * This function:
 * 1. Generates the CSV template string
 * 2. Creates a Blob with CSV content
 * 3. Generates a temporary download link
 * 4. Triggers the browser's download dialog
 * 5. Cleans up the temporary resources
 *
 * **Browser-only function.** Should only be called from React event handlers
 * in components marked with 'use client'.
 *
 * @param filename - Optional filename for the download (default: 'MEI-Bulk-Import-Template.csv')
 */
export function downloadTemplate(filename: string = TEMPLATE_FILENAME): void {
  // Generate CSV string
  const csvString = generateCSVTemplate();

  // Create Blob with CSV content and UTF-8 encoding
  const blob = new Blob([csvString], {
    type: 'text/csv;charset=utf-8;',
  });

  // Create temporary URL for the blob
  const url = URL.createObjectURL(blob);

  // Create temporary anchor element for download
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;

  // Trigger download by appending, clicking, and removing the link
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the blob URL to free memory
  URL.revokeObjectURL(url);
}
