'use client'

import React from 'react'
import Link from 'next/link'
import { Plus, Image as ImageIcon } from 'lucide-react'
import { useBanners, useDeleteBanner } from '@/hooks/use-banners'
import { TableSkeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'

export default function BannersPage() {
  const { data: banners = [], isLoading, error, refetch } = useBanners()
  const deleteBannerMutation = useDeleteBanner()

  if (isLoading) return <TableSkeleton rows={6} />
  if (error) return <ErrorState message={error.message} onRetry={refetch} />

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this banner?')) {
      try {
        await deleteBannerMutation.mutateAsync(id)
      } catch {
        alert('Failed to delete banner')
      }
    }
  }

  return (
    <div className="space-y-6 px-8 pt-10 font-inter relative animate-fade-in">

      {deleteBannerMutation.isPending && (
        <div className="fixed inset-0 bg-white/50 z-50 flex items-center justify-center">
          <div className="text-zinc-500 font-medium text-xs">Deleting...</div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold tracking-wider text-zinc-800 uppercase font-sans">
          Banners
        </h3>
        <Link
          href="/banners/add"
          className="bg-[#B38B5D] hover:bg-[#A37B4D] text-white text-[10px] font-bold tracking-widest px-6 py-3.5 transition-colors duration-200 rounded-none uppercase cursor-pointer flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          ADD BANNER
        </Link>
      </div>

      {/* Banner Grid */}
      {banners.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {banners.map((banner) => (
            <div
              key={banner.id}
              className="border border-[#E8E0D5] bg-white shadow-xs hover:shadow-sm transition-shadow"
            >
              <div className="relative aspect-video bg-[#FAF8F5] overflow-hidden">
                {banner.image_url ? (
                  <img
                    src={banner.image_url}
                    alt={banner.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-400">
                    <ImageIcon className="w-8 h-8 stroke-[1.5]" />
                  </div>
                )}
                {!banner.is_active && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="text-white text-[10px] font-bold tracking-widest uppercase">Inactive</span>
                  </div>
                )}
              </div>

              <div className="p-4 space-y-3">
                <p className="text-[12px] font-medium text-zinc-800 line-clamp-2">
                  {banner.title}
                </p>
                <div className="flex gap-2">
                  <Link
                    href={`/banners/edit/${banner.id}`}
                    className="flex-1 border border-[#E8E0D5] hover:bg-[#FAF8F5] text-[10px] font-bold tracking-widest text-[#B38B5D] py-2 transition-colors uppercase rounded-none text-center"
                  >
                    EDIT
                  </Link>
                  <button
                    onClick={() => handleDelete(banner.id)}
                    className="flex-1 border border-red-200 hover:bg-red-50 text-[10px] font-bold tracking-widest text-red-600 py-2 transition-colors uppercase rounded-none"
                  >
                    DELETE
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-[#E8E0D5] px-6 py-12 text-center text-[12px] text-zinc-400 font-medium">
          No banners yet. Add your first banner.
        </div>
      )}

    </div>
  )
}
