import { createClient } from '@/lib/supabase/client'
import type { Json } from '@/types/database'

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE'

type ResourceType =
  | 'product'
  | 'category'
  | 'order'
  | 'enquiry'
  | 'banner'
  | 'setting'
  | 'profile'

interface AuditParams {
  action: AuditAction
  resourceType: ResourceType
  resourceId?: string
  oldData?: Json
  newData?: Json
}

export async function logAuditEvent(params: AuditParams) {
  try {
    const supabase = createClient()

    let user: { id: string } | null = null

    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      user = authUser
    } catch {
      return
    }

    if (!user) return

    const insertData = {
      admin_id: user.id,
      action: params.action,
      resource_type: params.resourceType,
      resource_id: params.resourceId ?? null,
      old_data: params.oldData ?? null,
      new_data: params.newData ?? null,
    }

    await supabase.from('audit_logs').insert([insertData] as never)
  } catch {
    // Silently fail audit logging to avoid breaking the main operation
  }
}