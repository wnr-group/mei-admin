'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getEnquiries, replyToEnquiry, closeEnquiry } from '@/services/enquiries'

type GetEnquiriesOptions = Parameters<typeof getEnquiries>[0]

export function useEnquiries(options?: GetEnquiriesOptions) {
  return useQuery({
    queryKey: ['enquiries', options],
    queryFn: () => getEnquiries(options),
  })
}

export function useReplyToEnquiry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reply }: { id: string; reply: string }) =>
      replyToEnquiry(id, reply),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['enquiries'] }),
  })
}

export function useCloseEnquiry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => closeEnquiry(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['enquiries'] }),
  })
}
