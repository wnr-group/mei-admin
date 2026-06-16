'use client'

import React, { useState } from 'react'
import { X } from 'lucide-react'
import { useEnquiries, useReplyToEnquiry, useCloseEnquiry, useDeleteEnquiry } from '@/hooks/use-enquiries'
import { TableSkeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
import type { Enquiry, EnquiryStatus } from '@/types'

const STATUS_TABS: EnquiryStatus[] = ['NEW', 'REPLIED', 'CLOSED']

export default function EnquiriesPage() {
  const [page, setPage] = useState(1)
  const [selectedStatus, setSelectedStatus] = useState<EnquiryStatus | null>(null)
  const { data, isLoading, error, refetch } = useEnquiries({ page, limit: 6, status: selectedStatus ?? undefined })
  const replyMutation = useReplyToEnquiry()
  const closeMutation = useCloseEnquiry()
  const deleteEnquiryMutation = useDeleteEnquiry()

  const enquiries = data?.enquiries ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / 6)
  const itemsPerPage = 6

  // Side panel state
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null)
  const [replyText, setReplyText] = useState('')

  if (isLoading) return <TableSkeleton rows={6} />
  if (error) return <ErrorState message={error.message} onRetry={refetch} />

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEnquiry || !replyText.trim()) return

    try {
      await replyMutation.mutateAsync({ id: selectedEnquiry.id, reply: replyText })
      setReplyText('')
      setSelectedEnquiry(null)
    } catch {
      alert('Failed to send reply')
    }
  }

  const handleClose = async () => {
    if (!selectedEnquiry) return

    try {
      await closeMutation.mutateAsync(selectedEnquiry.id)
      setSelectedEnquiry(null)
    } catch {
      alert('Failed to close enquiry')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete enquiry from ${name}? This cannot be undone.`)) return
    try {
      await deleteEnquiryMutation.mutateAsync(id)
      if (selectedEnquiry?.id === id) setSelectedEnquiry(null)
    } catch {
      alert('Failed to delete enquiry')
    }
  }

  if (enquiries.length === 0) return <EmptyState message="No enquiries yet." />

  return (
    <div className="space-y-6 px-8 pt-10 font-inter relative animate-fade-in">

      {/* Loading overlay for mutations */}
      {(replyMutation.isPending || closeMutation.isPending || deleteEnquiryMutation.isPending) && (
        <div className="fixed inset-0 bg-white/50 z-50 flex items-center justify-center">
          <div className="text-zinc-500 font-medium text-xs">
            {deleteEnquiryMutation.isPending ? 'Deleting enquiry...' : 'Processing...'}
          </div>
        </div>
      )}

      {/* 1. Header Page Section */}
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold tracking-wider text-zinc-800 uppercase font-sans">
          Enquiries
        </h3>
      </div>

      {/* 2. Status Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => {
            setSelectedStatus(null)
            setPage(1)
          }}
          className={`px-4 py-2 text-[11px] font-bold tracking-widest uppercase transition-colors ${
            selectedStatus === null
              ? 'bg-[#B38B5D] text-white'
              : 'border border-[#E8E0D5] bg-white text-zinc-500 hover:bg-zinc-50'
          }`}
        >
          ALL
        </button>
        {STATUS_TABS.map((status) => (
          <button
            key={status}
            onClick={() => {
              setSelectedStatus(status)
              setPage(1)
            }}
            className={`px-4 py-2 text-[11px] font-bold tracking-widest uppercase transition-colors ${
              selectedStatus === status
                ? 'bg-[#B38B5D] text-white'
                : 'border border-[#E8E0D5] bg-white text-zinc-500 hover:bg-zinc-50'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* 3. Enquiry Listing Table Container */}
      <div className="bg-white border border-[#E8E0D5] shadow-xs">

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAF8F5] border-b border-[#E8E0D5]">
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[15%]">
                  NAME
                </th>
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[20%]">
                  EMAIL
                </th>
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[35%]">
                  MESSAGE
                </th>
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[15%]">
                  STATUS
                </th>
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[15%] text-right">
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E0D5]">
              {enquiries.map((enquiry) => (
                <tr key={enquiry.id} className="hover:bg-[#FAF8F5]/40 transition-colors">
                  <td className="px-6 py-3 text-[12px] font-medium text-zinc-800">
                    {enquiry.name}
                  </td>
                  <td className="px-6 py-3 text-[12px] text-zinc-700 font-medium">
                    {enquiry.email}
                  </td>
                  <td className="px-6 py-3 text-[12px] text-zinc-700 font-medium line-clamp-2">
                    {enquiry.message}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-block px-2.5 py-0.5 text-[7.5px] font-bold tracking-widest rounded-none uppercase ${
                        enquiry.status === 'NEW'
                          ? 'bg-yellow-100 text-yellow-800'
                          : enquiry.status === 'REPLIED'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {enquiry.status}
                    </span>
                  </td>
                  <td className="px-6 py-4.5 text-right space-x-3 text-[10px] font-bold tracking-widest">
                    <button
                      onClick={() => {
                        setSelectedEnquiry(enquiry)
                        setReplyText(enquiry.admin_reply ?? '')
                      }}
                      className="text-[#B38B5D] hover:text-[#A37B4D] uppercase transition-colors"
                    >
                      {enquiry.status === 'NEW' ? 'REPLY' : 'VIEW'}
                    </button>
                    <button
                      onClick={() => handleDelete(enquiry.id, enquiry.name)}
                      disabled={deleteEnquiryMutation.isPending}
                      className={`uppercase transition-colors ${
                        deleteEnquiryMutation.isPending
                          ? 'text-zinc-300 cursor-not-allowed'
                          : 'text-red-400 hover:text-red-600'
                      }`}
                    >
                      DELETE
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 4. Table Footer Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-8 py-5 border-t border-[#E8E0D5] gap-4 bg-[#FAF8F5]/30">

          <span className="text-[10px] font-medium text-zinc-400 tracking-wide">
            Showing {total === 0 ? 0 : (page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, total)} of {total} entries
          </span>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className={`border border-[#E8E0D5] bg-white px-3.5 py-1.5 text-[9px] font-bold tracking-wider uppercase transition-colors duration-150 ${
                  page === 1
                    ? 'text-zinc-300 border-zinc-100 cursor-not-allowed'
                    : 'text-zinc-500 hover:bg-zinc-50'
                }`}
              >
                PREV
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1.5 text-[9px] font-bold transition-all duration-150 ${
                    page === p
                      ? 'bg-[#B38B5D] text-white'
                      : 'border border-[#E8E0D5] bg-white text-zinc-500 hover:bg-zinc-50'
                  }`}
                >
                  {p}
                </button>
              ))}

              <button
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
                className={`border border-[#E8E0D5] bg-white px-3.5 py-1.5 text-[9px] font-bold tracking-wider uppercase transition-colors duration-150 ${
                  page === totalPages
                    ? 'text-zinc-300 border-zinc-100 cursor-not-allowed'
                    : 'text-zinc-500 hover:bg-zinc-50'
                }`}
              >
                NEXT
              </button>
            </div>
          )}

        </div>

      </div>

      {/* 5. Side Panel for Detail/Reply */}
      {selectedEnquiry && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">

          <div
            onClick={() => setSelectedEnquiry(null)}
            className="absolute inset-0 bg-black/35 backdrop-blur-xs transition-opacity duration-300"
          />

          <div className="relative w-full max-w-[480px] bg-white h-full shadow-2xl flex flex-col justify-between py-10 px-8 animate-slide-in border-l border-[#E8E0D5]">

            <div>
              <div className="flex items-center justify-between border-b border-[#E8E0D5] pb-5">
                <h4 className="font-serif text-[22px] text-[#B38B5D] font-medium tracking-wide">
                  Enquiry Details
                </h4>
                <button
                  onClick={() => setSelectedEnquiry(null)}
                  className="text-zinc-400 hover:text-zinc-700 transition-colors p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-8 space-y-6">

                {/* Customer Info */}
                <div>
                  <p className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">Name</p>
                  <p className="text-[13px] text-zinc-800 mt-1">{selectedEnquiry.name}</p>
                </div>

                <div>
                  <p className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">Email</p>
                  <p className="text-[13px] text-zinc-800 mt-1">{selectedEnquiry.email}</p>
                </div>

                <div>
                  <p className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">Phone</p>
                  <p className="text-[13px] text-zinc-800 mt-1">{selectedEnquiry.phone ?? '-'}</p>
                </div>

                <div>
                  <p className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">Message</p>
                  <p className="text-[13px] text-zinc-800 mt-1">{selectedEnquiry.message}</p>
                </div>

                {/* Reply Form */}
                {selectedEnquiry.status !== 'CLOSED' && (
                  <form onSubmit={handleReply} className="space-y-4 pt-4 border-t border-[#E8E0D5]">
                    <div>
                      <label className="block text-[10px] font-bold tracking-widest text-zinc-400 uppercase mb-2">
                        Your Reply
                      </label>
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write your response here..."
                        rows={4}
                        className="w-full border border-[#E8E0D5] p-3 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="submit"
                        className="flex-1 bg-[#B38B5D] hover:bg-[#A37B4D] text-[10px] font-bold tracking-widest text-white py-2 transition-colors uppercase rounded-none"
                      >
                        Send Reply
                      </button>
                      <button
                        type="button"
                        onClick={handleClose}
                        className="flex-1 border border-zinc-200 hover:bg-zinc-50 text-[10px] font-bold tracking-widest text-zinc-500 py-2 transition-colors uppercase rounded-none"
                      >
                        Close
                      </button>
                    </div>
                  </form>
                )}

              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  )
}
