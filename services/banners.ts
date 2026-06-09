import { createClient } from '@/lib/supabase/client'
import { toAppError } from '@/lib/errors'
import { logAuditEvent } from '@/lib/audit'
import type { Banner, BannerInsert, BannerUpdate } from '@/types'
import type { Json } from '@/types/database'

interface GetBannersOptions {
  page?: number
  limit?: number
}

export async function getBanners(options: GetBannersOptions = {}) {
  const supabase = createClient()
  const { page = 1, limit = 100 } = options

  const { data, error, count } = await supabase
    .from('banners')
    .select('*', { count: 'exact' })
    .order('sort_order', { ascending: true })
    .range((page - 1) * limit, page * limit - 1)

  if (error) throw toAppError(new Error(error.message))
  return { banners: (data as Banner[] | null) ?? [], total: count ?? 0 }
}

export async function createBanner(banner: BannerInsert) {
  const supabase = createClient()
  const response = await supabase
    .from('banners')
    .insert([banner] as never)
    .select()
    .single()
  const { data, error } = response as { data: Banner | null; error: { message: string } | null }
  if (error) throw toAppError(new Error(error.message))

  // Add logging
  await logAuditEvent({
    action: 'CREATE',
    resourceType: 'banner',
    resourceId: data!.id,
    newData: data as Json,
  })

  return data as Banner
}

export async function updateBanner(id: string, updates: BannerUpdate) {
  const supabase = createClient()
  const response = await supabase
    .from('banners')
    .update(updates as never)
    .eq('id', id)
    .select()
    .single()
  const { data, error } = response as { data: Banner | null; error: { message: string } | null }
  if (error) throw toAppError(new Error(error.message))

  // Add logging
  await logAuditEvent({
    action: 'UPDATE',
    resourceType: 'banner',
    resourceId: id,
    newData: updates as Json,
  })

  return data as Banner
}

export async function deleteBanner(id: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('banners')
    .delete()
    .eq('id', id)
  if (error) throw toAppError(new Error(error.message))

  // Add logging
  await logAuditEvent({
    action: 'DELETE',
    resourceType: 'banner',
    resourceId: id,
  })
}
