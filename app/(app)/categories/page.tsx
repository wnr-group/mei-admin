'use client'

import React from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { useCategories, useDeleteCategory } from '@/hooks/use-categories'
import { TableSkeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'

export default function CategoriesPage() {
  const { data, isLoading, error, refetch } = useCategories({ page: 1, limit: 50 })
  const deleteCategoryMutation = useDeleteCategory()

  const categories = data ?? []

  if (isLoading) return <TableSkeleton rows={6} />
  if (error) return <ErrorState message={error.message} onRetry={refetch} />

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this category?')) {
      try {
        await deleteCategoryMutation.mutateAsync(id)
      } catch {
        alert('Failed to delete category')
      }
    }
  }

  return (
    <div className="space-y-6 px-8 pt-10 font-inter relative animate-fade-in">

      {deleteCategoryMutation.isPending && (
        <div className="fixed inset-0 bg-white/50 z-50 flex items-center justify-center">
          <div className="text-zinc-500 font-medium text-xs">Deleting...</div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold tracking-wider text-zinc-800 uppercase font-sans">
          Categories
        </h3>
        <Link
          href="/categories/add"
          className="bg-[#B38B5D] hover:bg-[#A37B4D] text-white text-[10px] font-bold tracking-widest px-6 py-3.5 transition-colors duration-200 rounded-none uppercase cursor-pointer flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          ADD CATEGORY
        </Link>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E8E0D5] shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAF8F5] border-b border-[#E8E0D5]">
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[30%]">NAME</th>
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[50%]">DESCRIPTION</th>
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[20%] text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E0D5]">
              {categories.length > 0 ? (
                categories.map((category) => (
                  <tr key={category.id} className="hover:bg-[#FAF8F5]/40 transition-colors">
                    <td className="px-6 py-3 text-[12px] font-medium text-zinc-800">
                      {category.name}
                    </td>
                    <td className="px-6 py-3 text-[12px] text-zinc-700 font-medium">
                      {category.description ?? '-'}
                    </td>
                    <td className="px-6 py-4.5 text-right space-x-3 text-[10px] font-bold tracking-widest">
                      <Link
                        href={`/categories/add?edit=${category.id}`}
                        className="text-[#B38B5D] hover:text-[#A37B4D] uppercase transition-colors"
                      >
                        EDIT
                      </Link>
                      <button
                        onClick={() => handleDelete(category.id)}
                        className="text-red-600 hover:text-red-700 uppercase transition-colors"
                      >
                        DELETE
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-[12px] text-zinc-400 font-medium">
                    No categories yet. Add your first category.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
