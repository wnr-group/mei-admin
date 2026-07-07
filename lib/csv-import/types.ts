/**
 * CSV Import Types
 *
 * Core TypeScript interfaces and types for the entire CSV import pipeline.
 * This module defines the structure of data at each stage: parsing, grouping,
 * validation, and template generation.
 */

/**
 * Error information for a specific row and field in the CSV
 */
export interface RowError {
  /** 1-indexed CSV row number (where 1 is the header row) */
  row: number;
  /** Column name where the error occurred */
  field: string;
  /** Human-readable error description */
  message: string;
}

/**
 * PapaParse result object after parsing a CSV file
 */
export interface ParseResult {
  /** Array of parsed row objects; each row is a Record with column names as keys */
  data: Record<string, string>[];
  /** Array of PapaParse errors (parsing errors, not validation errors) */
  errors: ParseError[];
  /** Metadata about the parsed file, including detected headers */
  meta: {
    fields?: string[];
  };
}

/**
 * PapaParse error structure
 */
export interface ParseError {
  type: string;
  code: string;
  message: string;
  row?: number;
}

/**
 * Represents a single color variant with its associated images
 */
export interface ProductColor {
  /** Display label for the color (e.g., "Red", "Gold", "Blue") */
  label: string;
  /** Array of image URLs for this color (one or more) */
  imageUrls: string[];
}

/**
 * Represents a single product image with its source information
 */
export interface ProductImage {
  /** The image URL */
  url: string;
  /** 1-indexed CSV row number that contributed this image */
  isFromRow: number;
}

/**
 * Represents a grouped product after the grouping stage
 *
 * Multiple rows in the CSV can describe one product (one row per color/image).
 * This interface holds the merged result with all metadata and validation state.
 */
export interface ProductGroup {
  /** Normalized product name (trimmed, case-adjusted) */
  name: string;
  /** Original product name from the CSV (before normalization) */
  rawName: string;
  /** 1-indexed row number of the anchor (first/main) row for this product */
  originalRowIndex: number;
  /** Category name from the anchor row (may be null if not provided or invalid) */
  categoryName: string | null;
  /** Parsed price as a number (null if unparsed or invalid) */
  price: number | null;
  /** Unparsed price string from the CSV */
  rawPrice: string;
  /** Product status: 'PUBLISHED' or 'DRAFT' (null if invalid) */
  status: string | null;
  /** Unparsed status string from the CSV */
  rawStatus: string;
  /** Array of normalized work type strings; empty array if none provided */
  workTypes: string[];
  /** Unparsed semicolon-separated work types string from the CSV */
  rawWorkTypes: string;
  /** Short product description from the anchor row (null if not provided) */
  shortDescription: string | null;
  /** Long product description from the anchor row (null if not provided) */
  description: string | null;
  /** Array of color variants with their images, in order of first appearance */
  colors: ProductColor[];
  /** Array of images from rows with blank color_label (primary/main images) */
  primaryImages: ProductImage[];
  /** Validation errors for this product group; empty array if all valid */
  errors: RowError[];
  /** All 1-indexed row numbers that belong to this product group */
  groupRowIndices: number[];
}

/**
 * Result of the grouping stage
 *
 * Contains successfully grouped products and rows that could not be assigned
 * to any product (rows with blank product names).
 */
export interface GroupingResult {
  /** Grouped products in order of first appearance */
  groups: ProductGroup[];
  /** Rows that could not be assigned to any product group */
  unassignedRows: UnassignedRow[];
}

/**
 * Represents a row that could not be grouped into any product
 *
 * This occurs when a row has a blank product name field.
 */
export interface UnassignedRow {
  /** 1-indexed row number in the CSV */
  rowIndex: number;
  /** Full parsed row data from the CSV */
  rawData: Record<string, string>;
  /** Error describing why this row could not be grouped */
  error: RowError;
}

/**
 * Context information used during validation
 *
 * Provides access to the list of valid categories, work types, and statuses
 * that the validator uses to check product group data.
 */
export interface ValidationContext {
  /** List of valid categories with id and name */
  categories: Array<{
    id: string;
    name: string;
  }>;
  /** Allowed work type values (from WORK_TYPES constant) */
  allowedWorkTypes: string[];
  /** Allowed status values: ['PUBLISHED', 'DRAFT'] */
  allowedStatuses: string[];
}

/**
 * File-level validation error
 *
 * Indicates problems with the entire file (missing headers, empty file, parse errors)
 * rather than individual rows or fields.
 */
export interface FileValidationError {
  /** Classification of the error: 'header' (missing required columns), 'empty' (no data), or 'parser' (CSV parsing failed) */
  type: 'header' | 'empty' | 'parser';
  /** Human-readable error message */
  message: string;
}

/**
 * Template example row for CSV import
 *
 * Used to generate sample CSV templates that show users the required format
 * and example values for each field.
 */
export interface TemplateExample {
  /** Example product name */
  name: string;
  /** Example category name */
  categoryName: string;
  /** Example price (numeric) */
  price: number;
  /** Example status: 'PUBLISHED' or 'DRAFT' */
  status: string;
  /** Example work types (semicolon-separated string) */
  workTypes: string;
  /** Example short description */
  shortDescription: string;
  /** Example long description */
  description: string;
  /** Example color label (empty string for primary image) */
  colorLabel: string;
  /** Example image URL */
  imageUrl: string;
}
