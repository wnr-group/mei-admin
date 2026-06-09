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

  let query = supabase
    .from('enquiries')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error, count } = await query

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
    .select()
    .single()
  const { data, error } = response as { data: Enquiry | null; error: { message: string } | null }
  if (error) throw toAppError(new Error(error.message))

  // Add logging
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
    .select()
    .single()
  const { data, error } = response as { data: Enquiry | null; error: { message: string } | null }
  if (error) throw toAppError(new Error(error.message))

  // Add logging
  await logAuditEvent({
    action: 'UPDATE',
    resourceType: 'enquiry',
    resourceId: id,
    newData: { status: 'CLOSED' } as Json,
  })

  return data as Enquiry
}
