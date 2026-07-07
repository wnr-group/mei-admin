import { createClient } from '@/lib/supabase/client'
import { AppError, toAppError } from '@/lib/errors'
import { validateImageFile } from '@/lib/validators/image'

const PRODUCT_BUCKET = 'product-images'
const IMPORTS_PREFIX = 'imports'

export interface UploadedImportImage {
  path: string
  publicUrl: string
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