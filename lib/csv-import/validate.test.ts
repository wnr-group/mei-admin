/**
 * Unit tests for the CSV import validation module
 *
 * Tests cover:
 * - String normalization for comparison
 * - Product group validation (all fields)
 * - Grouping result validation
 * - File validity checks
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeForComparison,
  validateProductGroup,
  validateGroupingResult,
  isValidFile,
} from './validate';
import type {
  ProductGroup,
  GroupingResult,
  ValidationContext,
} from './types';

// Mock categories for testing
const mockCategories = [
  { id: '1', name: 'Bridal Lehengas' },
  { id: '2', name: 'Evening Gowns' },
];

// Mock context with allowed values
const mockContext: ValidationContext = {
  categories: mockCategories,
  allowedWorkTypes: ['Aari', 'Zardozi', 'Mirror', 'Cut', 'Thread', 'Tailoring', 'Kundan'],
  allowedStatuses: ['PUBLISHED', 'DRAFT'],
};

// Helper to create a valid ProductGroup for testing
function createMockProductGroup(overrides: Partial<ProductGroup> = {}): ProductGroup {
  return {
    name: 'Test Product',
    rawName: 'Test Product',
    originalRowIndex: 1,
    categoryName: 'Bridal Lehengas',
    price: 50000,
    rawPrice: '50000',
    status: 'PUBLISHED',
    rawStatus: 'PUBLISHED',
    workTypes: ['Zardozi'],
    rawWorkTypes: 'Zardozi',
    shortDescription: 'Test short description',
    description: 'Test long description',
    colors: [
      {
        label: 'Red',
        imageUrls: ['https://example.com/red.jpg'],
      },
    ],
    primaryImages: [],
    errors: [],
    groupRowIndices: [1],
    ...overrides,
  };
}

describe('normalizeForComparison', () => {
  it('should trim and collapse spaces, lowercasing by default', () => {
    const result = normalizeForComparison('  PUBLISHED  ');
    expect(result).toBe('published');
  });

  it('should handle multiple consecutive spaces', () => {
    const result = normalizeForComparison('Aari;   Zardozi');
    expect(result).toBe('aari; zardozi');
  });

  it('should preserve case when caseSensitive is true', () => {
    const result = normalizeForComparison('  PUBLISHED  ', true);
    expect(result).toBe('PUBLISHED');
  });

  it('should handle empty strings', () => {
    const result = normalizeForComparison('   ');
    expect(result).toBe('');
  });
});

describe('validateProductGroup', () => {
  it('should detect missing category', () => {
    const group = createMockProductGroup({
      categoryName: '',
      rawPrice: '50000',
      rawStatus: 'PUBLISHED',
      colors: [{ label: 'Red', imageUrls: ['url'] }],
    });

    const result = validateProductGroup(group, mockContext);

    expect(result.errors.some((e) => e.field === 'category_name')).toBe(true);
    expect(
      result.errors.find((e) => e.field === 'category_name')?.message
    ).toBe('Required field is empty');
  });

  it('should detect unknown category', () => {
    const group = createMockProductGroup({
      categoryName: 'Gownz',
      rawPrice: '50000',
      rawStatus: 'PUBLISHED',
      colors: [{ label: 'Red', imageUrls: ['url'] }],
    });

    const result = validateProductGroup(group, mockContext);

    expect(result.errors.some((e) => e.field === 'category_name')).toBe(true);
    expect(result.errors.find((e) => e.field === 'category_name')?.message).toContain(
      'Unknown category'
    );
  });

  it('should accept category with different case', () => {
    const group = createMockProductGroup({
      categoryName: 'bridal lehengas',
      rawPrice: '50000',
      rawStatus: 'PUBLISHED',
      colors: [{ label: 'Red', imageUrls: ['url'] }],
    });

    const result = validateProductGroup(group, mockContext);

    expect(result.errors.filter((e) => e.field === 'category_name')).toHaveLength(0);
  });

  it('should detect invalid price (non-numeric)', () => {
    const group = createMockProductGroup({
      rawPrice: 'abc',
      colors: [{ label: 'Red', imageUrls: ['url'] }],
    });

    const result = validateProductGroup(group, mockContext);

    expect(result.errors.some((e) => e.field === 'price')).toBe(true);
    expect(result.errors.find((e) => e.field === 'price')?.message).toContain(
      'is not a valid number'
    );
  });

  it('should detect negative price', () => {
    const group = createMockProductGroup({
      rawPrice: '-1000',
      colors: [{ label: 'Red', imageUrls: ['url'] }],
    });

    const result = validateProductGroup(group, mockContext);

    expect(result.errors.some((e) => e.field === 'price')).toBe(true);
    expect(result.errors.find((e) => e.field === 'price')?.message).toContain(
      'must be non-negative'
    );
  });

  it('should accept valid price formats', () => {
    const testCases = ['45000', '45000.00', ' 45000 ', '45000.5'];

    for (const priceStr of testCases) {
      const group = createMockProductGroup({
        rawPrice: priceStr,
        colors: [{ label: 'Red', imageUrls: ['url'] }],
      });

      const result = validateProductGroup(group, mockContext);
      expect(result.errors.filter((e) => e.field === 'price')).toHaveLength(0);
      expect(result.price).toBe(Number(priceStr.trim()));
    }
  });

  it('should detect missing price', () => {
    const group = createMockProductGroup({
      rawPrice: '',
      colors: [{ label: 'Red', imageUrls: ['url'] }],
    });

    const result = validateProductGroup(group, mockContext);

    expect(result.errors.some((e) => e.field === 'price')).toBe(true);
    expect(result.errors.find((e) => e.field === 'price')?.message).toBe(
      'Required field is empty'
    );
  });

  it('should detect invalid status', () => {
    const group = createMockProductGroup({
      rawStatus: 'ARCHIVED',
      colors: [{ label: 'Red', imageUrls: ['url'] }],
    });

    const result = validateProductGroup(group, mockContext);

    expect(result.errors.some((e) => e.field === 'status')).toBe(true);
    expect(result.errors.find((e) => e.field === 'status')?.message).toContain(
      'Invalid status'
    );
  });

  it('should accept status with different case', () => {
    const group = createMockProductGroup({
      rawStatus: 'draft',
      colors: [{ label: 'Red', imageUrls: ['url'] }],
    });

    const result = validateProductGroup(group, mockContext);

    expect(result.errors.filter((e) => e.field === 'status')).toHaveLength(0);
    expect(result.status).toBe('DRAFT');
  });

  it('should accept valid work types', () => {
    const group = createMockProductGroup({
      rawWorkTypes: 'Zardozi;Kundan',
      colors: [{ label: 'Red', imageUrls: ['url'] }],
    });

    const result = validateProductGroup(group, mockContext);

    expect(result.errors.filter((e) => e.field === 'work_types')).toHaveLength(0);
    expect(result.workTypes).toEqual(['Zardozi', 'Kundan']);
  });

  it('should detect unknown work type', () => {
    const group = createMockProductGroup({
      rawWorkTypes: 'Zardozi;Unknown',
      colors: [{ label: 'Red', imageUrls: ['url'] }],
    });

    const result = validateProductGroup(group, mockContext);

    expect(result.errors.some((e) => e.field === 'work_types')).toBe(true);
    expect(result.errors.find((e) => e.field === 'work_types')?.message).toContain(
      'Unknown work type "Unknown"'
    );
  });

  it('should accept work types with different case', () => {
    const group = createMockProductGroup({
      rawWorkTypes: 'zardozi; kundan',
      colors: [{ label: 'Red', imageUrls: ['url'] }],
    });

    const result = validateProductGroup(group, mockContext);

    expect(result.errors.filter((e) => e.field === 'work_types')).toHaveLength(0);
    expect(result.workTypes).toEqual(['Zardozi', 'Kundan']);
  });

  it('should handle empty work types', () => {
    const group = createMockProductGroup({
      rawWorkTypes: '',
      colors: [{ label: 'Red', imageUrls: ['url'] }],
    });

    const result = validateProductGroup(group, mockContext);

    expect(result.errors.filter((e) => e.field === 'work_types')).toHaveLength(0);
    expect(result.workTypes).toEqual([]);
  });

  it('should detect missing images', () => {
    const group = createMockProductGroup({
      colors: [],
      primaryImages: [],
    });

    const result = validateProductGroup(group, mockContext);

    expect(result.errors.some((e) => e.field === 'image_url')).toBe(true);
    expect(result.errors.find((e) => e.field === 'image_url')?.message).toContain(
      'must have at least one image'
    );
  });

  it('should accept product with color images', () => {
    const group = createMockProductGroup({
      colors: [{ label: 'Red', imageUrls: ['url'] }],
      primaryImages: [],
    });

    const result = validateProductGroup(group, mockContext);

    expect(result.errors.filter((e) => e.field === 'image_url')).toHaveLength(0);
  });

  it('should accept product with primary images', () => {
    const group = createMockProductGroup({
      colors: [],
      primaryImages: [{ url: 'https://example.com/image.jpg', isFromRow: 1 }],
    });

    const result = validateProductGroup(group, mockContext);

    expect(result.errors.filter((e) => e.field === 'image_url')).toHaveLength(0);
  });

  it('should trim and preserve descriptions', () => {
    const group = createMockProductGroup({
      shortDescription: '  Brief description  ',
      description: '  Longer\n  description  ',
      colors: [{ label: 'Red', imageUrls: ['url'] }],
    });

    const result = validateProductGroup(group, mockContext);

    expect(result.shortDescription).toBe('Brief description');
    expect(result.description).toContain('description');
  });

  it('should detect conflicting category in non-anchor rows', () => {
    const group = createMockProductGroup({
      categoryName: 'Bridal Lehengas',
      colors: [{ label: 'Red', imageUrls: ['url'] }],
      groupRowIndices: [1, 2],
      nonAnchorRowsData: [
        {
          rowIndex: 2,
          categoryName: 'Evening Gowns',
        },
      ],
    });

    const result = validateProductGroup(group, mockContext);

    expect(result.errors.some((e) => e.field === 'category_name')).toBe(true);
    expect(result.errors.find((e) => e.field === 'category_name')?.message).toContain(
      'Conflicting category_name'
    );
  });

  it('should accept matching category in non-anchor rows (case-insensitive)', () => {
    const group = createMockProductGroup({
      categoryName: 'Bridal Lehengas',
      colors: [{ label: 'Red', imageUrls: ['url'] }],
      groupRowIndices: [1, 2],
      nonAnchorRowsData: [
        {
          rowIndex: 2,
          categoryName: 'bridal lehengas',
        },
      ],
    });

    const result = validateProductGroup(group, mockContext);

    expect(result.errors.filter((e) => e.field === 'category_name')).toHaveLength(0);
  });

  it('should ignore blank anchor field values in non-anchor rows', () => {
    const group = createMockProductGroup({
      categoryName: 'Bridal Lehengas',
      rawPrice: '50000',
      colors: [{ label: 'Red', imageUrls: ['url'] }],
      groupRowIndices: [1, 2],
      nonAnchorRowsData: [
        {
          rowIndex: 2,
          categoryName: '', // blank - should be ignored
          rawPrice: '',     // blank - should be ignored
        },
      ],
    });

    const result = validateProductGroup(group, mockContext);

    // No conflict errors should be present
    expect(result.errors.filter((e) => e.field === 'category_name')).toHaveLength(0);
    expect(result.errors.filter((e) => e.field === 'price')).toHaveLength(0);
  });

  it('should detect conflicting price in non-anchor rows', () => {
    const group = createMockProductGroup({
      rawPrice: '50000',
      price: 50000,
      colors: [{ label: 'Red', imageUrls: ['url'] }],
      groupRowIndices: [1, 2],
      nonAnchorRowsData: [
        {
          rowIndex: 2,
          rawPrice: '60000',
        },
      ],
    });

    const result = validateProductGroup(group, mockContext);

    expect(result.errors.some((e) => e.field === 'price')).toBe(true);
    expect(result.errors.find((e) => e.field === 'price')?.message).toContain(
      'Conflicting price'
    );
  });

  it('should detect conflicting status in non-anchor rows', () => {
    const group = createMockProductGroup({
      rawStatus: 'PUBLISHED',
      status: 'PUBLISHED',
      colors: [{ label: 'Red', imageUrls: ['url'] }],
      groupRowIndices: [1, 2],
      nonAnchorRowsData: [
        {
          rowIndex: 2,
          rawStatus: 'DRAFT',
        },
      ],
    });

    const result = validateProductGroup(group, mockContext);

    expect(result.errors.some((e) => e.field === 'status')).toBe(true);
    expect(result.errors.find((e) => e.field === 'status')?.message).toContain(
      'Conflicting status'
    );
  });

  it('should detect conflicting work types in non-anchor rows', () => {
    const group = createMockProductGroup({
      rawWorkTypes: 'Zardozi',
      workTypes: ['Zardozi'],
      colors: [{ label: 'Red', imageUrls: ['url'] }],
      groupRowIndices: [1, 2],
      nonAnchorRowsData: [
        {
          rowIndex: 2,
          rawWorkTypes: 'Kundan',
        },
      ],
    });

    const result = validateProductGroup(group, mockContext);

    expect(result.errors.some((e) => e.field === 'work_types')).toBe(true);
    expect(result.errors.find((e) => e.field === 'work_types')?.message).toContain(
      'Conflicting work_types'
    );
  });

  it('should accept matching work types in non-anchor rows (case-insensitive)', () => {
    const group = createMockProductGroup({
      rawWorkTypes: 'Zardozi',
      workTypes: ['Zardozi'],
      colors: [{ label: 'Red', imageUrls: ['url'] }],
      groupRowIndices: [1, 2],
      nonAnchorRowsData: [
        {
          rowIndex: 2,
          rawWorkTypes: 'zardozi',
        },
      ],
    });

    const result = validateProductGroup(group, mockContext);

    expect(result.errors.filter((e) => e.field === 'work_types')).toHaveLength(0);
  });

  it('should detect conflicting short description in non-anchor rows', () => {
    const group = createMockProductGroup({
      shortDescription: 'Original description',
      colors: [{ label: 'Red', imageUrls: ['url'] }],
      groupRowIndices: [1, 2],
      nonAnchorRowsData: [
        {
          rowIndex: 2,
          shortDescription: 'Different description',
        },
      ],
    });

    const result = validateProductGroup(group, mockContext);

    expect(result.errors.some((e) => e.field === 'short_description')).toBe(true);
    expect(result.errors.find((e) => e.field === 'short_description')?.message).toContain(
      'Conflicting short_description'
    );
  });

  it('should detect conflicting description in non-anchor rows', () => {
    const group = createMockProductGroup({
      description: 'Original long description',
      colors: [{ label: 'Red', imageUrls: ['url'] }],
      groupRowIndices: [1, 2],
      nonAnchorRowsData: [
        {
          rowIndex: 2,
          description: 'Different long description',
        },
      ],
    });

    const result = validateProductGroup(group, mockContext);

    expect(result.errors.some((e) => e.field === 'description')).toBe(true);
    expect(result.errors.find((e) => e.field === 'description')?.message).toContain(
      'Conflicting description'
    );
  });

  it('should handle multiple conflicting fields in a single non-anchor row', () => {
    const group = createMockProductGroup({
      categoryName: 'Bridal Lehengas',
      rawPrice: '50000',
      rawStatus: 'PUBLISHED',
      colors: [{ label: 'Red', imageUrls: ['url'] }],
      groupRowIndices: [1, 2],
      nonAnchorRowsData: [
        {
          rowIndex: 2,
          categoryName: 'Evening Gowns',
          rawPrice: '60000',
          rawStatus: 'DRAFT',
        },
      ],
    });

    const result = validateProductGroup(group, mockContext);

    // Should have at least 3 conflict errors (could have more)
    const conflictErrors = result.errors.filter((e) =>
      ['category_name', 'price', 'status'].includes(e.field)
    );
    expect(conflictErrors.length).toBeGreaterThanOrEqual(3);
  });
});

describe('validateGroupingResult', () => {
  it('should validate all groups in result', () => {
    const result: GroupingResult = {
      groups: [
        createMockProductGroup({
          name: 'Product 1',
          colors: [{ label: 'Red', imageUrls: ['url'] }],
        }),
        createMockProductGroup({
          name: 'Product 2',
          categoryName: 'InvalidCategory',
          colors: [{ label: 'Red', imageUrls: ['url'] }],
        }),
        createMockProductGroup({
          name: 'Product 3',
          colors: [{ label: 'Red', imageUrls: ['url'] }],
        }),
      ],
      unassignedRows: [],
    };

    const validatedResult = validateGroupingResult(result, mockContext);

    // First group should have no errors
    expect(validatedResult.groups[0].errors).toHaveLength(0);

    // Second group should have errors (invalid category)
    expect(validatedResult.groups[1].errors.length).toBeGreaterThan(0);
    expect(validatedResult.groups[1].errors.some((e) => e.field === 'category_name')).toBe(
      true
    );

    // Third group should have no errors
    expect(validatedResult.groups[2].errors).toHaveLength(0);
  });

  it('should preserve unassigned rows', () => {
    const result: GroupingResult = {
      groups: [createMockProductGroup({ colors: [{ label: 'Red', imageUrls: ['url'] }] })],
      unassignedRows: [
        {
          rowIndex: 5,
          rawData: { name: '', category_name: 'Bridal Lehengas' },
          error: {
            row: 5,
            field: 'name',
            message: 'Missing product name',
          },
        },
      ],
    };

    const validatedResult = validateGroupingResult(result, mockContext);

    expect(validatedResult.unassignedRows).toHaveLength(1);
    expect(validatedResult.unassignedRows[0].rowIndex).toBe(5);
  });
});

describe('isValidFile', () => {
  it('should return true when all groups are valid and no unassigned rows', () => {
    const result: GroupingResult = {
      groups: [
        createMockProductGroup({ colors: [{ label: 'Red', imageUrls: ['url'] }] }),
        createMockProductGroup({ colors: [{ label: 'Blue', imageUrls: ['url'] }] }),
      ],
      unassignedRows: [],
    };

    // Validate first
    validateGroupingResult(result, mockContext);

    expect(isValidFile(result)).toBe(true);
  });

  it('should return false when any group has errors', () => {
    const result: GroupingResult = {
      groups: [
        createMockProductGroup({ colors: [{ label: 'Red', imageUrls: ['url'] }] }),
        createMockProductGroup({
          categoryName: 'InvalidCategory',
          colors: [{ label: 'Red', imageUrls: ['url'] }],
        }),
      ],
      unassignedRows: [],
    };

    // Validate first
    validateGroupingResult(result, mockContext);

    expect(isValidFile(result)).toBe(false);
  });

  it('should return false when unassigned rows exist', () => {
    const result: GroupingResult = {
      groups: [createMockProductGroup({ colors: [{ label: 'Red', imageUrls: ['url'] }] })],
      unassignedRows: [
        {
          rowIndex: 5,
          rawData: { name: '', category_name: 'Bridal Lehengas' },
          error: {
            row: 5,
            field: 'name',
            message: 'Missing product name',
          },
        },
      ],
    };

    // Validate first
    validateGroupingResult(result, mockContext);

    expect(isValidFile(result)).toBe(false);
  });

  it('should return false when both groups have errors and unassigned rows exist', () => {
    const result: GroupingResult = {
      groups: [
        createMockProductGroup({
          categoryName: 'InvalidCategory',
          colors: [{ label: 'Red', imageUrls: ['url'] }],
        }),
      ],
      unassignedRows: [
        {
          rowIndex: 5,
          rawData: { name: '', category_name: 'Bridal Lehengas' },
          error: {
            row: 5,
            field: 'name',
            message: 'Missing product name',
          },
        },
      ],
    };

    // Validate first
    validateGroupingResult(result, mockContext);

    expect(isValidFile(result)).toBe(false);
  });
});
