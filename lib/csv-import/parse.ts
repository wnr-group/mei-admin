/**
 * CSV Parsing Module
 *
 * Provides CSV parsing and validation using PapaParse with RFC4180 compliance.
 * Exports functions to parse CSV text, validate headers, and perform end-to-end
 * file parsing and validation.
 */

import * as Papa from 'papaparse'
import { REQUIRED_COLUMNS } from './constants'
import type { FileValidationError, ParseError, ParseResult } from './types'

/**
 * Parse CSV text using PapaParse
 *
 * Parses raw CSV text into structured row objects with headers as keys.
 * Handles RFC4180 compliance including quoted fields, multiline values, and escaped quotes.
 *
 * @param csvText - Raw CSV text to parse
 * @returns ParseResult with parsed data, errors, and metadata
 */
export function parseCSV(csvText: string): ParseResult {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false, // Keep all values as strings
    transformHeader: (header: string) => header.trim(), // Trim headers
  })

  return {
    data: result.data,
    errors: result.errors as ParseError[],
    meta: {
      fields: result.meta.fields,
    },
  }
}

/**
 * Validate CSV headers against required columns
 *
 * Checks that:
 * - All required headers are present
 * - Headers are trimmed before comparison
 * - No duplicate headers exist
 * - Extra unknown columns are allowed
 *
 * @param headers - Array of header strings from parsed CSV
 * @returns FileValidationError if invalid, null if valid
 */
export function validateHeaders(
  headers: string[] | undefined
): FileValidationError | null {
  // Check if headers exist
  if (!headers || headers.length === 0) {
    return {
      type: 'header',
      message: 'CSV file has no headers',
    }
  }

  // Trim headers for comparison
  const trimmedHeaders = headers.map((h) => h.trim())

  // Check for duplicates
  const uniqueHeaders = new Set(trimmedHeaders)
  if (uniqueHeaders.size !== trimmedHeaders.length) {
    return {
      type: 'header',
      message: 'CSV file contains duplicate headers',
    }
  }

  // Check for required columns
  const missingColumns: string[] = []

  for (const required of REQUIRED_COLUMNS) {
    if (!trimmedHeaders.includes(required)) {
      missingColumns.push(required)
    }
  }

  if (missingColumns.length > 0) {
    return {
      type: 'header',
      message: `Missing required columns: ${missingColumns.join(', ')}`,
    }
  }

  return null
}

/**
 * Parse and validate a CSV file in one step
 *
 * Handles the complete pipeline:
 * 1. Check for empty file
 * 2. Parse with PapaParse
 * 3. Validate headers
 * 4. Return cleaned rows (empty rows filtered by PapaParse)
 *
 * @param csvText - Raw CSV text to parse and validate
 * @returns Object with parsed result, file errors, and cleaned rows
 */
export function parseAndValidateFile(csvText: string): {
  result: ParseResult | null
  fileError: FileValidationError | null
  rows: Array<Record<string, string>> | null
} {
  // Check for empty file
  const trimmedText = csvText.trim()
  if (trimmedText.length === 0) {
    return {
      result: null,
      fileError: {
        type: 'empty',
        message: 'CSV file is empty',
      },
      rows: null,
    }
  }

  // Parse the CSV
  const result = parseCSV(csvText)

  // Check for parsing errors
  if (result.errors && result.errors.length > 0) {
    return {
      result,
      fileError: {
        type: 'parser',
        message: `CSV parsing failed: ${result.errors.map((e) => e.message).join('; ')}`,
      },
      rows: null,
    }
  }

  // Validate headers
  const headerError = validateHeaders(result.meta.fields)
  if (headerError) {
    return {
      result,
      fileError: headerError,
      rows: null,
    }
  }

  // Return cleaned rows (empty rows already filtered by PapaParse's skipEmptyLines)
  return {
    result,
    fileError: null,
    rows: result.data,
  }
}
