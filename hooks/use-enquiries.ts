'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getEnquiries, getEnquiryById, updateEnquiryStatus, updateEnquiryAdminNotes, replyToEnquiry, closeEnquiry, deleteEnquiry } from '@/services/enquiries'
import type { EnquiryStatus } from '@/types'

type GetEnquiriesOptions = Parameters<typeof getEnquiries>[0]

export function useEnquiries(options?: GetEnquiriesOptions) {
  return useQuery({
    queryKey: ['enquiries', options],
    queryFn: () => getEnquiries(options),
  })
}

export function useEnquiry(id: string) {
  return useQuery({
    queryKey: ['enquiry', id],
    queryFn: () => getEnquiryById(id),
    enabled: !!id,
  })
}

export function useReplyToEnquiry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reply }: { id: string; reply: string }) =>
      replyToEnquiry(id, reply),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['enquiries'] })
      qc.invalidateQueries({ queryKey: ['enquiry', variables.id] })
    },
  })
}

export function useCloseEnquiry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => closeEnquiry(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['enquiries'] })
      qc.invalidateQueries({ queryKey: ['enquiry', id] })
    },
  })
}

export function useUpdateEnquiryStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: EnquiryStatus }) =>
      updateEnquiryStatus(id, status),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['enquiries'] })
      qc.invalidateQueries({ queryKey: ['enquiry', variables.id] })
    },
  })
}

export function useUpdateEnquiryAdminNotes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, adminNotes }: { id: string; adminNotes: string }) =>
      updateEnquiryAdminNotes(id, adminNotes),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['enquiries'] })
      qc.invalidateQueries({ queryKey: ['enquiry', variables.id] })
    },
  })
}

export function useDeleteEnquiry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteEnquiry(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['enquiries'] }),
  })
}
