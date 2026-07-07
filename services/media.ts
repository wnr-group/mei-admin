import { createClient } from '@/lib/supabase/client'
import { AppError, toAppError } from '@/lib/errors'
import { validateImageFile } from '@/lib/validators/image'

const PRODUCT_BUCKET = 'product-images'
const IMPORTS_PREFIX = 'imports'

export interface UploadedImportImage {
  path: string
  publicUrl: string
}

export interface StoredImportImage {
  id: string
  name: string
  path: string
  publicUrl: string
  size: number
  mimetype: string
  createdAt: Date
  inUse: boolean
}

export async function listImportImages(): Promise<StoredImportImage[]> {
  const supabase = createClient()

  const [storageResult, mediaResult] = await Promise.all([
    supabase.storage.from(PRODUCT_BUCKET).list(IMPORTS_PREFIX, {
      limit: 1000,
      sortBy: { column: 'created_at', order: 'desc' },
    }),
    supabase
      .from('product_media')
      .select('url')
      .eq('media_type', 'IMAGE')
      .is('deleted_at', null),
  ])

  if (storageResult.error) throw toAppError(storageResult.error)

  const usedUrls = new Set((mediaResult.data ?? []).map((r) => (r as { url: string }).url))

  return (storageResult.data ?? []).map((file) => {
    const path = `${IMPORTS_PREFIX}/${file.name}`
    const { data: urlData } = supabase.storage.from(PRODUCT_BUCKET).getPublicUrl(path)
    return {
      id: file.id ?? file.name,
      name: file.name.replace(/^\d+-/, ''),
      path,
      publicUrl: urlData.publicUrl,
      size: file.metadata?.size ?? 0,
      mimetype: file.metadata?.mimetype ?? 'image/*',
      createdAt: file.created_at ? new Date(file.created_at) : new Date(0),
      inUse: usedUrls.has(urlData.publicUrl),
    }
  })
}

export async function deleteImportImage(path: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.storage.from(PRODUCT_BUCKET).remove([path])
  if (error) throw toAppError(error)
}

/**
 * Uploads a single image to the product-images bucket under the imports/ prefix.
 * Used by the Media Library page to prep images ahead of a bulk CSV import —
 * no product exists yet at this point, so there's no productId to scope the path to.
 */
export async function uploadImportImage(file: File): Promise<UploadedImportImage> {
  const validationError = validateImageFile(file)
  if (validationError) {
    throw new AppError('VALIDATION_ERROR', validationError.message)
  }

  const supabase = createClient()

  // Keep the original filename (sanitized) so the admin can visually match
  // uploaded images back to rows in their CSV. Prefix with a timestamp to
  // avoid collisions if two files share the same name.
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
  const path = `${IMPORTS_PREFIX}/${Date.now()}-${safeName}`

  const { error } = await supabase.storage
    .from(PRODUCT_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) throw toAppError(error)

  const { data } = supabase.storage.from(PRODUCT_BUCKET).getPublicUrl(path)

  return {
    path,
    publicUrl: data.publicUrl,
  }
}