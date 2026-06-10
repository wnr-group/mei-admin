'use client';

import React, { useState, useEffect } from 'react';
import { 
  fetchBanners, 
  deleteBanner, 
  Banner 
} from '@/lib/mockDb';
import { 
  Image as ImageIcon, 
  Plus 
} from 'lucide-react';
import Link from 'next/link';

// Helper function to format date range to match screenshot format (e.g. 01 May - 30 Aug 2024)
function formatDateRange(startDate?: string, endDate?: string): string {
  if (!startDate || !endDate) return 'Ongoing';
  
  const formatDate = (dateStr: string) => {
    // Expected format: YYYY-MM-DDTHH:MM or YYYY-MM-DD
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const monthIndex = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[monthIndex];
      return `${String(day).padStart(2, '0')} ${month} ${year}`;
    }
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = String(date.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  try {
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  } catch {
    return 'Ongoing';
  }
}

export default function BannersPage() {
  const [mounted, setMounted] = useState(false);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load banners on mount
  useEffect(() => {
    async function loadData() {
      const data = await fetchBanners();
      setBanners(data);
      setMounted(true);
    }
    loadData();
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <span className="font-serif text-lg text-[#B38B5D] tracking-widest uppercase">MEI BRIDAL COUTURE</span>
          <span className="text-xs text-zinc-400">Loading Banners...</span>
        </div>
      </div>
    );
  }

  // DELETE a banner
  const handleDeleteBanner = async (id: string) => {
    if (confirm('Are you sure you want to delete this banner?')) {
      setIsLoading(true);
      await deleteBanner(id);
      const data = await fetchBanners();
      setBanners(data);
      setIsLoading(false);
    }
  };

  // Helper to render type display label
  const getTypeLabel = (type: Banner['type']) => {
    switch (type) {
      case 'HERO': return 'Hero';
      case 'PROMO': return 'Promo';
      case 'CATEGORY_HEADER': return 'Category Header';
      default: return type;
    }
  };

  return (
    <div className="space-y-6 px-8 pt-10 font-inter relative animate-fade-in pb-16">
      
      {/* Loading overlay for database queries */}
      {isLoading && (
        <div className="fixed inset-0 bg-white/50 z-50 flex items-center justify-center">
          <div className="text-zinc-500 font-medium text-xs">Deleting banner...</div>
        </div>
      )}

      {/* 1. Header Page Section matching screenshot layout */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-[32px] text-zinc-950 font-normal tracking-wide leading-none">
            Banners
          </h1>
          <p className="text-[12px] text-zinc-500 mt-2 font-inter">
            Manage promotional and hero banners across the storefront.
          </p>
        </div>
        
        <Link href="/banners/add">
          <button
            className="bg-[#7D5A2F] hover:bg-[#6D4E27] text-white text-[10px] font-bold tracking-widest px-6 py-3.5 transition-colors duration-200 rounded-none uppercase cursor-pointer"
          >
            ADD BANNER
          </button>
        </Link>
      </div>

      {/* 2. Grid list layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
        {banners.map((banner) => (
          <div key={banner.id} className="bg-white border border-[#E8E0D5] flex flex-col shadow-xs">
            
            {/* Banner Image Container */}
            <div className="relative w-full h-52 bg-[#F5F5F5] border-b border-[#E8E0D5] overflow-hidden group">
              {banner.image ? (
                <img 
                  src={banner.image} 
                  alt={banner.name} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-102"
                  onError={(e) => {
                    // Hide the image element if loading fails, exposing the styled alt container below
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : null}

              {/* Alt/Fallback details styled exactly like screenshot's broken image look */}
              <div className="absolute inset-0 p-4 pointer-events-none flex flex-col justify-between">
                <span className="text-[11px] font-medium text-zinc-600 font-sans break-all select-all">
                  {banner.name}
                </span>
                {!banner.image && (
                  <div className="flex items-center gap-1.5 text-zinc-400 self-end mt-auto">
                    <ImageIcon className="w-3.5 h-3.5 stroke-[1.5]" />
                    <span className="text-[8px] uppercase tracking-wider font-bold">No Image URL</span>
                  </div>
                )}
              </div>
            </div>

            {/* Banner Description/Metadata details */}
            <div className="p-6 flex-1 flex flex-col justify-between bg-white">
              
              {/* Title & Tags Row */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-[12px] font-bold text-zinc-800 tracking-wider uppercase font-sans break-words">
                    {banner.title}
                  </h4>
                  {banner.subtitle && (
                    <p className="text-[10px] text-zinc-400 mt-1 font-medium italic break-words">
                      {banner.subtitle}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 justify-end flex-shrink-0">
                  {/* Type Tag */}
                  <span className="bg-[#FAF6F0] text-[#8B704C] px-2 py-0.5 text-[7.5px] font-bold tracking-wider uppercase border border-[#E8E0D5]/50">
                    {getTypeLabel(banner.type)}
                  </span>
                  
                  {/* Status Tag */}
                  <span className={`px-2 py-0.5 text-[7.5px] font-bold tracking-wider uppercase ${
                    banner.status === 'ACTIVE' 
                      ? 'bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]' 
                      : 'bg-[#EEEEEE] text-[#616161] border border-zinc-200'
                  }`}>
                    {banner.status}
                  </span>
                </div>
              </div>

              {/* Faint divider divider */}
              <div className="border-t border-[#FAF6F0] my-4" />

              {/* Schedule Info and Actions Row */}
              <div className="flex items-end justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="block text-[8px] font-bold tracking-wider text-zinc-400 uppercase">
                    Scheduled Date
                  </span>
                  <span className="block text-[11px] font-semibold text-zinc-600">
                    {formatDateRange(banner.startDate, banner.endDate)}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-[10px] font-bold tracking-widest flex-shrink-0">
                  <Link 
                    href={`/banners/edit/${banner.id}`}
                    className="text-[#B38B5D] hover:text-[#A37B4D] uppercase transition-colors cursor-pointer select-none"
                  >
                    EDIT
                  </Link>
                  <button 
                    onClick={() => handleDeleteBanner(banner.id)}
                    className="text-[#B38B5D] hover:text-[#A37B4D] uppercase transition-colors cursor-pointer"
                  >
                    DELETE
                  </button>
                </div>
              </div>

            </div>

          </div>
        ))}

        {/* 3. Dotted 'Create New Banner' card matching grid exactly */}
        <Link 
          href="/banners/add"
          className="border border-dashed border-[#E8E0D5] bg-[#FAF8F5]/30 hover:bg-[#FAF8F5]/60 transition-all duration-200 cursor-pointer flex flex-col items-center justify-center p-6 min-h-[300px] shadow-xs"
        >
          <div className="w-12 h-12 rounded-full border border-[#E8E0D5] bg-white flex items-center justify-center text-zinc-400 hover:border-[#B38B5D] hover:text-[#B38B5D] transition-colors mb-4">
            <Plus className="w-4 h-4 stroke-[1.5]" />
          </div>
          <span className="text-[9px] font-bold tracking-widest text-zinc-500 uppercase">
            CREATE NEW BANNER
          </span>
        </Link>

      </div>

    </div>
  );
}
