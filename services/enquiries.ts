import { createClient } from '@/lib/supabase/client'
import { toAppError } from '@/lib/errors'
import { logAuditEvent } from '@/lib/audit'
import type { Enquiry, EnquiryStatus } from '@/types'
import type { Json } from '@/types/database'

interface GetEnquiriesOptions {
  page?: number
  limit?: number
  status?: EnquiryStatus
}

export async function getEnquiries(options: GetEnquiriesOptions = {}) {
  const supabase = createClient()
  const { page = 1, limit = 20, status } = options

  // Diagnostics
  const user = await supabase.auth.getUser()
  console.log('[AdminEnquiries] Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
  console.log('[AdminEnquiries] Authenticated user:', user.data.user?.id, user.data.user?.email)

  let query = supabase
    .from('enquiries')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error, count } = await query
  console.log('[AdminEnquiries] raw response', JSON.stringify({ data, error, count }, null, 2))

  if (error) throw toAppError(new Error(error.message))
  return { enquiries: (data as Enquiry[] | null) ?? [], total: count ?? 0 }
}

export async function replyToEnquiry(id: string, adminReply: string) {
  const supabase = createClient()
  const response = await supabase
    .from('enquiries')
    .update({
      admin_reply: adminReply,
      status: 'REPLIED',
      replied_at: new Date().toISOString(),
      replied_by: (await supabase.auth.getUser()).data.user?.id ?? null
    } as never)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single()
  const { data, error } = response as { data: Enquiry | null; error: { message: string } | null }
  if (error) throw toAppError(new Error(error.message))

  await logAuditEvent({
    action: 'UPDATE',
    resourceType: 'enquiry',
    resourceId: id,
    newData: { admin_reply: adminReply, status: 'REPLIED' } as Json,
  })

  return data as Enquiry
}

export async function closeEnquiry(id: string) {
  const supabase = createClient()
  const response = await supabase
    .from('enquiries')
    .update({ status: 'CLOSED' } as never)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single()
  const { data, error } = response as { data: Enquiry | null; error: { message: string } | null }
  if (error) throw toAppError(new Error(error.message))

  await logAuditEvent({
    action: 'UPDATE',
    resourceType: 'enquiry',
    resourceId: id,
    newData: { status: 'CLOSED' } as Json,
  })

  return data as Enquiry
}

export async function deleteEnquiry(id: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('enquiries')
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id', id)
  if (error) throw toAppError(new Error(error.message))

  // Only reached on success — failure path throws above
  await logAuditEvent({
    action: 'DELETE',
    resourceType: 'enquiry',
    resourceId: id,
  })
}
