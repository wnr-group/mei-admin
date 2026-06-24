'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Image as ImageIcon, Plus } from 'lucide-react'
import { useProducts, useDeleteProduct } from '@/hooks/use-products'
import { useCategories } from '@/hooks/use-categories'
import { TableSkeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import type { Product } from '@/types'

export default function ProductsPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading, error, refetch } = useProducts({ page, limit: 6 })
  const { data: categories = [] } = useCategories()
  const deleteProductMutation = useDeleteProduct()

  const products = data?.products ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / 6)
  const itemsPerPage = 6

  if (isLoading) return <TableSkeleton rows={6} />
  if (error) return <ErrorState message={error.message} onRetry={refetch} />

  const renderThumbnail = (product: Product) => {
    if (product.image_url) {
      return (
        <img src={product.image_url} alt={product.name} className="w-[45px] h-[45px] object-cover border border-[#E8E0D5]" />
      )
    }
    return (
      <div className="w-[45px] h-[45px] bg-[#F5F5F5] border border-zinc-200 flex items-center justify-center text-zinc-400">
        <ImageIcon className="w-4 h-4 stroke-[1.5]" />
      </div>
    )
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      deleteProductMutation.mutate(id)
    }
  }

  return (
    <div className="space-y-6 px-8 pt-10 font-inter relative animate-fade-in">

      {deleteProductMutation.isPending && (
        <div className="fixed inset-0 bg-white/50 z-50 flex items-center justify-center">
          <div className="text-zinc-500 font-medium text-xs">Deleting...</div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold tracking-wider text-zinc-800 uppercase font-sans">
          Products
        </h3>
        <Link
          href="/products/add"
          className="bg-[#B38B5D] hover:bg-[#A37B4D] text-white text-[10px] font-bold tracking-widest px-6 py-3.5 transition-colors duration-200 rounded-none uppercase cursor-pointer flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          ADD PRODUCT
        </Link>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E8E0D5] shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAF8F5] border-b border-[#E8E0D5]">
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[10%]">IMAGE</th>
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[25%]">PRODUCT NAME</th>
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[15%]">CATEGORY</th>
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[15%]">PRICE</th>
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[18%]">WORK TYPES</th>
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[10%]">STATUS</th>
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[7%] text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E0D5]">
              {products.length > 0 ? (
                products.map((product) => {
                  const formattedPrice = new Intl.NumberFormat('en-IN', {
                    style: 'currency',
                    currency: 'INR',
                    maximumFractionDigits: 0
                  }).format(product.price)

                  const categoryName = categories.find((c: { id: string; name: string }) => c.id === product.category_id)?.name ?? '-'

                  return (
                    <tr key={product.id} className="hover:bg-[#FAF8F5]/40 transition-colors">
                      <td className="px-6 py-3">{renderThumbnail(product)}</td>
                      <td className="px-6 py-3 text-[12px] font-medium text-zinc-800">{product.name}</td>
                      <td className="px-6 py-3 text-[12px] text-zinc-700 font-medium">{categoryName}</td>
                      <td className="px-6 py-3 text-[12px] font-medium text-zinc-900 font-sans">{formattedPrice.replace('INR', '₹')}</td>
                      <td className="px-6 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(product.work_types ?? []).map((wt, i) => (
                            <span key={`${i}-${wt}`} className="border-2 border-gray-600 bg-white text-[7.5px] font-bold tracking-wider text-zinc-500 px-2 py-0.5">
                              {wt}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4.5">
                        <span className={`inline-block px-2.5 py-0.5 text-[7.5px] font-bold tracking-widest rounded-none uppercase ${
                          product.status === 'PUBLISHED' ? 'bg-[#E8F5E9] text-[#2E7D32]' : 'bg-[#EEEEEE] text-[#616161]'
                        }`}>
                          {product.status}
                        </span>
                      </td>
                      <td className="px-6 py-4.5 text-right space-x-3 text-[10px] font-bold tracking-widest">
                        <Link
                          href={`/products/edit/${product.id}`}
                          className="text-[#B38B5D] hover:text-[#A37B4D] uppercase transition-colors"
                        >
                          EDIT
                        </Link>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="text-red-600 hover:text-red-700 uppercase transition-colors"
                        >
                          DELETE
                        </button>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[12px] text-zinc-400 font-medium">
                    No products yet. Add your first product.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-8 py-5 border-t border-[#E8E0D5] gap-4 bg-[#FAF8F5]/30">
          <span className="text-[10px] font-medium text-zinc-400 tracking-wide">
            Showing {total === 0 ? 0 : (page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, total)} of {total} entries
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className={`border border-[#E8E0D5] bg-white px-3.5 py-1.5 text-[9px] font-bold tracking-wider uppercase transition-colors duration-150 ${page === 1 ? 'text-zinc-300 border-zinc-100 cursor-not-allowed' : 'text-zinc-500 hover:bg-zinc-50'}`}
              >
                PREV
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1.5 text-[9px] font-bold transition-all duration-150 ${page === p ? 'bg-[#B38B5D] text-white' : 'border border-[#E8E0D5] bg-white text-zinc-500 hover:bg-zinc-50'}`}
                >
                  {p}
                </button>
              ))}
              <button
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
                className={`border border-[#E8E0D5] bg-white px-3.5 py-1.5 text-[9px] font-bold tracking-wider uppercase transition-colors duration-150 ${page === totalPages ? 'text-zinc-300 border-zinc-100 cursor-not-allowed' : 'text-zinc-500 hover:bg-zinc-50'}`}
              >
                NEXT
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
