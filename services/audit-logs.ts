import { createClient } from '@/lib/supabase/client'
import { toAppError } from '@/lib/errors'
import type { AuditLog } from '@/types'

export type AuditLogWithActor = AuditLog & { actor_name: string }

interface GetAuditLogsOptions {
  page?: number
  limit?: number
  action?: 'CREATE' | 'UPDATE' | 'DELETE'
  resourceType?: string
  adminId?: string
  dateFrom?: string  // YYYY-MM-DD — normalized to T00:00:00.000Z internally
  dateTo?: string    // YYYY-MM-DD — normalized to T23:59:59.999Z internally
}

export async function getAuditLogs(options: GetAuditLogsOptions = {}) {
  const supabase = createClient()
  const { page = 1, limit = 20, action, resourceType, adminId, dateFrom, dateTo } = options

  let query = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (action) query = query.eq('action', action)
  if (resourceType) query = query.eq('resource_type', resourceType)
  if (adminId) query = query.eq('admin_id', adminId)
  if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00.000Z`)
  if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59.999Z`)

  const { data, error, count } = await query
  if (error) throw toAppError(new Error(error.message))

  const logs = (data as AuditLog[] | null) ?? []

  // Batch-fetch profiles to resolve actor names (profiles RLS allows all admins to read)
  const adminIds = [...new Set(logs.map(l => l.admin_id).filter(Boolean))] as string[]
  const profileMap: Record<string, string | null> = {}
  if (adminIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', adminIds)
    for (const p of (profiles as Array<{ id: string; full_name: string | null }>) ?? []) {
      profileMap[p.id] = p.full_name
    }
  }

  const logsWithActor: AuditLogWithActor[] = logs.map(log => ({
    ...log,
    actor_name: log.admin_id
      ? (profileMap[log.admin_id] ?? 'Admin')
      : 'System',
  }))

  return { logs: logsWithActor, total: count ?? 0 }
}
