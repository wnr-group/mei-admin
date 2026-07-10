/**
 * CSV Grouping Logic
 *
 * Groups CSV rows by product name, tracking colors and images in file order.
 * Handles anchor row identification, color grouping, and unassigned row tracking.
 */

import type {
  ProductGroup,
  GroupingResult,
  UnassignedRow,
  ProductColor,
  ProductImage,
  RowError,
} from './types'

/**
 * Normalize a product name by trimming whitespace and collapsing multiple
 * consecutive spaces to single spaces. Preserves case.
 *
 * @param name - Raw product name from CSV
 * @returns Normalized name
 */
export function normalizeProductName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

/**
 * Check if a string is blank (empty or whitespace-only)
 *
 * @param str - String to check
 * @returns true if string is blank
 */
function isBlank(str: string): boolean {
  return str.trim() === ''
}

/**
 * Group CSV rows by product name, tracking colors and images.
 *
 * Walks through rows in order to maintain file order. The first occurrence
 * of a product name becomes the anchor row. Subsequent rows with the same
 * product name contribute colors and images.
 *
 * @param rows - Array of parsed CSV rows
 * @returns GroupingResult with grouped products and unassigned rows
 */
export function groupRowsByProduct(
  rows: Array<Record<string, string>>
): GroupingResult {
  const groups: ProductGroup[] = []
  const unassignedRows: UnassignedRow[] = []
  const groupMap = new Map<string, ProductGroup>()

  rows.forEach((row, index) => {
    // Row numbers are 1-indexed (row 1 is header, so data starts at row 2)
    const rowNumber = index + 2

    const name = row.name ?? ''

    // Handle blank names
    if (isBlank(name)) {
      const error: RowError = {
        row: rowNumber,
        field: 'name',
        message: 'Missing product name — cannot be grouped into a product',
      }

      unassignedRows.push({
        rowIndex: rowNumber,
        rawData: row,
        error,
      })
      return
    }

    const normalizedName = normalizeProductName(name)
    const colorLabel = row.color_label ?? ''
    const imageUrl = row.image_url ?? ''

    // Check if this is the first occurrence of this product
    if (!groupMap.has(normalizedName)) {
      // Create anchor row for this product
      const newGroup: ProductGroup = {
        name: normalizedName,
        rawName: name,
        originalRowIndex: rowNumber,
        categoryName: row.category_name ?? null,
        price: null, // Will be validated later
        rawPrice: row.price ?? '',
        status: null, // Will be validated later
        rawStatus: row.status ?? '',
        workTypes: [], // Will be normalized later
        rawWorkTypes: row.work_types ?? '',
        shortDescription: row.short_description ?? null,
        description: row.description ?? null,
        colors: [],
        primaryImages: [],
        errors: [],
        groupRowIndices: [rowNumber],
      }

      groups.push(newGroup)
      groupMap.set(normalizedName, newGroup)

      // Process this anchor row's image and color
      if (isBlank(colorLabel)) {
        // Primary image row
        const image: ProductImage = {
          url: imageUrl,
          isFromRow: rowNumber,
        }
        newGroup.primaryImages.push(image)
      } else {
        // Color image row
        const newColor: ProductColor = {
          label: colorLabel,
          imageUrls: [imageUrl],
        }
        newGroup.colors.push(newColor)
      }
    } else {
      // Non-anchor row: add to group's row indices and process images/colors
      const group = groupMap.get(normalizedName)!
      group.groupRowIndices.push(rowNumber)

      // Capture non-anchor row field data for conflict validation
      if (!group.nonAnchorRowsData) {
        group.nonAnchorRowsData = []
      }
      group.nonAnchorRowsData.push({
        rowIndex: rowNumber,
        categoryName: row.category_name,
        rawPrice: row.price,
        rawStatus: row.status,
        rawWorkTypes: row.work_types,
        shortDescription: row.short_description,
        description: row.description,
      })

      // Process image and color
      if (isBlank(colorLabel)) {
        // Primary image row
        const image: ProductImage = {
          url: imageUrl,
          isFromRow: rowNumber,
        }
        group.primaryImages.push(image)
      } else {
        // Color image row
        const existingColor = group.colors.find((c) => c.label === colorLabel)

        if (existingColor) {
          // Color already exists, append image URL
          existingColor.imageUrls.push(imageUrl)
        } else {
          // Create new color
          const newColor: ProductColor = {
            label: colorLabel,
            imageUrls: [imageUrl],
          }
          group.colors.push(newColor)
        }
      }
    }
  })

  return {
    groups,
    unassignedRows,
  }
}
