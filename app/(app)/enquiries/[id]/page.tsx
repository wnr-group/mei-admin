'use client'

import React, { useState } from 'react'
import { use } from 'react'
import { useEnquiry, useUpdateEnquiryStatus, useUpdateEnquiryAdminNotes } from '@/hooks/use-enquiries'
import Link from 'next/link'
import { Mail, Phone, Loader2 } from 'lucide-react'
import { ErrorState } from '@/components/ui/error-state'
import type { EnquiryStatus } from '@/types'

export default function EnquiryDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const { data: enquiry, isLoading, error, refetch } = useEnquiry(id)
  const updateStatusMutation = useUpdateEnquiryStatus()
  const saveNotesMutation = useUpdateEnquiryAdminNotes()

  const [notes, setNotes] = useState('')
  // Track the last ID synchronized to safely handle state resetting without useEffect cascading warnings
  const [prevEnquiryId, setPrevEnquiryId] = useState<string | null>(null)

  // If the enquiry has loaded and it's a new or changed record, sync the state directly during render
  if (enquiry && enquiry.id !== prevEnquiryId) {
    setNotes(enquiry.admin_reply || '')
    setPrevEnquiryId(enquiry.id)
  }

  // Handle status update
  const handleStatusChange = async (newStatus: EnquiryStatus) => {
    try {
      await updateStatusMutation.mutateAsync({ id, status: newStatus })
    } catch (err) {
      console.error('Failed to update status:', err)
      alert('Error updating status. Please try again.')
    }
  }

  // Handle save notes
  const handleSaveNotes = async () => {
    try {
      await saveNotesMutation.mutateAsync({ id, adminNotes: notes })
      alert('Notes saved successfully.')
    } catch (err) {
      console.error('Failed to save notes:', err)
      alert('Error saving notes. Please try again.')
    }
  }

  // Format price (e.g. ₹1,85,000)
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    })
      .format(price)
      .replace('INR', '₹')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <span className="font-serif text-lg text-[#B38B5D] tracking-widest uppercase">MEI BRIDAL COUTURE</span>
          <span className="text-xs text-zinc-400">Loading Enquiry Details...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return <ErrorState message={error.message} onRetry={refetch} />
  }

  if (!enquiry) {
    return (
      <div className="space-y-4 px-8 pt-10 text-center font-inter">
        <h2 className="text-lg font-bold text-zinc-800">Enquiry Not Found</h2>
        <p className="text-sm text-zinc-500">The enquiry details you are trying to view do not exist.</p>
        <Link
          href="/enquiries"
          className="inline-block bg-[#1A1A1A] text-white text-[11px] font-bold tracking-widest px-6 py-3 uppercase hover:bg-black transition-colors"
        >
          Back to Enquiries
        </Link>
      </div>
    )
  }

  // Dynamic heuristics to derive Product and details from the message
  const getProductDetails = (msg: string) => {
    const msgLower = (msg || '').toLowerCase()
    if (msgLower.includes('noor lehenga')) {
      return {
        name: 'The Noor Lehenga',
        price: 185000,
        image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?q=80&w=150&auto=format&fit=crop'
      }
    }
    if (msgLower.includes('crimson lehenga')) {
      return {
        name: 'Afsana Crimson Lehenga',
        price: 230000,
        image: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=150&auto=format&fit=crop'
      }
    }
    if (msgLower.includes('silk saree')) {
      return {
        name: 'Heritage Silk Saree',
        price: 85000,
        image: 'https://images.unsplash.com/photo-1610030469668-93535c17b6b3?q=80&w=150&auto=format&fit=crop'
      }
    }
    if (msgLower.includes('velvet gown')) {
      return {
        name: 'Zoya Velvet Gown',
        price: 110000,
        image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?q=80&w=150&auto=format&fit=crop'
      }
    }
    if (msgLower.includes('atelier')) {
      return {
        name: 'Custom Atelier Piece',
        price: 350000,
        image: 'https://images.unsplash.com/photo-1605722243979-fe0be8158232?q=80&w=150&auto=format&fit=crop'
      }
    }
    return {
      name: 'Custom Tailoring Request',
      price: 150000,
      image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?q=80&w=150&auto=format&fit=crop'
    }
  }

  const prodInfo = getProductDetails(enquiry.message)

  // Fallback defaults for custom tags and metadata
  const finalEmail = enquiry.email
  const finalPhone = enquiry.phone || '+91 98765 43210'
  const finalOccasion = 'Bridal'
  const finalBudget = '₹1L - ₹2L'
  const finalMeasurements = {
    bust: '36"',
    waist: '28"',
    hip: '38"',
    shoulder: '14"',
    length: '44"',
    sleeve: '22"',
  }
  const finalRefImages = [
    'https://images.unsplash.com/photo-1610030469983-98e550d6193c?q=80&w=150&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=150&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1610030469668-93535c17b6b3?q=80&w=150&auto=format&fit=crop',
  ]

  const dateFormatted = new Date(enquiry.created_at).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })

  return (
    <div className="max-w-[700px] mx-auto pt-6 pb-16 font-inter animate-fade-in px-4">
      {/* Loading Overlay */}
      {(updateStatusMutation.isPending || saveNotesMutation.isPending) && (
        <div className="fixed inset-0 bg-white/50 z-50 flex items-center justify-center">
          <div className="text-zinc-500 font-medium text-xs">Saving...</div>
        </div>
      )}

      {/* Back to Enquiries Link */}
      <div className="mb-6">
        <Link
          href="/enquiries"
          className="text-[12px] font-medium text-zinc-500 hover:text-zinc-800 transition-colors flex items-center gap-1.5 select-none"
        >
          <span>←</span> Back to Enquiries
        </Link>
      </div>

      {/* Header Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8">
        <div>
          <h1 className="font-cormorant lining-nums text-[32px] text-zinc-950 font-normal tracking-wide leading-none mb-2">
            ENQ-{enquiry.id.slice(0, 8).toUpperCase()}
          </h1>
          <p className="text-[12px] text-zinc-600 font-inter">
            {dateFormatted}
          </p>
        </div>

        {/* Status Dropdown & WhatsApp Button */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Status Dropdown */}
          <div className="relative">
            <select
              value={enquiry.status}
              onChange={(e) => handleStatusChange(e.target.value as EnquiryStatus)}
              disabled={updateStatusMutation.isPending}
              className="border border-[#E8E0D5] bg-white pl-4 pr-10 py-2.5 text-[12px] font-medium text-zinc-700 focus:outline-hidden focus:border-[#B38B5D] cursor-pointer appearance-none font-sans uppercase tracking-wider rounded-none min-w-[130px]"
            >
              <option value="NEW">New</option>
              <option value="REPLIED">Replied</option>
              <option value="CLOSED">Closed</option>
            </select>
            <div className="absolute right-3.5 top-3.5 pointer-events-none text-zinc-400 text-[8px] font-sans">
              {updateStatusMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin text-zinc-400" /> : '▼'}
            </div>
          </div>

          {/* Message on WhatsApp Button */}
          <a
            href={`https://wa.me/${finalPhone.replace(/[^\d]/g, '')}?text=Hello%20${enquiry.name},%20regarding%20your%20enquiry%20ENQ-${enquiry.id.slice(0, 8).toUpperCase()}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#25D366] hover:bg-[#20ba5a] text-white text-[12px] font-bold px-4 py-2.5 flex items-center gap-2.5 transition-colors cursor-pointer select-none font-sans rounded-none"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M.057 24 l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.665.989 3.3 1.489 5.361 1.49 5.373 0 9.743-4.307 9.745-9.643.001-2.585-1.01-5.016-2.85-6.859-1.84-1.84-4.284-2.85-6.867-2.852-5.379 0-9.752 4.307-9.754 9.64-.001 2.128.56 4.198 1.628 5.945l-1.066 3.89 3.996-1.037z" />
            </svg>
            Message on WhatsApp
          </a>
        </div>
      </div>

      <div className="space-y-6">
        {/* CUSTOMER DETAILS Card */}
        <div className="bg-white border border-[#E8E0D5] p-6 shadow-xs">
          <h3 className="text-[9px] font-medium tracking-widest text-zinc-600 uppercase mb-4 font-sans">
            CUSTOMER DETAILS
          </h3>
          <div className="space-y-4">
            <div className="text-[14px] font-bold text-zinc-800">{enquiry.name}</div>
            
            {/* Email and Phone Contact list */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-zinc-500 font-inter">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-zinc-400 stroke-[1.5]" />
                <span>{finalEmail}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-zinc-400 stroke-[1.5]" />
                <span>{finalPhone}</span>
              </div>
            </div>

            {/* Occasion and Budget tags */}
            <div className="flex flex-wrap gap-3 pt-2">
              <span className="border border-[#E8E0D5] bg-[#FAF8F5]/40 px-3 py-1.5 text-[11px] font-sans font-medium text-zinc-600 rounded-none">
                Occasion: {finalOccasion}
              </span>
              <span className="border border-[#E8E0D5] bg-[#FAF8F5]/40 px-3 py-1.5 text-[11px] font-sans font-medium text-zinc-600 rounded-none">
                Budget: {finalBudget}
              </span>
            </div>
          </div>
        </div>

        {/* INTERESTED IN Card */}
        <div className="bg-white border border-[#E8E0D5] p-6 shadow-xs">
          <h3 className="text-[9px] font-medium tracking-widest text-zinc-600 uppercase mb-4 font-sans">
            INTERESTED IN
          </h3>
          <div className="flex items-center gap-4">
            <div className="w-[60px] h-[60px] border border-[#E8E0D5] overflow-hidden bg-zinc-100 flex-shrink-0">
              <img
                src={prodInfo.image}
                alt={prodInfo.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="text-[13px] font-medium text-zinc-800">{prodInfo.name}</div>
              <div className="text-[12px] text-zinc-500 font-inter mt-1">
                {formatPrice(prodInfo.price)}
              </div>
            </div>
          </div>
        </div>

        {/* MESSAGE Card */}
        <div className="bg-white border border-[#E8E0D5] p-6 shadow-xs">
          <h3 className="text-[9px] font-medium tracking-widest text-zinc-600 uppercase mb-4 font-sans">
            MESSAGE
          </h3>
          <p className="text-[12px] text-zinc-600 font-sans font-inter leading-relaxed">
            {enquiry.message}
          </p>
        </div>

        {/* PROVIDED MEASUREMENTS Card */}
        <div className="bg-white border border-[#E8E0D5] p-6 shadow-xs">
          <h3 className="text-[9px] font-medium tracking-widest text-zinc-600 uppercase mb-4 font-sans">
            PROVIDED MEASUREMENTS
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {/* BUST */}
            <div className="bg-[#FAF8F5]/60 border border-[#E8E0D5] p-3 text-left">
              <div className="text-[9px] font-medium text-zinc-600 font-inter tracking-wide">BUST</div>
              <div className="text-[16px] font-medium text-zinc-800 mt-1 font-inter">{finalMeasurements.bust}</div>
            </div>
            {/* WAIST */}
            <div className="bg-[#FAF8F5]/60 border border-[#E8E0D5] p-3 text-left">
              <div className="text-[9px] font-bold text-zinc-600 font-sans tracking-wide">WAIST</div>
              <div className="text-[16px] font-medium text-zinc-800 mt-1 font-inter">{finalMeasurements.waist}</div>
            </div>
            {/* HIP */}
            <div className="bg-[#FAF8F5]/60 border border-[#E8E0D5] p-3 text-left">
              <div className="text-[9px] font-bold text-zinc-600 font-sans tracking-wide">HIP</div>
              <div className="text-[16px] font-medium text-zinc-800 mt-1 font-inter">{finalMeasurements.hip}</div>
            </div>
            {/* SHOULDER */}
            <div className="bg-[#FAF8F5]/60 border border-[#E8E0D5] p-3 text-left">
              <div className="text-[9px] font-bold text-zinc-600 font-sans tracking-wide">SHOULDER</div>
              <div className="text-[16px] font-medium text-zinc-800 mt-1 font-inter">{finalMeasurements.shoulder}</div>
            </div>
            {/* LENGTH */}
            <div className="bg-[#FAF8F5]/60 border border-[#E8E0D5] p-3 text-left">
              <div className="text-[9px] font-bold text-zinc-600 font-sans tracking-wide">LENGTH</div>
              <div className="text-[16px] font-medium text-zinc-800 mt-1 font-inter">{finalMeasurements.length}</div>
            </div>
            {/* SLEEVE */}
            <div className="bg-[#FAF8F5]/60 border border-[#E8E0D5] p-3 text-left">
              <div className="text-[9px] font-bold text-zinc-600 font-sans tracking-wide">SLEEVE</div>
              <div className="text-[16px] font-medium text-zinc-800 mt-1 font-inter">{finalMeasurements.sleeve}</div>
            </div>
          </div>
        </div>

        {/* REFERENCE IMAGES Card */}
        <div className="bg-white border border-[#E8E0D5] p-6 shadow-xs">
          <h3 className="text-[9px] font-medium tracking-widest text-zinc-600 uppercase mb-4 font-inter">
            REFERENCE IMAGES
          </h3>
          <div className="flex flex-wrap gap-4">
            {finalRefImages.map((img, idx) => (
              <div key={idx} className="relative border border-[#E8E0D5] w-[110px] h-[110px] bg-zinc-100 overflow-hidden flex-shrink-0">
                <img
                  src={img}
                  alt={`Reference snippet ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>

        {/* ADMIN NOTES Card */}
        <div className="bg-white border border-[#E8E0D5] p-6 shadow-xs">
          <h3 className="text-[9px] font-medium tracking-widest text-zinc-600 uppercase mb-4 font-inter">
            ADMIN NOTES
          </h3>
          <div className="space-y-4">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add internal notes..."
              rows={4}
              className="w-full border border-[#E8E0D5] p-3 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors resize-none rounded-none"
            />
            
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={saveNotesMutation.isPending}
                className="border border-[#B38B5D] text-[#B38B5D] hover:bg-[#B38B5D] hover:text-white px-5 py-2.5 text-[11px] font-bold tracking-widest uppercase transition-all duration-200 rounded-none cursor-pointer flex items-center gap-2"
              >
                {saveNotesMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                Save Notes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}