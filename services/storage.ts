import { createClient } from '@/lib/supabase/client'
import { AppError, toAppError } from '@/lib/errors'

const BUCKET = 'product-images'
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB

export function validateImageFile(file: File): void {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new AppError('VALIDATION_ERROR', `File type not allowed. Use: ${ALLOWED_TYPES.join(', ')}`)
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new AppError('VALIDATION_ERROR', `File too large. Maximum size is 5MB.`)
  }
}

export async function uploadProductImage(file: File, productId: string): Promise<string> {
  validateImageFile(file)

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
