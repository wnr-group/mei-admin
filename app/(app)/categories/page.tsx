'use client'

import React, { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '@/hooks/use-categories'
import { TableSkeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
import type { Category } from '@/types'

export default function CategoriesPage() {
  const { data, isLoading, error, refetch } = useCategories({ page: 1, limit: 6 })
  const createCategoryMutation = useCreateCategory()
  const updateCategoryMutation = useUpdateCategory()
  const deleteCategoryMutation = useDeleteCategory()

  const categories = data ?? []

  // Drawer Form state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)

  // Input fields
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')

  if (isLoading) return <TableSkeleton rows={6} />
  if (error) return <ErrorState message={error.message} onRetry={refetch} />

  // Open drawer to ADD a new category
  const handleOpenAdd = () => {
    setEditingCategory(null)
    setFormName('')
    setFormDescription('')
    setIsDrawerOpen(true)
  }

  // Open drawer to EDIT an existing category
  const handleOpenEdit = (category: Category) => {
    setEditingCategory(category)
    setFormName(category.name)
    setFormDescription(category.description ?? '')
    setIsDrawerOpen(true)
  }

  // DELETE a category
  const handleDeleteCategory = async (id: string) => {
    if (confirm('Are you sure you want to delete this category?')) {
      try {
        await deleteCategoryMutation.mutateAsync(id)
      } catch {
        alert('Failed to delete category')
      }
    }
  }

  // SAVE category (Add or Edit)
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName) return

    const slug = formName.toLowerCase().trim().replace(/\s+/g, '-')

    try {
      if (editingCategory) {
        await updateCategoryMutation.mutateAsync({
          id: editingCategory.id,
          updates: {
            name: formName,
            slug,
            description: formDescription || null
          }
        })
      } else {
        await createCategoryMutation.mutateAsync({
          name: formName,
          slug,
          description: formDescription || null
        })
      }
      setIsDrawerOpen(false)
    } catch {
      alert('Failed to save category')
    }
  }

  if (categories.length === 0) return <EmptyState message="No categories yet." />

  return (
    <div className="space-y-6 px-8 pt-10 font-inter relative animate-fade-in">

      {/* Loading overlay for mutations */}
      {(createCategoryMutation.isPending || updateCategoryMutation.isPending || deleteCategoryMutation.isPending) && (
        <div className="fixed inset-0 bg-white/50 z-50 flex items-center justify-center">
          <div className="text-zinc-500 font-medium text-xs">Saving updates...</div>
        </div>
      )}

      {/* 1. Header Page Section */}
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold tracking-wider text-zinc-800 uppercase font-sans">
          Categories
        </h3>

        <button
          onClick={handleOpenAdd}
          className="bg-[#B38B5D] hover:bg-[#A37B4D] text-white text-[10px] font-bold tracking-widest px-6 py-3.5 transition-colors duration-200 rounded-none uppercase cursor-pointer flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          ADD CATEGORY
        </button>
      </div>

      {/* 2. Category Listing Table Container */}
      <div className="bg-white border border-[#E8E0D5] shadow-xs">

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAF8F5] border-b border-[#E8E0D5]">
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[30%]">
                  NAME
                </th>
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[50%]">
                  DESCRIPTION
                </th>
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[20%] text-right">
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E0D5]">
              {categories.map((category) => (
                <tr key={category.id} className="hover:bg-[#FAF8F5]/40 transition-colors">
                  <td className="px-6 py-3 text-[12px] font-medium text-zinc-800">
                    {category.name}
                  </td>
                  <td className="px-6 py-3 text-[12px] text-zinc-700 font-medium">
                    {category.description ?? '-'}
                  </td>
                  <td className="px-6 py-4.5 text-right space-x-3 text-[10px] font-bold tracking-widest">
                    <button
                      onClick={() => handleOpenEdit(category)}
                      className="text-[#B38B5D] hover:text-[#A37B4D] uppercase transition-colors"
                    >
                      EDIT
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category.id)}
                      className="text-red-600 hover:text-red-700 uppercase transition-colors"
                    >
                      DELETE
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>

      {/* 3. Slide-over Form Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">

          <div
            onClick={() => setIsDrawerOpen(false)}
            className="absolute inset-0 bg-black/35 backdrop-blur-xs transition-opacity duration-300"
          />

          <div className="relative w-full max-w-[480px] bg-white h-full shadow-2xl flex flex-col justify-between py-10 px-8 animate-slide-in border-l border-[#E8E0D5]">

            <div>
              <div className="flex items-center justify-between border-b border-[#E8E0D5] pb-5">
                <h4 className="font-serif text-[22px] text-[#B38B5D] font-medium tracking-wide">
                  {editingCategory ? 'Edit Category' : 'Add Category'}
                </h4>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="text-zinc-400 hover:text-zinc-700 transition-colors p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveCategory} id="drawer-form" className="mt-8 space-y-6">

                {/* Category Name */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
                    Category Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Bridal Lehengas"
                    className="w-full border-b border-[#E8E0D5] py-2 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
                    Description
                  </label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Optional description"
                    rows={4}
                    className="w-full border border-[#E8E0D5] p-3 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
                  />
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
                className="flex-1 bg-[#B38B5D] hover:bg-[#A37B4D] text-[10px] font-bold tracking-widest text-white py-4 transition-colors uppercase rounded-none"
              >
                {editingCategory ? 'Save Changes' : 'Create Category'}
              </button>
            </div>

          </div>

        </div>
      )}

    </div>
  )
}
