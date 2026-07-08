import { createClient } from '@/lib/supabase/client'
import { getProductBySlug, getProductByCode, deleteProduct } from '@/services/products'
import { uploadProductImage } from '@/services/storage'
import { generateSlug } from '@/lib/slug'
import { generateProductCode } from '@/lib/product-code'
import { normalizeForComparison } from '@/lib/csv-import/validate'
import { withRetry, withRetryableQuery } from '@/lib/retry'
import { classifyError, ImportStageError, type ImportErrorCode } from '@/lib/import-errors'
import { MAX_SLUG_CODE_ATTEMPTS, MAX_IMPORT_PRODUCTS, PRODUCT_INSERT_CHUNK_SIZE } from '@/lib/product-import-constants'
import { logAuditEvent } from '@/lib/audit'
import { captureError } from '@/lib/monitoring'
import { validateImageFile } from '@/lib/validators/image'
import type { ProductGroup } from '@/lib/csv-import/types'
import type { Json } from '@/types/database'

export function resolveCategoryId(
  categoryName: string,
  categories: Array<{ id: string; name: string }>
): string | null {
  const normalized = normalizeForComparison(categoryName, false)
  const match = categories.find((c) => normalizeForComparison(c.name, false) === normalized)
  return match?.id ?? null
}

export async function resolveUniqueSlug(name: string, reservedSlugs: Set<string>): Promise<string | null> {
  const baseSlug = generateSlug(name)
  for (let attempt = 1; attempt <= MAX_SLUG_CODE_ATTEMPTS; attempt++) {
    const candidate = attempt === 1 ? baseSlug : `${baseSlug}-${attempt}`
    if (reservedSlugs.has(candidate)) continue
    const existing = await withRetry(() => getProductBySlug(candidate))
    if (!existing) {
      reservedSlugs.add(candidate)
      return candidate
    }
  }
  return null
}

export async function resolveUniqueProductCode(name: string, reservedCodes: Set<string>): Promise<string | null> {
  for (let attempt = 1; attempt <= MAX_SLUG_CODE_ATTEMPTS; attempt++) {
    const candidate = generateProductCode(name)
    if (reservedCodes.has(candidate)) continue
    const existing = await withRetry(() => getProductByCode(candidate))
    if (!existing) {
      reservedCodes.add(candidate)
      return candidate
    }
  }
  return null
}

/**
 * Finds which of the given product names already exist (case-insensitively,
 * ignoring soft-deleted rows). Used as a pre-import duplicate-import
 * safeguard: if an admin re-uploads a CSV they already imported, the
 * matching names surface in a confirmation prompt before any writes happen
 * (see ImportPageClient.tsx). There is no import-history table in this
 * schema, so this name-based check — rather than a CSV checksum or session
 * id, which would need new tables — is the pragmatic, zero-new-schema
 * safeguard for this ticket's scope.
 */
export async function findExistingProductNames(names: string[]): Promise<string[]> {
  if (names.length === 0) return []
  const supabase = createClient()
  const response = await withRetryableQuery(async () =>
    await supabase.from('products').select('name').is('deleted_at', null)
  )
  const { data, error } = response as { data: Array<{ name: string }> | null; error: { message: string } | null }
  if (error) throw new Error(error.message)

  const existingNormalized = new Set((data ?? []).map((p) => normalizeForComparison(p.name, false)))
  return names.filter((name) => existingNormalized.has(normalizeForComparison(name, false)))
}

export type ImportStage =
  | 'RESOLVING_CATEGORIES'
  | 'GENERATING_IDENTIFIERS'
  | 'CREATING_PRODUCTS'
  | 'CREATING_COLORS_AND_MEDIA'
  | 'LOGGING_AUDIT'
  | 'COMPLETED'

export interface BulkImportOptions {
  filename?: string
  onProgress?: (stage: ImportStage) => void
  /** Aborts outstanding product/color/media insert requests when the caller
   * cancels (e.g. ImportPageClient unmounting mid-import) — see "AbortController
   * Support" in the Production Readiness Review. Does not roll back writes
   * that already committed before the signal fired. */
  signal?: AbortSignal
}

export interface BulkImportProductResult {
  name: string
  success: boolean
  productId?: string
  error?: string
  errorCode?: ImportErrorCode
}

export interface BulkImportSummary {
  successCount: number
  failureCount: number
  productsCreated: number
  colorsCreated: number
  mediaCreated: number
  rowsProcessed: number
  durationMs: number
  /** Throughput metrics computed from wall-clock timestamps already tracked
   * during the import — no additional infrastructure. All three fall back to
   * the raw count (never NaN/Infinity) if durationMs rounds to 0. */
  productsPerSecond: number
  rowsPerSecond: number
  averageChunkDurationMs: number
  results: BulkImportProductResult[]
}

interface ResolvedProductRow {
  group: ProductGroup
  slug: string
  productCode: string
  categoryId: string
}

/**
 * Downloads an image from an external URL, validates it (MIME type, size),
 * uploads it to Supabase Storage, and returns the Storage public URL.
 * On any error (download, validation, or upload), logs the error but returns
 * null instead of crashing — this allows the import to continue with other
 * images/products even if a single image fails.
 */
async function downloadValidateAndUploadImage(
  imageUrl: string,
  productId: string
): Promise<string | null> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  try {
    // Step 1: Download the image with a short timeout
    const controller = new AbortController()
    timeoutId = setTimeout(() => controller.abort(), 500)

    const response = await fetch(imageUrl, { signal: controller.signal })

    if (!response.ok) {
      captureError(new Error(`Failed to download image: ${response.statusText}`), {
        context: 'csv-import-image-download',
        imageUrl,
        productId,
        status: String(response.status),
      })
      return null
    }

    const buffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'image/jpeg'

    // Step 2: Create a File object with proper MIME type
    const file = new File([buffer], `image-${Date.now()}`, { type: contentType })

    // Step 3: Validate the file
    const validationError = validateImageFile(file)
    if (validationError) {
      captureError(new Error(`Image validation failed: ${validationError.message}`), {
        context: 'csv-import-image-validation',
        imageUrl,
        productId,
        validationCode: validationError.code,
      })
      return null
    }

    // Step 4: Upload to Supabase Storage
    const storageUrl = await uploadProductImage(file, productId)
    return storageUrl
  } catch (err) {
    // Log download/upload failures but don't crash the import
    if (err instanceof Error) {
      captureError(err, {
        context: 'csv-import-image-upload-error',
        imageUrl,
        productId,
        errorName: err.name,
      })
    }
    return null
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
  }
}

interface ColorAndMediaCounts {
  colorsCreated: number
  mediaCreated: number
  primaryImageStorageUrl?: string
}

/**
 * Creates product_colors and product_media rows for one product in at most
 * two round trips (one multi-row insert per table), instead of one insert
 * per color/image — the existing single-row createColor()/uploadMedia()
 * helpers stay in place for their own single-item call sites (the color
 * dialog, the media uploader) but don't support arrays, so this bulk path
 * writes its own batched inserts against the same tables. Deduplicates
 * identical image URLs within the same product/color scope, and marks
 * exactly one image per color (and one product-level primary image) as
 * is_primary — matching the partial unique indexes on product_media
 * (idx_pm_primary_product / idx_pm_primary_color).
 *
 * Also downloads and uploads external image URLs to Supabase Storage,
 * storing the Storage public URLs in product_media.url instead of external URLs.
 * Image upload failures are logged but do not crash the import.
 */
async function createColorsAndMedia(productId: string, group: ProductGroup, signal?: AbortSignal): Promise<ColorAndMediaCounts> {
  const supabase = createClient()
  const colorIdByLabel = new Map<string, string>()
  let colorsCreated = 0

  if (group.colors.length > 0) {
    const colorRows = group.colors.map((color, index) => ({
      product_id: productId,
      label: color.label,
      sort_order: index,
    }))

    const response = await withRetryableQuery(async () => {
      let query = supabase.from('product_colors').insert(colorRows as never).select('id, label')
      if (signal) query = query.abortSignal(signal)
      return await query
    })
    const { data, error } = response as { data: Array<{ id: string; label: string }> | null; error: { message: string } | null }
    if (error) throw new ImportStageError('COLOR_INSERT_FAILED', error.message)

    for (const created of data ?? []) colorIdByLabel.set(created.label, created.id)
    colorsCreated = data?.length ?? 0
  }

  const seenUrls = new Set<string>()
  const uploadedUrls = new Map<string, string>()  // Maps external URL -> Storage URL
  const mediaRows: Array<{ product_id: string; color_id: string | null; url: string; is_primary: boolean; sort_order: number }> = []

  // Download and upload color images
  for (const color of group.colors) {
    const colorId = colorIdByLabel.get(color.label)
    if (!colorId) continue
    let index = 0
    for (const externalUrl of color.imageUrls) {
      const dedupeKey = `${colorId}:${externalUrl}`
      if (seenUrls.has(dedupeKey)) continue
      seenUrls.add(dedupeKey)

      // Try to upload the image; fall back to external URL if upload fails
      let finalUrl = externalUrl
      if (!uploadedUrls.has(externalUrl)) {
        const uploadedUrl = await downloadValidateAndUploadImage(externalUrl, productId)
        if (uploadedUrl) {
          uploadedUrls.set(externalUrl, uploadedUrl)
          finalUrl = uploadedUrl
        }
      } else {
        finalUrl = uploadedUrls.get(externalUrl)!
      }

      mediaRows.push({ product_id: productId, color_id: colorId, url: finalUrl, is_primary: index === 0, sort_order: index })
      index++
    }
  }

  // Download and upload primary images
  let primaryIndex = 0
  let primaryImageStorageUrl: string | undefined
  for (const image of group.primaryImages) {
    const dedupeKey = `primary:${image.url}`
    if (seenUrls.has(dedupeKey)) continue
    seenUrls.add(dedupeKey)

    // Try to upload the image; fall back to external URL if upload fails
    let finalUrl = image.url
    if (!uploadedUrls.has(image.url)) {
      const uploadedUrl = await downloadValidateAndUploadImage(image.url, productId)
      if (uploadedUrl) {
        uploadedUrls.set(image.url, uploadedUrl)
        finalUrl = uploadedUrl
      }
    } else {
      finalUrl = uploadedUrls.get(image.url)!
    }

    // Capture the first primary image's Storage URL (if successfully uploaded)
    if (primaryIndex === 0 && uploadedUrls.has(image.url)) {
      primaryImageStorageUrl = finalUrl
    }

    mediaRows.push({ product_id: productId, color_id: null, url: finalUrl, is_primary: primaryIndex === 0, sort_order: primaryIndex })
    primaryIndex++
  }

  let mediaCreated = 0
  if (mediaRows.length > 0) {
    const response = await withRetryableQuery(async () => {
      let query = supabase.from('product_media').insert(mediaRows as never).select('id')
      if (signal) query = query.abortSignal(signal)
      return await query
    })
    const { data, error } = response as { data: Array<{ id: string }> | null; error: { message: string } | null }
    if (error) throw new ImportStageError('MEDIA_INSERT_FAILED', error.message)
    mediaCreated = data?.length ?? 0
  }

  return { colorsCreated, mediaCreated, primaryImageStorageUrl }
}

/**
 * Inserts one product row, retrying with a freshly resolved slug/product_code
 * if the insert hits a unique-constraint violation — this covers the race
 * where a concurrent import (e.g. two admins importing at once) claims the
 * same slug/code between our pre-check and this insert. Mirrors the retry
 * strategy already proven in services/products.ts's createProduct().
 */
async function insertProductRowWithRetry(
  row: Record<string, unknown> & { name: string; slug: string; product_code: string },
  reservedSlugs: Set<string>,
  reservedCodes: Set<string>,
  signal?: AbortSignal
): Promise<{ data: { id: string; name: string } | null; error: { message: string } | null }> {
  const supabase = createClient()
  let currentRow = row

  for (let attempt = 1; attempt <= MAX_SLUG_CODE_ATTEMPTS; attempt++) {
    const response = await withRetryableQuery(async () => {
      let query = supabase.from('products').insert([currentRow] as never).select('id, name')
      if (signal) query = query.abortSignal(signal)
      return await query.single()
    })
    const { data, error } = response as { data: { id: string; name: string } | null; error: { message: string; code?: string } | null }

    if (!error) return { data, error: null }
    if (classifyError(error) !== 'UNIQUE_CONSTRAINT') return { data: null, error }

    const newSlug = await resolveUniqueSlug(currentRow.name, reservedSlugs)
    const newCode = await resolveUniqueProductCode(currentRow.name, reservedCodes)
    if (!newSlug || !newCode) return { data: null, error }
    currentRow = { ...currentRow, slug: newSlug, product_code: newCode }
  }

  return { data: null, error: { message: 'Exhausted retry attempts after repeated unique constraint violations' } }
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

/**
 * Batch-creates products, colors, and media from validated CSV import groups.
 *
 * Callers must only pass groups that have already passed `isValidFile`/
 * `validateGroupingResult` (lib/csv-import/validate.ts) — this trusts
 * group.price/group.status to be non-null and does not re-validate CSV rows.
 *
 * Products are inserted in chunks of PRODUCT_INSERT_CHUNK_SIZE via one
 * multi-row insert per chunk (falling back to per-row inserts, with
 * unique-violation retry, if a chunk's batch insert fails outright).
 *
 * There is no cross-table database transaction in this codebase (see
 * services/products.ts's createProduct, which has the same limitation) — if
 * colors/media creation fails for a product whose row already committed,
 * this function compensates by soft-deleting that product (matching
 * deleteProduct's existing soft-delete semantics) so it does not appear as
 * an incomplete "ghost" product in the admin product list, then records the
 * product as a failure.
 *
 * Inserted rows are paired back to their source ProductGroup by array
 * position (not by product name) — see "Stable Product Mapping" in the
 * Production Readiness Review. If options.signal is provided, it's threaded
 * through every insert this function issues so an aborted caller (e.g. the
 * admin navigating away mid-import) stops outstanding requests — already
 * -committed writes are not rolled back by an abort.
 */
export async function bulkImportProducts(
  groups: ProductGroup[],
  categories: Array<{ id: string; name: string }>,
  options: BulkImportOptions = {}
): Promise<BulkImportSummary> {
  const startedAt = Date.now()
  const onProgress = options.onProgress ?? (() => {})

  if (groups.length > MAX_IMPORT_PRODUCTS) {
    throw new Error(
      `This file has ${groups.length} products, which exceeds the ${MAX_IMPORT_PRODUCTS}-product limit per import. Split it into smaller files.`
    )
  }

  const results: BulkImportProductResult[] = []
  const reservedSlugs = new Set<string>()
  const reservedCodes = new Set<string>()

  onProgress('RESOLVING_CATEGORIES')

  const categoryResolved: Array<{ group: ProductGroup; categoryId: string }> = []
  for (const group of groups) {
    const categoryId = resolveCategoryId(group.categoryName ?? '', categories)
    if (!categoryId) {
      results.push({ name: group.name, success: false, error: `Category "${group.categoryName}" not found`, errorCode: 'CATEGORY_NOT_FOUND' })
      continue
    }
    categoryResolved.push({ group, categoryId })
  }

  onProgress('GENERATING_IDENTIFIERS')

  const resolved: ResolvedProductRow[] = []
  for (const { group, categoryId } of categoryResolved) {
    const slug = await resolveUniqueSlug(group.name, reservedSlugs)
    if (!slug) {
      results.push({ name: group.name, success: false, error: `Unable to generate a unique slug after ${MAX_SLUG_CODE_ATTEMPTS} attempts`, errorCode: 'SLUG_COLLISION' })
      continue
    }

    const productCode = await resolveUniqueProductCode(group.name, reservedCodes)
    if (!productCode) {
      results.push({ name: group.name, success: false, error: `Unable to generate a unique product code after ${MAX_SLUG_CODE_ATTEMPTS} attempts`, errorCode: 'PRODUCT_CODE_COLLISION' })
      continue
    }

    resolved.push({ group, slug, productCode, categoryId })
  }

  const rowsProcessed = groups.length

  if (resolved.length === 0) {
    onProgress('COMPLETED')
    return {
      successCount: 0,
      failureCount: results.length,
      productsCreated: 0,
      colorsCreated: 0,
      mediaCreated: 0,
      rowsProcessed,
      durationMs: Date.now() - startedAt,
      productsPerSecond: 0,
      rowsPerSecond: 0,
      averageChunkDurationMs: 0,
      results,
    }
  }

  onProgress('CREATING_PRODUCTS')

  const supabase = createClient()
  // Paired with its source group, not just { id, name } — see "Stable
  // Product Mapping" in the Production Readiness Review for why this
  // function never correlates an inserted row back to a group by name.
  const insertedProducts: Array<{ id: string; group: ProductGroup }> = []
  const chunkDurations: number[] = []

  for (const batch of chunk(resolved, PRODUCT_INSERT_CHUNK_SIZE)) {
    const chunkStartedAt = Date.now()
    const rowsToInsert = batch.map(({ group, slug, productCode, categoryId }) => ({
      name: group.name,
      slug,
      product_code: productCode,
      category_id: categoryId,
      price: group.price as number,
      status: group.status as 'PUBLISHED' | 'DRAFT',
      work_types: group.workTypes,
      short_description: group.shortDescription,
      description: group.description,
      image_url: group.primaryImages[0]?.url ?? group.colors[0]?.imageUrls[0] ?? null,
    }))

    const batchResponse = await withRetryableQuery(async () => {
      let query = supabase.from('products').insert(rowsToInsert as never).select('id, name')
      if (options.signal) query = query.abortSignal(options.signal)
      return await query
    })
    const { data: batchData, error: batchError } = batchResponse as {
      data: Array<{ id: string; name: string }> | null
      error: { message: string } | null
    }

    if (!batchError && batchData && batchData.length === batch.length) {
      // Postgres/PostgREST preserve row order for a single multi-row
      // INSERT ... RETURNING statement, so pairing the response back to
      // `batch` by array position is a stable correlation that never
      // depends on product names being unique. The length check above is
      // the defensive guard: if it ever doesn't hold, fall through to the
      // per-row path below instead of risking a mis-paired product/group.
      for (let i = 0; i < batch.length; i++) {
        insertedProducts.push({ id: batchData[i].id, group: batch[i].group })
      }
      chunkDurations.push(Date.now() - chunkStartedAt)
      continue
    }

    // The whole multi-row insert failed outright, or returned an unexpected
    // row count — fall back to per-row inserts (with unique-violation
    // retry) so one bad row doesn't sink the rest of the chunk. Each row is
    // paired with its resolved group by array position, not by name.
    for (let i = 0; i < rowsToInsert.length; i++) {
      const row = rowsToInsert[i]
      const { data, error } = await insertProductRowWithRetry(row, reservedSlugs, reservedCodes, options.signal)
      if (error || !data) {
        results.push({ name: row.name, success: false, error: error?.message ?? 'Insert failed', errorCode: classifyError(error) })
        continue
      }
      insertedProducts.push({ id: data.id, group: batch[i].group })
    }
    chunkDurations.push(Date.now() - chunkStartedAt)
  }

  onProgress('CREATING_COLORS_AND_MEDIA')

  let colorsCreated = 0
  let mediaCreated = 0

  for (const inserted of insertedProducts) {
    try {
      const counts = await createColorsAndMedia(inserted.id, inserted.group, options.signal)
      colorsCreated += counts.colorsCreated
      mediaCreated += counts.mediaCreated

      // Update product's image_url with the Storage URL if available
      if (counts.primaryImageStorageUrl) {
        const storageUrl = counts.primaryImageStorageUrl
        const updateResponse = await withRetryableQuery(async () => {
          let query = supabase.from('products').update({ image_url: storageUrl } as never).eq('id', inserted.id)
          if (options.signal) query = query.abortSignal(options.signal)
          return await query
        })
        const { error: updateError } = updateResponse as { error: { message: string } | null }
        if (updateError) {
          // Log the error but don't crash the import — the media rows are already created,
          // and the product still has a usable image URL from the initial insert
          captureError(updateError, {
            context: 'bulk-import-image-url-update',
            productId: inserted.id,
          })
        }
      }

      results.push({ name: inserted.group.name, success: true, productId: inserted.id })
    } catch (err) {
      const errorCode = err instanceof ImportStageError ? err.code : classifyError(err)
      const message = err instanceof Error ? err.message : String(err)

      // Compensate: this product's row already committed, but its colors/
      // media didn't — soft-delete it rather than leaving an incomplete
      // "ghost" product visible in the admin product list.
      try {
        await deleteProduct(inserted.id)
      } catch (compensationErr) {
        captureError(compensationErr, { context: 'bulk-import-compensation-failed', productId: inserted.id })
      }

      results.push({ name: inserted.group.name, success: false, productId: inserted.id, error: message, errorCode })
    }
  }

  const successCount = results.filter((r) => r.success).length
  const failureCount = results.length - successCount
  const durationMs = Date.now() - startedAt
  const durationSeconds = durationMs / 1000
  const productsPerSecond = durationSeconds > 0 ? Number((successCount / durationSeconds).toFixed(2)) : successCount
  const rowsPerSecond = durationSeconds > 0 ? Number((rowsProcessed / durationSeconds).toFixed(2)) : rowsProcessed
  const averageChunkDurationMs =
    chunkDurations.length > 0 ? Math.round(chunkDurations.reduce((a, b) => a + b, 0) / chunkDurations.length) : 0

  onProgress('LOGGING_AUDIT')

  await logAuditEvent({
    action: 'BULK_IMPORT',
    resourceType: 'product',
    newData: {
      filename: options.filename ?? null,
      rowsProcessed,
      productsCreated: successCount,
      colorsCreated,
      mediaCreated,
      failureCount,
      durationMs,
      productsPerSecond,
      rowsPerSecond,
      averageChunkDurationMs,
      productIds: insertedProducts.map((p) => p.id),
    } as Json,
  })

  onProgress('COMPLETED')

  return {
    successCount,
    failureCount,
    productsCreated: successCount,
    colorsCreated,
    mediaCreated,
    rowsProcessed,
    durationMs,
    productsPerSecond,
    rowsPerSecond,
    averageChunkDurationMs,
    results,
  }
}
