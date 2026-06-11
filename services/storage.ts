import { createClient } from '@/lib/supabase/client'
import { AppError, toAppError } from '@/lib/errors'
import { validateImageFile } from '@/lib/validators/image'

const BUCKET = 'product-images'

export async function uploadProductImage(file: File, productId: string): Promise<string> {
  const validationError = validateImageFile(file)
  if (validationError) {
    throw new AppError('VALIDATION_ERROR', validationError.message)
  }

  const supabase = createClient()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `products/${productId}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) throw toAppError(error)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function deleteProductImage(imageUrl: string): Promise<void> {
  const supabase = createClient()
  const marker = `/storage/v1/object/public/${BUCKET}/`
  const idx = imageUrl.indexOf(marker)
  if (idx === -1) return  // URL doesn't match our bucket — nothing to delete
  const path = imageUrl.slice(idx + marker.length)

  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw toAppError(error)
}

const CATEGORY_BUCKET = 'category-images'

export async function uploadCategoryImage(file: File, categoryId: string): Promise<string> {
  const validationError = validateImageFile(file)
  if (validationError) {
    throw new AppError('VALIDATION_ERROR', validationError.message)
  }

  const supabase = createClient()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `categories/${categoryId}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from(CATEGORY_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) throw toAppError(error)

  const { data } = supabase.storage.from(CATEGORY_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function deleteCategoryImage(imageUrl: string): Promise<void> {
  const supabase = createClient()
  const marker = `/storage/v1/object/public/${CATEGORY_BUCKET}/`
  const idx = imageUrl.indexOf(marker)
  if (idx === -1) return  // URL doesn't match our bucket — nothing to delete
  const path = imageUrl.slice(idx + marker.length)

  const { error } = await supabase.storage.from(CATEGORY_BUCKET).remove([path])
  if (error) throw toAppError(error)
}
