'use client'

import React, { useState } from 'react'
import { Image as ImageIcon, X, Plus } from 'lucide-react'
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct } from '@/hooks/use-products'
import { useCategories } from '@/hooks/use-categories'
import { TableSkeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
import type { Product } from '@/types'

const WORK_TYPES_OPTIONS = ['ZARDOZI', 'AARI', 'HANDLOOM', 'SEQUIN', 'BESPOKE', 'GOTA PATTI', 'EMBROIDERY', 'CHIKANKARI', 'MUKAISH']

export default function ProductsPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading, error, refetch } = useProducts({ page, limit: 6 })
  const { data: categories = [] } = useCategories()
  const createProductMutation = useCreateProduct()
  const updateProductMutation = useUpdateProduct()
  const deleteProductMutation = useDeleteProduct()

  const products = data?.products ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / 6)
  const itemsPerPage = 6

  // Drawer Form state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  // Input fields
  const [formName, setFormName] = useState('')
  const [formCategoryId, setFormCategoryId] = useState<string>('')
  const [formPrice, setFormPrice] = useState('')
  const [formStatus, setFormStatus] = useState<'PUBLISHED' | 'DRAFT'>('PUBLISHED')
  const [formWorkTypes, setFormWorkTypes] = useState<string[]>([])
  const [workInput, setWorkInput] = useState('')
  const [formImageUrl, setFormImageUrl] = useState('')

  if (isLoading) return <TableSkeleton rows={6} />
  if (error) return <ErrorState message={error.message} onRetry={refetch} />
  if (products.length === 0) return <EmptyState message="No products yet." />

  // Render thumbnail image from product data
  const renderThumbnail = (product: Product) => {
    if (product.image_url) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.image_url}
          alt={product.name}
          className="w-[45px] h-[45px] object-cover border border-[#E8E0D5]"
        />
      )
    }
    return (
      <div className="w-[45px] h-[45px] bg-[#F5F5F5] border border-zinc-200 flex items-center justify-center text-zinc-400">
        <ImageIcon className="w-4 h-4 stroke-[1.5]" />
      </div>
    )
  }

  // Open drawer to ADD a new product
  const handleOpenAdd = () => {
    setEditingProduct(null)
    setFormName('')
    setFormCategoryId(categories[0]?.id ?? '')
    setFormPrice('')
    setFormStatus('PUBLISHED')
    setFormWorkTypes([])
    setWorkInput('')
    setFormImageUrl('')
    setIsDrawerOpen(true)
  }

  // Open drawer to EDIT an existing product
  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product)
    setFormName(product.name)
    setFormCategoryId(product.category_id ?? '')
    setFormPrice(product.price.toString())
    setFormStatus(product.status)
    setFormWorkTypes(product.work_types ?? [])
    setWorkInput('')
    setFormImageUrl(product.image_url ?? '')
    setIsDrawerOpen(true)
  }

  // DELETE a product (placeholder - delete functionality not yet exposed in UI)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDeleteProduct = async (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteProductMutation.mutateAsync(id)
      } catch {
        alert('Failed to delete product')
      }
    }
  }

  // SAVE product (Add or Edit)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName || !formPrice || !formCategoryId) return

    const priceNum = parseInt(formPrice, 10)

    try {
      if (editingProduct) {
        // Update in database
        await updateProductMutation.mutateAsync({
          id: editingProduct.id,
          updates: {
            name: formName,
            category_id: formCategoryId,
            price: priceNum,
            status: formStatus,
            work_types: formWorkTypes,
            image_url: formImageUrl
          }
        })
      } else {
        // Add new to database
        await createProductMutation.mutateAsync({
          name: formName,
          category_id: formCategoryId,
          price: priceNum,
          status: formStatus,
          work_types: formWorkTypes,
          image_url: formImageUrl
        })
      }
      setIsDrawerOpen(false)
    } catch {
      alert('Failed to save product')
    }
  }

  // Work Types Tag Handlers
  const addWorkTag = () => {
    const trimmed = workInput.trim().toUpperCase();
    if (trimmed && !formWorkTypes.includes(trimmed)) {
      setFormWorkTypes([...formWorkTypes, trimmed]);
      setWorkInput('');
    }
  };

  const removeWorkTag = (tagToRemove: string) => {
    setFormWorkTypes(formWorkTypes.filter((t) => t !== tagToRemove));
  };

  return (
    <div className="space-y-6 px-8 pt-10 font-inter relative animate-fade-in">

      {/* Loading overlay for mutations */}
      {(createProductMutation.isPending || updateProductMutation.isPending || deleteProductMutation.isPending) && (
        <div className="fixed inset-0 bg-white/50 z-50 flex items-center justify-center">
          <div className="text-zinc-500 font-medium text-xs">Saving updates...</div>
        </div>
      )}

      {/* 1. Header Page Section */}
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold tracking-wider text-zinc-800 uppercase font-sans">
          Products
        </h3>
        
        <button
          onClick={handleOpenAdd}
          className="bg-[#B38B5D] hover:bg-[#A37B4D] text-white text-[10px] font-bold tracking-widest px-6 py-3.5 transition-colors duration-200 rounded-none uppercase cursor-pointer flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          ADD PRODUCT
        </Link>
      </div>

      {/* 2. Product Listing Table Container */}
      <div className="bg-white border border-[#E8E0D5] shadow-xs">
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAF8F5] border-b border-[#E8E0D5]">
                <th className="px-6 py-2.5  text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[10%]">
                  IMAGE
                </th>
                <th className="px-6 py-2.5  text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[25%]">
                  PRODUCT NAME
                </th>
                <th className="px-6 py-2.5  text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[15%]">
                  CATEGORY
                </th>
                <th className="px-6 py-2.5  text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[15%]">
                  PRICE
                </th>
                <th className="px-6 py-2.5  text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[18%]">
                  WORK TYPES
                </th>
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[10%]">
                  STATUS
                </th>
                <th className="px-6 py-2.5  text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[7%] text-right">
                  ACTIONS
                </th>
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

                  const categoryName = categories.find(c => c.id === product.category_id)?.name ?? 'Unknown'

                  return (
                    <tr key={product.id} className="hover:bg-[#FAF8F5]/40 transition-colors">
                      <td className="px-6 py-3">
                        {renderThumbnail(product)}
                      </td>
                      <td className="px-6 py-3 text-[12px] font-medium text-zinc-800">
                        {product.name}
                      </td>
                      <td className="px-6 py-3 text-[12px] text-zinc-700 font-medium">
                        {categoryName}
                      </td>
                      <td className="px-6 py-3 text-[12px] font-medium text-zinc-900 font-sans">
                        {formattedPrice.replace('INR', '₹')}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(product.work_types ?? []).map((wt) => (
                            <span
                              key={wt}
                              className="border-2 border-gray-600 bg-white text-[7.5px] font-bold tracking-wider text-zinc-500 px-2 py-0.5"
                            >
                              {wt}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4.5">
                        <span
                          className={`inline-block px-2.5 py-0.5 text-[7.5px] font-bold tracking-widest rounded-none uppercase ${
                            product.status === 'PUBLISHED'
                              ? 'bg-[#E8F5E9] text-[#2E7D32]'
                              : 'bg-[#EEEEEE] text-[#616161]'
                          }`}
                        >
                          {product.status}
                        </span>
                      </td>
                      <td className="px-6 py-4.5 text-right space-x-3 text-[10px] font-bold tracking-widest">
                        <button
                          onClick={() => handleOpenEdit(product)}
                          className="text-[#B38B5D] hover:text-[#A37B4D] uppercase transition-colors"
                        >
                          EDIT
                        </button>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[12px] text-zinc-400 font-medium">
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 3. Table Footer Pagination matching screenshots */}
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


          <div className="relative w-full max-w-[480px] bg-white h-full shadow-2xl flex flex-col justify-between py-10 px-8 animate-slide-in border-l border-[#E8E0D5]">
            
            <div>
              <div className="flex items-center justify-between border-b border-[#E8E0D5] pb-5">
                <h4 className="font-serif text-[22px] text-[#B38B5D] font-medium tracking-wide">
                  {editingProduct ? 'Edit Bridal Couture' : 'Add Couture Piece'}
                </h4>
                <button 
                  onClick={() => setIsDrawerOpen(false)}
                  className="text-zinc-400 hover:text-zinc-700 transition-colors p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProduct} id="drawer-form" className="mt-8 space-y-6">
                
                {/* Product Name */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
                    Product Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Maharani Zardozi Lehenga"
                    className="w-full border-b border-[#E8E0D5] py-2 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
                  />
                </div>

                {/* Category & Price */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
                      Category
                    </label>
                    <select
                      value={formCategoryId}
                      onChange={(e) => setFormCategoryId(e.target.value)}
                      className="w-full border-b border-[#E8E0D5] py-2 text-[13px] text-zinc-700 bg-white focus:outline-hidden focus:border-[#B38B5D] transition-colors"
                    >
                      <option value="">Select a category</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
                      Price (INR ₹)
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      placeholder="e.g. 185000"
                      className="w-full border-b border-[#E8E0D5] py-2 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors font-sans"
                    />
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
                    Status
                  </label>
                  <div className="flex gap-4 pt-2">
                    <label className="flex items-center gap-2 text-[12px] text-zinc-700 cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        checked={formStatus === 'PUBLISHED'}
                        onChange={() => setFormStatus('PUBLISHED')}
                        className="text-[#B38B5D]"
                      />
                      <span>PUBLISHED</span>
                    </label>
                    <label className="flex items-center gap-2 text-[12px] text-zinc-700 cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        checked={formStatus === 'DRAFT'}
                        onChange={() => setFormStatus('DRAFT')}
                        className="text-[#B38B5D]"
                      />
                      <span>DRAFT</span>
                    </label>
                  </div>
                </div>

                {/* Work Types Tag Selection */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
                    Work Types (Embroidery, Fabrics)
                  </label>
                  
                  <div className="flex gap-2">
                    <input
                      type="text"
                      list="work-options"
                      value={workInput}
                      onChange={(e) => setWorkInput(e.target.value)}
                      placeholder="Add tag (e.g. ZARDOZI)"
                      className="flex-1 border-b border-[#E8E0D5] py-2 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addWorkTag();
                        }
                      }}
                    />
                    <datalist id="work-options">
                      {WORK_TYPES_OPTIONS.map((o) => (
                        <option key={o} value={o} />
                      ))}
                    </datalist>
                    <button
                      type="button"
                      onClick={addWorkTag}
                      className="border border-[#B38B5D] text-[#B38B5D] hover:bg-[#FAF6F0] px-3 py-1 text-[11px] font-bold uppercase transition-colors"
                    >
                      Add
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-3">
                    {formWorkTypes.map((t) => (
                      <span 
                        key={t} 
                        className="inline-flex items-center gap-1 border border-[#E8E0D5] bg-[#FAF8F5] text-[9px] font-bold text-zinc-600 px-2.5 py-1 uppercase"
                      >
                        {t}
                        <button
                          type="button"
                          onClick={() => removeWorkTag(t)}
                          className="hover:text-red-600 font-bold p-0.5 ml-1"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>

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
                {editingProduct ? 'Save Changes' : 'Publish Product'}
              </button>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}