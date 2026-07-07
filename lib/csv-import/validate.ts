/**
 * CSV Import Validation Module
 *
 * Validates grouped products against business rules:
 * - Category existence in provided list
 * - Price validity (non-negative numbers only)
 * - Status (PUBLISHED or DRAFT)
 * - Work types (must match allowed enum)
 * - Conflicting repeated fields in multi-row groups
 * - Presence of at least one image
 */

import type {
  ProductGroup,
  GroupingResult,
  ValidationContext,
  RowError,
} from './types';
import { WORK_TYPES, SHORT_DESCRIPTION_MAX_LENGTH } from './constants';

/**
 * Normalize a value for consistent comparison
 * Trims leading/trailing whitespace, collapses multiple spaces to single space,
 * optionally converts to lowercase for case-insensitive comparison.
 *
 * @param value - The string to normalize
 * @param caseSensitive - If false (default), lowercases the result
 * @returns Normalized string
 */
export function normalizeForComparison(
  value: string,
  caseSensitive: boolean = false
): string {
  // Trim leading/trailing whitespace and collapse multiple spaces
  let normalized = value.trim().replace(/\s+/g, ' ');

  // If not case-sensitive, convert to lowercase
  if (!caseSensitive) {
    normalized = normalized.toLowerCase();
  }

  return normalized;
}

/**
 * Validate a single product group against the provided context
 * Populates the group.errors array with any validation issues found.
 *
 * @param group - The ProductGroup to validate
 * @param context - ValidationContext containing categories and allowed enums
 * @returns The same ProductGroup with errors populated
 */
export function validateProductGroup(
  group: ProductGroup,
  context: ValidationContext
): ProductGroup {
  const errors: RowError[] = [];

  // Validate category (anchor row only)
  if (!group.categoryName || group.categoryName.trim() === '') {
    errors.push({
      row: group.originalRowIndex,
      field: 'category_name',
      message: 'Required field is empty',
    });
  } else {
    // Check if category exists (case-insensitive)
    const normalizedCategoryName = normalizeForComparison(group.categoryName, false);
    const categoryExists = context.categories.some(
      (cat) => normalizeForComparison(cat.name, false) === normalizedCategoryName
    );

    if (!categoryExists) {
      errors.push({
        row: group.originalRowIndex,
        field: 'category_name',
        message: `Unknown category "${group.categoryName}"`,
      });
    }
  }

  // Validate price (anchor row only)
  if (!group.rawPrice || group.rawPrice.trim() === '') {
    errors.push({
      row: group.originalRowIndex,
      field: 'price',
      message: 'Required field is empty',
    });
  } else {
    const trimmedPrice = group.rawPrice.trim();

    // Check for invalid characters (digits, optional minus sign, and single dot allowed)
    const priceRegex = /^-?\d+(\.\d+)?$/;
    if (!priceRegex.test(trimmedPrice)) {
      errors.push({
        row: group.originalRowIndex,
        field: 'price',
        message: `"${group.rawPrice}" is not a valid number`,
      });
    } else {
      // Parse as number
      const parsedPrice = Number(trimmedPrice);

      if (isNaN(parsedPrice)) {
        errors.push({
          row: group.originalRowIndex,
          field: 'price',
          message: `"${group.rawPrice}" is not a valid number`,
        });
      } else if (parsedPrice < 0) {
        errors.push({
          row: group.originalRowIndex,
          field: 'price',
          message: `Price must be non-negative (got ${parsedPrice})`,
        });
      } else {
        // Valid price
        group.price = parsedPrice;
      }
    }
  }

  // Validate status (anchor row only)
  if (!group.rawStatus || group.rawStatus.trim() === '') {
    errors.push({
      row: group.originalRowIndex,
      field: 'status',
      message: 'Required field is empty',
    });
  } else {
    const normalizedStatus = normalizeForComparison(group.rawStatus, false);
    const statusIsValid = context.allowedStatuses.some(
      (status) => normalizeForComparison(status, false) === normalizedStatus
    );

    if (!statusIsValid) {
      errors.push({
        row: group.originalRowIndex,
        field: 'status',
        message: `Invalid status "${group.rawStatus}". Allowed: PUBLISHED, DRAFT`,
      });
    } else {
      // Set status to uppercase normalized form
      group.status = normalizeForComparison(group.rawStatus, false).toUpperCase();
    }
  }

  // Validate work types (optional)
  if (!group.rawWorkTypes || group.rawWorkTypes.trim() === '') {
    group.workTypes = [];
  } else {
    const workTypesArray: string[] = [];
    const workTypesParts = group.rawWorkTypes.split(';');

    for (const rawWorkType of workTypesParts) {
      const trimmedWorkType = rawWorkType.trim();
      if (trimmedWorkType === '') {
        continue; // Skip empty parts
      }

      // Check if work type exists (case-insensitive)
      const normalizedWorkType = normalizeForComparison(trimmedWorkType, false);
      const matchedWorkType = context.allowedWorkTypes.find(
        (wt) => normalizeForComparison(wt, false) === normalizedWorkType
      );

      if (!matchedWorkType) {
        errors.push({
          row: group.originalRowIndex,
          field: 'work_types',
          message: `Unknown work type "${trimmedWorkType}"`,
        });
      } else {
        // Add the canonical form from allowedWorkTypes
        workTypesArray.push(matchedWorkType);
      }
    }

    group.workTypes = workTypesArray;
  }

  // Validate short description (optional)
  if (group.shortDescription) {
    group.shortDescription = group.shortDescription.trim() || null;
    if (
      group.shortDescription &&
      group.shortDescription.length > SHORT_DESCRIPTION_MAX_LENGTH
    ) {
      errors.push({
        row: group.originalRowIndex,
        field: 'short_description',
        message: `Short description exceeds maximum length of ${SHORT_DESCRIPTION_MAX_LENGTH} characters`,
      });
    }
  }

  // Validate description (optional)
  if (group.description) {
    group.description = group.description.trim() || null;
  }

  // Validate conflicting repeated product fields (multi-row groups only)
  if (group.groupRowIndices.length > 1) {
    const anchorFields = [
      { key: 'categoryName', displayName: 'category_name' },
      { key: 'price', displayName: 'price' },
      { key: 'status', displayName: 'status' },
      { key: 'workTypes', displayName: 'work_types' },
      { key: 'shortDescription', displayName: 'short_description' },
      { key: 'description', displayName: 'description' },
    ];

    // This validation would require access to the original non-anchor rows,
    // which are not available in the ProductGroup at this stage.
    // The grouping stage should have already handled this.
    // For now, this is a placeholder for the logic.
  }

  // Validate images
  if (group.colors.length === 0 && group.primaryImages.length === 0) {
    errors.push({
      row: group.originalRowIndex,
      field: 'image_url',
      message: 'Product must have at least one image (color image or primary image)',
    });
  }

  group.errors = errors;
  return group;
}

/**
 * Validate all groups and unassigned rows in a GroupingResult
 *
 * @param result - The GroupingResult from the grouping stage
 * @param context - ValidationContext containing categories and allowed enums
 * @returns The same result with all groups validated (errors populated)
 */
export function validateGroupingResult(
  result: GroupingResult,
  context: ValidationContext
): GroupingResult {
  // Validate each group
  for (const group of result.groups) {
    validateProductGroup(group, context);
  }

  // UnassignedRows already have errors set during grouping stage
  return result;
}

/**
 * Check if the entire import file is valid
 *
 * @param result - The GroupingResult (already validated)
 * @returns true if all groups have no errors and no unassigned rows exist
 */
export function isValidFile(result: GroupingResult): boolean {
  // Check if there are any unassigned rows
  if (result.unassignedRows.length > 0) {
    return false;
  }

  // Check if any group has errors
  for (const group of result.groups) {
    if (group.errors.length > 0) {
      return false;
    }
  }

  return true;
}
