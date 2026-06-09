'use client'

import React, { useState, useRef } from 'react'
import { X, Plus, Image as ImageIcon } from 'lucide-react'
import { useBanners, useCreateBanner, useUpdateBanner, useDeleteBanner } from '@/hooks/use-banners'
import { uploadProductImage } from '@/services/storage'
import { TableSkeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
import type { Banner } from '@/types'

export default function BannersPage() {
  const { data: banners = [], isLoading, error, refetch } = useBanners()
  const createBannerMutation = useCreateBanner()
  const updateBannerMutation = useUpdateBanner()
  const deleteBannerMutation = useDeleteBanner()

  // Drawer Form state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null)

  // Input fields
  const [formTitle, setFormTitle] = useState('')
  const [formImageUrl, setFormImageUrl] = useState('')
  const [formLinkUrl, setFormLinkUrl] = useState('')
  const [formIsActive, setFormIsActive] = useState(true)
  const [formSortOrder, setFormSortOrder] = useState('0')

  // Image upload
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imagePreview, setImagePreview] = useState<string>('')

  if (isLoading) return <TableSkeleton rows={6} />
  if (error) return <ErrorState message={error.message} onRetry={refetch} />

  const handleOpenAdd = () => {
    setEditingBanner(null)
    setFormTitle('')
    setFormImageUrl('')
    setFormLinkUrl('')
    setFormIsActive(true)
    setFormSortOrder('0')
    setImagePreview('')
    setIsDrawerOpen(true)
  }

  const handleOpenEdit = (banner: Banner) => {
    setEditingBanner(banner)
    setFormTitle(banner.title)
    setFormImageUrl(banner.image_url)
    setFormLinkUrl(banner.link_url ?? '')
    setFormIsActive(banner.is_active)
    setFormSortOrder(banner.sort_order.toString())
    setImagePreview(banner.image_url)
    setIsDrawerOpen(true)
  }

  const handleDeleteBanner = async (id: string) => {
    if (confirm('Are you sure you want to delete this banner?')) {
      try {
        await deleteBannerMutation.mutateAsync(id)
      } catch {
        alert('Failed to delete banner')
      }
    }
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    try {
      const url = await uploadProductImage(file, 'banner-' + Date.now())
      setFormImageUrl(url)
      setImagePreview(url)
    } catch {
      alert('Failed to upload image')
    } finally {
      setUploadingImage(false)
    }
  }

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formTitle || !formImageUrl) return

    try {
      if (editingBanner) {
        await updateBannerMutation.mutateAsync({
          id: editingBanner.id,
          updates: {
            title: formTitle,
            image_url: formImageUrl,
            link_url: formLinkUrl || null,
            is_active: formIsActive,
            sort_order: parseInt(formSortOrder, 10)
          }
        })
      } else {
        await createBannerMutation.mutateAsync({
          title: formTitle,
          image_url: formImageUrl,
          link_url: formLinkUrl || null,
          is_active: formIsActive,
          sort_order: parseInt(formSortOrder, 10)
        })
      }
      setIsDrawerOpen(false)
    } catch {
      alert('Failed to save banner')
    }
  }

  if (banners.length === 0) return <EmptyState message="No banners yet." />

  return (
    <div className="space-y-6 px-8 pt-10 font-inter relative animate-fade-in">

      {/* Loading overlay for mutations */}
      {(createBannerMutation.isPending || updateBannerMutation.isPending || deleteBannerMutation.isPending || uploadingImage) && (
        <div className="fixed inset-0 bg-white/50 z-50 flex items-center justify-center">
          <div className="text-zinc-500 font-medium text-xs">
            {uploadingImage ? 'Uploading image...' : 'Saving...'}
          </div>
        </div>
      )}

      {/* 1. Header Page Section */}
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold tracking-wider text-zinc-800 uppercase font-sans">
          Banners
        </h3>

        <button
          onClick={handleOpenAdd}
          className="bg-[#B38B5D] hover:bg-[#A37B4D] text-white text-[10px] font-bold tracking-widest px-6 py-3.5 transition-colors duration-200 rounded-none uppercase cursor-pointer flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          ADD BANNER
        </button>
      </div>

      {/* 2. Banner Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {banners.map((banner) => (
          <div
            key={banner.id}
            className="border border-[#E8E0D5] bg-white shadow-xs hover:shadow-sm transition-shadow"
          >
            <div className="relative aspect-video bg-[#FAF8F5] overflow-hidden">
              {banner.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
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
              <div>
                <p className="text-[12px] font-medium text-zinc-800 line-clamp-2">
                  {banner.title}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleOpenEdit(banner)}
                  className="flex-1 border border-[#E8E0D5] hover:bg-[#FAF8F5] text-[10px] font-bold tracking-widest text-[#B38B5D] py-2 transition-colors uppercase rounded-none"
                >
                  EDIT
                </button>
                <button
                  onClick={() => handleDeleteBanner(banner.id)}
                  className="flex-1 border border-red-200 hover:bg-red-50 text-[10px] font-bold tracking-widest text-red-600 py-2 transition-colors uppercase rounded-none"
                >
                  DELETE
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 3. Slide-over Form Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">

          <div
            onClick={() => setIsDrawerOpen(false)}
            className="absolute inset-0 bg-black/35 backdrop-blur-xs transition-opacity duration-300"
          />

          <div className="relative w-full max-w-[480px] bg-white h-full shadow-2xl flex flex-col justify-between py-10 px-8 animate-slide-in border-l border-[#E8E0D5] overflow-y-auto">

            <div>
              <div className="flex items-center justify-between border-b border-[#E8E0D5] pb-5">
                <h4 className="font-serif text-[22px] text-[#B38B5D] font-medium tracking-wide">
                  {editingBanner ? 'Edit Banner' : 'Add Banner'}
                </h4>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="text-zinc-400 hover:text-zinc-700 transition-colors p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveBanner} id="drawer-form" className="mt-8 space-y-6">

                {/* Banner Title */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
                    Banner Title
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Summer Collection"
                    className="w-full border-b border-[#E8E0D5] py-2 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
                  />
                </div>

                {/* Image Upload */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
                    Banner Image
                  </label>

                  {imagePreview && (
                    <div className="relative aspect-video bg-[#FAF8F5] border border-[#E8E0D5] overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imagePreview}
                        alt="preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border border-[#E8E0D5] hover:bg-[#FAF8F5] text-[10px] font-bold tracking-widest text-zinc-600 py-3 transition-colors uppercase"
                  >
                    {uploadingImage ? 'Uploading...' : 'Choose Image'}
                  </button>
                </div>

                {/* Link URL */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
                    Link URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={formLinkUrl}
                    onChange={(e) => setFormLinkUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full border-b border-[#E8E0D5] py-2 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
                  />
                </div>

                {/* Sort Order */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formSortOrder}
                    onChange={(e) => setFormSortOrder(e.target.value)}
                    className="w-full border-b border-[#E8E0D5] py-2 text-[13px] text-zinc-800 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
                  />
                </div>

                {/* Active Status */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
                    Status
                  </label>
                  <label className="flex items-center gap-2 text-[12px] text-zinc-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span>Active</span>
                  </label>
                </div>

              </form>
            </div>

            <div className="border-t border-[#E8E0D5] pt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="flex-1 border border-zinc-200 hover:bg-zinc-50 text-[10px] font-bold tracking-widest text-zinc-500 py-4 transition-colors uppercase rounded-none"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="drawer-form"
                disabled={!formImageUrl}
                className="flex-1 bg-[#B38B5D] hover:bg-[#A37B4D] disabled:bg-zinc-300 text-[10px] font-bold tracking-widest text-white py-4 transition-colors uppercase rounded-none"
              >
                {editingBanner ? 'Save Changes' : 'Create Banner'}
              </button>
            </div>

          </div>

        </div>
      )}

    </div>
  )
}
