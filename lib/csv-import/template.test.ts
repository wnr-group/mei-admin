import { describe, it, expect } from 'vitest';
import Papa from 'papaparse';
import {
  generateCSVTemplate,
  TEMPLATE_FILENAME,
} from './template';

describe('template', () => {
  describe('generateCSVTemplate', () => {
    it('should return a string', () => {
      const result = generateCSVTemplate();
      expect(typeof result).toBe('string');
    });

    it('should contain all required headers', () => {
      const result = generateCSVTemplate();
      const firstLine = result.split('\n')[0];
      const expectedHeaders = [
        'name',
        'category_name',
        'price',
        'status',
        'work_types',
        'short_description',
        'description',
        'color_label',
        'image_url',
      ];

      expectedHeaders.forEach((header) => {
        expect(firstLine).toContain(header);
      });
    });

    it('should include example products', () => {
      const result = generateCSVTemplate();
      expect(result).toContain('Bridal Lehenga A1');
      expect(result).toContain('Evening Gown B1');
    });

    it('should show multi-color product correctly with 3 rows', () => {
      const result = generateCSVTemplate();
      const lines = result.split('\n');

      // Count occurrences of "Evening Gown B1"
      const eveningGownCount = lines.filter((line) =>
        line.startsWith('Evening Gown B1')
      ).length;
      expect(eveningGownCount).toBe(3);

      // Check that second row has empty price and category
      const example2bLine = lines[4]; // Index 4 = 5th line (header + 3 data + 1)
      expect(example2bLine).toMatch(/^Evening Gown B1,{2}/); // Starts with "Evening Gown B1,,"
    });

    it('should generate valid RFC4180 CSV that PapaParse can parse', () => {
      const csvString = generateCSVTemplate();

      // Parse using PapaParse
      const result = Papa.parse(csvString, {
        header: true,
        skipEmptyLines: false,
      });

      // Should parse without errors
      expect(result.errors).toEqual([]);

      // Should have data rows (header + examples)
      expect(result.data.length).toBeGreaterThan(0);

      // Verify first data row has expected structure
      const firstRow = result.data[0];
      expect(firstRow).toHaveProperty('name');
      expect(firstRow).toHaveProperty('category_name');
      expect(firstRow).toHaveProperty('price');
      expect(firstRow).toHaveProperty('status');
      expect(firstRow).toHaveProperty('work_types');
      expect(firstRow).toHaveProperty('short_description');
      expect(firstRow).toHaveProperty('description');
      expect(firstRow).toHaveProperty('color_label');
      expect(firstRow).toHaveProperty('image_url');
    });

    it('should properly quote fields with newlines and commas', () => {
      const result = generateCSVTemplate();

      // Parse the CSV to verify quoted multiline fields are handled
      const parsed = Papa.parse(result, {
        header: true,
      });

      // Type the parsed data array properly
      const data = parsed.data as Array<Record<string, string>>;

      // Find the Bridal Lehenga product
      const bridalRow = data.find(
        (row) => row.name === 'Bridal Lehenga A1'
      );

      expect(bridalRow).toBeDefined();

      // The description should be properly unquoted and contain the full text
      if (bridalRow) {
        expect(bridalRow.description).toContain('zardozi work');
        expect(bridalRow.description).toContain('kundan embellishments');
      }

      // Find the Evening Gown product
      const eveningRow = data.find(
        (row) => row.name === 'Evening Gown B1'
      );

      expect(eveningRow).toBeDefined();

      // The description should be multiline and properly preserved
      if (eveningRow) {
        expect(eveningRow.description).toContain('sophisticated design');
        expect(eveningRow.description).toContain('expert tailoring');
      }
    });
  });

  describe('TEMPLATE_FILENAME', () => {
    it('should be the correct constant value', () => {
      expect(TEMPLATE_FILENAME).toBe('MEI-Bulk-Import-Template.csv');
    });
  });
});
