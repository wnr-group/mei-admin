'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { fetchEnquiryById, updateEnquiryStatus, updateEnquiryAdminNotes, Enquiry } from '@/lib/mockDb';
import Link from 'next/link';
import { Mail, Phone, Loader2 } from 'lucide-react';

export default function EnquiryDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const [enquiry, setEnquiry] = useState<Enquiry | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Load enquiry details on mount
  useEffect(() => {
    async function loadEnquiry() {
      const data = await fetchEnquiryById(id);
      if (data) {
        setEnquiry(data);
        setNotes(data.adminNotes || '');
      }
      setLoading(false);
    }
    loadEnquiry();
  }, [id]);

  // Handle status update
  const handleStatusChange = async (newStatus: Enquiry['status']) => {
    if (!enquiry) return;
    setUpdatingStatus(true);
    try {
      const updated = await updateEnquiryStatus(enquiry.id, newStatus);
      if (updated) {
        setEnquiry(updated);
      }
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Error updating status. Please try again.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handle save notes
  const handleSaveNotes = async () => {
    if (!enquiry) return;
    setSavingNotes(true);
    try {
      const updated = await updateEnquiryAdminNotes(enquiry.id, notes);
      if (updated) {
        setEnquiry(updated);
        alert('Notes saved successfully.');
      }
    } catch (err) {
      console.error('Failed to save notes:', err);
      alert('Error saving notes. Please try again.');
    } finally {
      setSavingNotes(false);
    }
  };

  // Format price (e.g. ₹1,85,000)
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    })
      .format(price)
      .replace('INR', '₹');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <span className="font-serif text-lg text-[#B38B5D] tracking-widest uppercase">MEI BRIDAL COUTURE</span>
          <span className="text-xs text-zinc-400">Loading Enquiry Details...</span>
        </div>
      </div>
    );
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
    );
  }

  // Fallbacks logic for generic display across any other generated enquiries
  const finalEmail = enquiry.customerEmail || 'aisha.sharma@example.com';
  const finalPhone = enquiry.customerPhone || '+91 98765 43210';
  const finalOccasion = enquiry.occasion || 'Occasion: Bridal';
  const finalBudget = enquiry.budget || 'Budget: ₹1L - ₹2L';
  const finalProductPrice = enquiry.productPrice || 185000;
  const finalProductImage = enquiry.productImage || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?q=80&w=150&auto=format&fit=crop';
  const finalMessage = enquiry.message || 'I am looking for a custom version of the Noor Lehenga for my wedding in December. I would like to add more heavy embroidery on the trail and possibly change the dupatta color to a deep maroon.';
  const finalMeasurements = enquiry.measurements || {
    bust: '36"',
    waist: '28"',
    hip: '38"',
    shoulder: '14"',
    length: '44"',
    sleeve: '22"',
  };
  const finalRefImages = enquiry.referenceImages && enquiry.referenceImages.length > 0 ? enquiry.referenceImages : [
    'https://images.unsplash.com/photo-1610030469983-98e550d6193c?q=80&w=150&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=150&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1610030469668-93535c17b6b3?q=80&w=150&auto=format&fit=crop',
  ];

  return (
    <div className="max-w-[700px] mx-auto pt-6 pb-16 font-inter animate-fade-in px-4">
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
            {enquiry.id}
          </h1>
          <p className="text-[12px] text-zinc-600 font-inter">
            {enquiry.date}
          </p>
        </div>

        {/* Status Dropdown & WhatsApp Button */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Status Dropdown */}
          <div className="relative">
            <select
              value={enquiry.status}
              onChange={(e) => handleStatusChange(e.target.value as Enquiry['status'])}
              disabled={updatingStatus}
              className="border border-[#E8E0D5] bg-white pl-4 pr-10 py-2.5 text-[12px] font-medium text-zinc-700 focus:outline-hidden focus:border-[#B38B5D] cursor-pointer appearance-none font-sans uppercase tracking-wider rounded-none min-w-[130px]"
            >
              <option value="NEW">New</option>
              <option value="CONTACTED">Contacted</option>
              <option value="QUOTED">Quoted</option>
              <option value="CONVERTED">Converted</option>
              <option value="CLOSED">Closed</option>
            </select>
            <div className="absolute right-3.5 top-3.5 pointer-events-none text-zinc-400 text-[8px] font-sans">
              {updatingStatus ? <Loader2 className="w-3 h-3 animate-spin text-zinc-400" /> : '▼'}
            </div>
          </div>

          {/* Message on WhatsApp Button */}
          <a
            href={`https://wa.me/${finalPhone.replace(/[^\d]/g, '')}?text=Hello%20${enquiry.customerName},%20regarding%20your%20enquiry%20${enquiry.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#25D366] hover:bg-[#20ba5a] text-white text-[12px] font-bold px-4 py-2.5 flex items-center gap-2.5 transition-colors cursor-pointer select-none font-sans rounded-none"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.665.989 3.3 1.489 5.361 1.49 5.373 0 9.743-4.307 9.745-9.643.001-2.585-1.01-5.016-2.85-6.859-1.84-1.84-4.284-2.85-6.867-2.852-5.379 0-9.752 4.307-9.754 9.64-.001 2.128.56 4.198 1.628 5.945l-1.066 3.89 3.996-1.037z" />
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
            <div className="text-[14px] font-bold text-zinc-800">{enquiry.customerName}</div>
            
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
                {finalOccasion.startsWith('Occasion:') ? finalOccasion : `Occasion: ${finalOccasion}`}
              </span>
              <span className="border border-[#E8E0D5] bg-[#FAF8F5]/40 px-3 py-1.5 text-[11px] font-sans font-medium text-zinc-600 rounded-none">
                {finalBudget.startsWith('Budget:') ? finalBudget : `Budget: ${finalBudget}`}
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
                src={finalProductImage}
                alt={enquiry.product}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="text-[13px] font-medium text-zinc-800">{enquiry.product}</div>
              <div className="text-[12px] text-zinc-500 font-inter mt-1">
                {formatPrice(finalProductPrice)}
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
            {finalMessage}
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
                disabled={savingNotes}
                className="border border-[#B38B5D] text-[#B38B5D] hover:bg-[#B38B5D] hover:text-white px-5 py-2.5 text-[11px] font-bold tracking-widest uppercase transition-all duration-200 rounded-none cursor-pointer flex items-center gap-2"
              >
                {savingNotes && <Loader2 className="w-3 h-3 animate-spin" />}
                Save Notes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
