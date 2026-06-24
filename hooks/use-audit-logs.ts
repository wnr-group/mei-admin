'use client'

import { useQuery } from '@tanstack/react-query'
import { getAuditLogs } from '@/services/audit-logs'

type GetAuditLogsOptions = Parameters<typeof getAuditLogs>[0]

export function useAuditLogs(options?: GetAuditLogsOptions) {
  return useQuery({
    queryKey: ['audit-logs', options],
    queryFn: () => getAuditLogs(options),
  })
}
