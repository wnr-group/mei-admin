'use client'

import React, { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import Link from 'next/link'
import { useEnquiries, useDeleteEnquiry } from '@/hooks/use-enquiries'
import { ErrorState } from '@/components/ui/error-state'
import type { EnquiryStatus } from '@/types'

type TabType = 'ALL' | 'NEW' | 'REPLIED' | 'CLOSED';

export default function EnquiriesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 6

  // Fetch all enquiries (up to 1000) to support seamless instant search and counts
  const { data, isLoading, error, refetch } = useEnquiries({ limit: 1000 })
  const deleteEnquiryMutation = useDeleteEnquiry()

  const enquiries = data?.enquiries ?? []

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete enquiry from ${name}? This cannot be undone.`)) return
    try {
      await deleteEnquiryMutation.mutateAsync(id)
    } catch {
      alert('Failed to delete enquiry')
    }
  }

  // Dynamic heuristics to derive Product and Type from the freeform enquiry message
  const getProductFromMessage = (msg: string) => {
    const msgLower = (msg || '').toLowerCase()
    if (msgLower.includes('noor lehenga')) return 'The Noor Lehenga'
    if (msgLower.includes('crimson lehenga')) return 'Afsana Crimson Lehenga'
    if (msgLower.includes('silk saree')) return 'Heritage Silk Saree'
    if (msgLower.includes('velvet gown')) return 'Zoya Velvet Gown'
    if (msgLower.includes('atelier')) return 'Custom Atelier Piece'
    if (msgLower.includes('anarkali')) return 'Meera Anarkali'
    if (msgLower.includes('bridal set')) return 'Zahra Bridal Set'
    return '—'
  }

  const getTypeFromMessage = (msg: string) => {
    const msgLower = (msg || '').toLowerCase()
    if (msgLower.includes('quote') || msgLower.includes('price') || msgLower.includes('cost') || msgLower.includes('how much') || msgLower.includes('budget')) {
      return 'QUOTE'
    }
    if (msgLower.includes('custom') || msgLower.includes('measure') || msgLower.includes('tailor') || msgLower.includes('size')) {
      return 'CUSTOM'
    }
    return 'CONTACT'
  }

  // Filter & Search Logic
  const filteredEnquiries = useMemo(() => {
    let result = enquiries

    // Filter by tab
    if (activeTab !== 'ALL') {
      result = result.filter((item) => item.status === activeTab)
    }

    // Filter by search query (checks ID, Name, Product, and Message)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(
        (item) =>
          item.id.toLowerCase().includes(query) ||
          item.name.toLowerCase().includes(query) ||
          getProductFromMessage(item.message).toLowerCase().includes(query) ||
          item.message.toLowerCase().includes(query)
      )
    }

    return result
  }, [activeTab, searchQuery, enquiries])

  // Tab counts
  const newCount = enquiries.filter((item) => item.status === 'NEW').length

  // Pagination calculation
  const totalItems = filteredEnquiries.length
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1
  const endIndex = Math.min(currentPage * itemsPerPage, totalItems)

  // Paginated chunk
  const paginatedEnquiries = useMemo(() => {
    return filteredEnquiries.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    )
  }, [filteredEnquiries, currentPage])

  // CSV export function
  const handleExportCSV = () => {
    if (filteredEnquiries.length === 0) {
      alert('No enquiries to export.')
      return
    }

    const headers = ['Enquiry ID', 'Customer Name', 'Email', 'Phone', 'Product', 'Type', 'Status', 'Date']
    const rows = filteredEnquiries.map(item => [
      item.id,
      item.name,
      item.email,
      item.phone || '—',
      getProductFromMessage(item.message),
      getTypeFromMessage(item.message),
      item.status,
      new Date(item.created_at).toLocaleDateString('en-IN')
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n')
    
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `enquiries_export_${new Date().toISOString().slice(0,10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Status mapping matching mockup styling
  const getStatusBadgeStyle = (status: EnquiryStatus) => {
    switch (status) {
      case 'NEW':
        return 'bg-zinc-100 text-zinc-900 border border-zinc-200/80'
      case 'REPLIED':
        return 'bg-zinc-100/60 text-zinc-500 border border-zinc-200/80'
      case 'CLOSED':
        return 'bg-zinc-200 text-zinc-600 border border-zinc-300'
      default:
        return 'bg-zinc-100 text-zinc-700'
    }
  }

  const getStatusDotColor = (status: EnquiryStatus) => {
    switch (status) {
      case 'NEW': return 'bg-zinc-900'
      case 'REPLIED': return 'bg-zinc-400'
      case 'CLOSED': return 'bg-zinc-500'
      default: return 'bg-zinc-500'
    }
  }

  // Stacked formatted date matching the mockup date displays (e.g. "Today, 09:41" / "Yesterday")
  const formatEnquiryDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return dateStr
      const now = new Date()
      
      const isToday = date.getDate() === now.getDate() &&
                      date.getMonth() === now.getMonth() &&
                      date.getFullYear() === now.getFullYear()
                      
      const yesterday = new Date(now)
      yesterday.setDate(now.getDate() - 1)
      const isYesterday = date.getDate() === yesterday.getDate() &&
                          date.getMonth() === yesterday.getMonth() &&
                          date.getFullYear() === yesterday.getFullYear()
                          
      if (isToday) {
        return (
          <div>
            <div>Today,</div>
            <div className="text-[10px] text-zinc-400 font-sans mt-0.5">
              {date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </div>
          </div>
        )
      }
      if (isYesterday) {
        return <div>Yesterday</div>
      }
      return (
        <div>
          {date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
        </div>
      )
    } catch {
      return <div>{dateStr}</div>
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <span className="font-serif text-lg text-[#B38B5D] tracking-widest uppercase">MEI BRIDAL COUTURE</span>
          <span className="text-xs text-zinc-400">Loading Enquiries...</span>
        </div>
      </div>
    )
  }

  if (error) return <ErrorState message={error.message} onRetry={refetch} />

  return (
    <div className="space-y-6 px-8 pt-10 font-inter animate-fade-in pb-16">
      {/* 1. Header & Search Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-serif text-[32px] text-zinc-950 font-normal tracking-wide">
            Enquiries
          </h1>
          <p className="text-[12px] text-zinc-600 font-inter mt-1">
            Manage incoming client requests, quotes, and custom consultations.
          </p>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 md:flex-initial">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="Search enquiries..."
              className="w-full md:w-[220px] pl-9 pr-4 py-2 border border-[#E8E0D5] bg-white text-[12px] font-sans font-medium text-zinc-800 focus:outline-hidden focus:border-[#B38B5D]"
            />
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-400" />
          </div>

          {/* Export CSV button */}
          <button
            onClick={handleExportCSV}
            className="bg-[#1A1A1A] hover:bg-black text-[#FAF8F5] text-[10px] font-bold tracking-widest px-5 py-2.5 transition-colors duration-200 rounded-none uppercase cursor-pointer flex-shrink-0"
          >
            EXPORT CSV
          </button>
        </div>
      </div>

      {/* 2. Filter Tabs */}
      <div className="flex gap-8 border-b border-[#E8E0D5] select-none flex-wrap">
        <button
          onClick={() => { setActiveTab('ALL'); setCurrentPage(1); }}
          className={`pb-3 text-[11px] font-inter tracking-widest uppercase cursor-pointer transition-all duration-200 border-b-2 -mb-[1px] ${
            activeTab === 'ALL'
              ? 'text-zinc-900 border-[#B38B5D]'
              : 'text-zinc-600 border-transparent hover:text-zinc-800'
          }`}
        >
          ALL
        </button>
        <button
          onClick={() => { setActiveTab('NEW'); setCurrentPage(1); }}
          className={`pb-3 text-[11px] font-inter tracking-widest uppercase cursor-pointer transition-all duration-200 border-b-2 -mb-[1px] flex items-center gap-2 ${
            activeTab === 'NEW'
              ? 'text-zinc-900 border-[#B38B5D]'
              : 'text-zinc-600 border-transparent hover:text-zinc-800'
          }`}
        >
          <span>NEW</span>
          <span className="bg-zinc-950 text-white rounded-full flex items-center justify-center text-[9px] w-4.5 h-4.5 font-bold font-sans">
            {newCount}
          </span>
        </button>
        <button
          onClick={() => { setActiveTab('REPLIED'); setCurrentPage(1); }}
          className={`pb-3 text-[11px] font-inter tracking-widest uppercase cursor-pointer transition-all duration-200 border-b-2 -mb-[1px] ${
            activeTab === 'REPLIED'
              ? 'text-zinc-900 border-[#B38B5D]'
              : 'text-zinc-600 border-transparent hover:text-zinc-800'
          }`}
        >
          REPLIED
        </button>
        <button
          onClick={() => { setActiveTab('CLOSED'); setCurrentPage(1); }}
          className={`pb-3 text-[11px] font-inter tracking-widest uppercase cursor-pointer transition-all duration-200 border-b-2 -mb-[1px] ${
            activeTab === 'CLOSED'
              ? 'text-zinc-900 border-[#B38B5D]'
              : 'text-zinc-600 border-transparent hover:text-zinc-800'
          }`}
        >
          CLOSED
        </button>
      </div>

      {/* 3. Table Container */}
      <div className="bg-white border border-[#E8E0D5] shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAF8F5] border-b border-[#E8E0D5]">
                <th className="px-8 py-3.5 text-[9px] font-bold tracking-widest text-zinc-800 uppercase w-[23%]">
                  ENQUIRY #
                </th>
                <th className="px-8 py-3.5 text-[9px] font-bold tracking-widest text-zinc-800 uppercase w-[25%]">
                  CUSTOMER
                </th>
                <th className="px-8 py-3.5 text-[9px] font-bold tracking-widest text-zinc-800 uppercase w-[17%]">
                  PRODUCT
                </th>
                <th className="px-8 py-3.5 text-[9px] font-bold tracking-widest text-zinc-800 uppercase w-[12%]">
                  TYPE
                </th>
                <th className="px-8 py-3.5 text-[9px] font-bold tracking-widest text-zinc-800 uppercase w-[13%]">
                  STATUS
                </th>
                <th className="px-8 py-3.5 text-[9px] font-bold tracking-widest text-zinc-800 uppercase w-[10%] text-right">
                  DATE
                </th>
                <th className="px-8 py-3.5 text-[9px] font-bold tracking-widest text-zinc-800 uppercase w-[8%] text-right">
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E0D5]">
              {paginatedEnquiries.length > 0 ? (
                paginatedEnquiries.map((item) => {
                  const isNew = item.status === 'NEW'
                  const product = getProductFromMessage(item.message)
                  const type = getTypeFromMessage(item.message)
                  const contactInfo = item.phone ? `${item.email} | ${item.phone}` : item.email

                  return (
                    <tr key={item.id} className="hover:bg-[#FAF8F5]/40 transition-colors">
                      {/* Enquiry ID with vertical left highlight bar if new */}
                      <td className={`px-8 py-5 text-[12px] font-semibold text-[#B38B5D] font-sans tracking-wide ${isNew ? 'border-l-[3px] border-zinc-950 pl-[29px]' : ''}`}>
                        <Link href={`/enquiries/${item.id}`} className="hover:text-[#a37b4d] transition-colors cursor-pointer">
                          ENQ-{item.id.slice(0, 8).toUpperCase()}
                        </Link>
                      </td>

                      {/* Customer Info */}
                      <td className="px-8 py-5">
                        <div className="text-[12px] font-inter text-zinc-800 font-bold">
                          {item.name}
                        </div>
                        <div className="text-[10px] text-zinc-400 font-inter font-sans mt-0.5">
                          {contactInfo}
                        </div>
                      </td>

                      {/* Product Name */}
                      <td className="px-8 py-5 text-[12px] font-inter text-zinc-600">
                        {product}
                      </td>

                      {/* Type Badge */}
                      <td className="px-8 py-5">
                        <span className="inline-block border border-zinc-300 px-2 py-0.5 text-[9px] font-inter font-sans tracking-wider text-zinc-600 rounded-none uppercase">
                          {type}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="px-8 py-5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 text-[9px] font-bold tracking-widest rounded-none text-center min-w-[100px] uppercase font-sans ${getStatusBadgeStyle(
                            item.status
                          )}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(item.status)}`} />
                          {item.status}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-8 py-5 text-[12px] text-zinc-500 font-inter font-sans text-right">
                        {formatEnquiryDate(item.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="px-8 py-5 text-right">
                        <button
                          onClick={() => handleDelete(item.id, item.name)}
                          disabled={deleteEnquiryMutation.isPending}
                          className={`text-[10px] font-bold tracking-widest uppercase transition-colors ${
                            deleteEnquiryMutation.isPending
                              ? 'text-zinc-300 cursor-not-allowed'
                              : 'text-red-400 hover:text-red-600'
                          }`}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="px-8 py-12 text-center text-[12px] text-zinc-400 font-medium"
                  >
                    No enquiries found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 4. Table Pagination Footer */}
        <div className="px-8 py-4 border-t border-[#E8E0D5] bg-[#FAF8F5]/40 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-[11px] font-sans font-inter text-zinc-700">
            Showing {startIndex} to {endIndex} of {totalItems} entries
          </div>

          <div className="flex items-center gap-1">
            {/* Previous page button */}
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className={`border px-3 py-1.5 text-[11px] font-sans font-medium rounded-none select-none ${
                currentPage === 1
                  ? 'border-zinc-100 text-zinc-300 cursor-not-allowed'
                  : 'border-zinc-200 text-zinc-600 hover:bg-[#FAF8F5] cursor-pointer'
              }`}
            >
              Previous
            </button>

            {/* Pagination numbers */}
            {Array.from({ length: totalPages }).map((_, idx) => {
              const pageNum = idx + 1
              const isActive = currentPage === pageNum
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`border px-3.5 py-1.5 text-[11px] font-sans font-medium rounded-none cursor-pointer transition-colors ${
                    isActive
                      ? 'border-[#B38B5D] text-[#B38B5D] font-bold bg-[#FAF8F5]/30'
                      : 'border-zinc-200 text-zinc-600 hover:bg-[#FAF8F5]'
                  }`}
                >
                  {pageNum}
                </button>
              )
            })}

            {/* Next page button */}
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className={`border px-3 py-1.5 text-[11px] font-sans font-medium rounded-none select-none ${
                currentPage === totalPages
                  ? 'border-zinc-100 text-zinc-300 cursor-not-allowed'
                  : 'border-zinc-200 text-zinc-600 hover:bg-[#FAF8F5] cursor-pointer'
              }`}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
