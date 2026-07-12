'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, Plus, X, Loader2, GripVertical } from 'lucide-react'

interface Product {
  id: string
  name: string
  image_url: string | null
}

interface CategoryLink {
  product_id: string
  manually_included: boolean
  manually_excluded: boolean
  source: 'manual' | 'rule'
}

function ProductImage({ src, alt }: { src: string | null; alt: string }) {
  const [error, setError] = useState(false)
  if (!src || error) {
    return (
      <div className="w-10 h-10 border border-[#E8E0D5] overflow-hidden flex items-center justify-center bg-zinc-50 select-none shrink-0">
        <span className="text-[9px] font-bold text-zinc-300 uppercase tracking-widest">
          {alt.slice(0, 2)}
        </span>
      </div>
    )
  }
  return (
    <div className="w-10 h-10 border border-[#E8E0D5] overflow-hidden flex items-center justify-center bg-zinc-50 select-none shrink-0">
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
        onError={() => setError(true)}
      />
    </div>
  )
}

interface CategoryProductsProps {
  categoryId: string
}

export default function CategoryProducts({ categoryId }: CategoryProductsProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [links, setLinks] = useState<CategoryLink[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isDragOverCollection, setIsDragOverCollection] = useState(false)
  const [isDragOverAll, setIsDragOverAll] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        // 1. Fetch all products
        const { data: allProducts, error: prodErr } = await supabase
          .from('products')
          .select('id, name, image_url')
          .is('deleted_at', null)
          .order('name', { ascending: true })

        if (prodErr) throw prodErr

        // 2. Fetch category mappings
        const { data: categoryLinks, error: linkErr } = await supabase
          .from('product_categories')
          .select('product_id, manually_included, manually_excluded, source')
          .eq('category_id', categoryId)

        if (linkErr) throw linkErr

        setProducts(allProducts ?? [])
        setLinks((categoryLinks as CategoryLink[] | null) ?? [])
      } catch (err) {
        console.error('Error loading category products:', err)
        alert('Failed to load category products')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [categoryId])

  // Helper to determine if a product is in the collection
  const isLinked = (productId: string) => {
    const productLinks = links.filter((l) => l.product_id === productId)
    if (productLinks.length === 0) return false
    // It is in the collection if there is at least one row where manually_excluded is false
    return productLinks.some((l) => !l.manually_excluded)
  }

  // Filter products
  const inCollection = products.filter((p) => isLinked(p.id))
  const notInCollection = products.filter((p) => !isLinked(p.id))

  // Filter notInCollection by search box
  const filteredNotInCollection = notInCollection.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleAdd = async (productId: string) => {
    // Optimistic update
    const previousLinks = [...links]
    
    // Remove any existing manual link rows for this product, and add the new manually_included one
    const filtered = links.filter(
      (l) => !(l.product_id === productId && l.source === 'manual')
    )
    setLinks([
      ...filtered,
      {
        product_id: productId,
        manually_included: true,
        manually_excluded: false,
        source: 'manual',
      },
    ])

    try {
      const { error } = await (supabase
        .from('product_categories') as any)
        .upsert(
          {
            product_id: productId,
            category_id: categoryId,
            source: 'manual',
            manually_included: true,
            manually_excluded: false,
          },
          { onConflict: 'product_id, category_id, source' }
        )
      if (error) throw error
    } catch (err) {
      console.error('Error adding product to collection:', err)
      alert('Failed to add product to collection')
      setLinks(previousLinks)
    }
  }

  const handleRemove = async (productId: string) => {
    // Optimistic update
    const previousLinks = [...links]

    // Set manually_excluded = true on 'manual' link and drop any other links (like rule) from state
    const filtered = links.filter((l) => l.product_id !== productId)
    setLinks([
      ...filtered,
      {
        product_id: productId,
        manually_included: false,
        manually_excluded: true,
        source: 'manual',
      },
    ])

    try {
      // 1. Set manually_excluded = true on the 'manual' row
      const { error: upsertErr } = await (supabase
        .from('product_categories') as any)
        .upsert(
          {
            product_id: productId,
            category_id: categoryId,
            source: 'manual',
            manually_included: false,
            manually_excluded: true,
          },
          { onConflict: 'product_id, category_id, source' }
        )
      if (upsertErr) throw upsertErr

      // 2. Delete the 'rule' row if it exists
      const { error: deleteErr } = await (supabase
        .from('product_categories') as any)
        .delete()
        .eq('product_id', productId)
        .eq('category_id', categoryId)
        .eq('source', 'rule')
      if (deleteErr) throw deleteErr
    } catch (err) {
      console.error('Error removing product from collection:', err)
      alert('Failed to remove product from collection')
      setLinks(previousLinks)
    }
  }

  // HTML5 Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, productId: string, sourceCol: string) => {
    e.dataTransfer.setData('text/plain', productId)
    e.dataTransfer.setData('source-column', sourceCol)
  }

  const handleDrop = async (e: React.DragEvent, targetCol: string) => {
    e.preventDefault()
    setIsDragOverCollection(false)
    setIsDragOverAll(false)

    const productId = e.dataTransfer.getData('text/plain')
    const sourceCol = e.dataTransfer.getData('source-column')

    if (!productId || sourceCol === targetCol) return

    if (targetCol === 'collection') {
      await handleAdd(productId)
    } else {
      await handleRemove(productId)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#B38B5D]" />
        <span className="text-xs text-zinc-400 font-medium ml-2 uppercase tracking-wider">Loading products...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left Column: In this collection */}
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragOverCollection(true)
          }}
          onDragLeave={() => setIsDragOverCollection(false)}
          onDrop={(e) => handleDrop(e, 'collection')}
          className={`border border-[#E8E0D5] p-5 bg-[#FAF8F5]/30 min-h-[400px] flex flex-col transition-colors duration-200 ${
            isDragOverCollection ? 'border-[#B38B5D] bg-[#FAF8F5]' : ''
          }`}
        >
          <div className="mb-4 space-y-1">
            <h4 className="text-[10px] font-bold tracking-widest text-zinc-900 uppercase">
              In this collection ({inCollection.length})
            </h4>
            <p className="text-[10px] text-zinc-400 italic font-light">
              Drag products here or use Add button to include them.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[500px] pr-1 space-y-2">
            {inCollection.length > 0 ? (
              inCollection.map((p) => {
                // Determine if this is currently matched via rule vs manual inclusion
                const itemLinks = links.filter((l) => l.product_id === p.id)
                const isManual = itemLinks.some((l) => l.source === 'manual' && l.manually_included)
                const isRule = itemLinks.some((l) => l.source === 'rule')
                
                return (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, p.id, 'collection')}
                    className="flex items-center justify-between p-3.5 bg-white border border-[#E8E0D5] hover:border-[#B38B5D] transition-colors cursor-grab active:cursor-grabbing group shadow-xs gap-3 min-w-0"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="text-zinc-300 group-hover:text-zinc-400 transition-colors shrink-0">
                        <GripVertical size={14} className="stroke-[1.5]" />
                      </div>
                      <ProductImage src={p.image_url} alt={p.name} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-zinc-800 tracking-wide break-words">{p.name}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1 select-none">
                          {isRule && (
                            <span className="text-[8px] font-bold tracking-widest text-[#B38B5D] bg-[#B38B5D]/5 px-1.5 py-0.5 uppercase border border-[#B38B5D]/10">
                              Rule Match
                            </span>
                          )}
                          {isManual && (
                            <span className="text-[8px] font-bold tracking-widest text-zinc-500 bg-zinc-50 px-1.5 py-0.5 uppercase border border-zinc-100">
                              Manually Added
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 ml-1">
                      <button
                        type="button"
                        onClick={() => handleRemove(p.id)}
                        className="text-[9px] font-bold tracking-widest text-red-600 hover:text-red-700 bg-red-50/50 hover:bg-red-50 border border-red-200 hover:border-red-300 px-3 py-1.5 transition-all duration-150 cursor-pointer flex items-center gap-1 select-none whitespace-nowrap uppercase"
                      >
                        <X size={10} className="stroke-[2.5]" />
                        Remove
                      </button>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] border border-dashed border-[#E8E0D5] text-center p-6 bg-white select-none">
                <p className="text-xs text-zinc-400 font-medium">No products in this collection</p>
                <p className="text-[10px] text-zinc-300 mt-1 italic font-light">Add or drag products here to populate the collection.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: All products */}
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragOverAll(true)
          }}
          onDragLeave={() => setIsDragOverAll(false)}
          onDrop={(e) => handleDrop(e, 'all')}
          className={`border border-[#E8E0D5] p-5 bg-[#FAF8F5]/30 min-h-[400px] flex flex-col transition-colors duration-200 ${
            isDragOverAll ? 'border-[#B38B5D] bg-[#FAF8F5]' : ''
          }`}
        >
          <div className="mb-4 space-y-3">
            <div className="space-y-1">
              <h4 className="text-[10px] font-bold tracking-widest text-zinc-900 uppercase">
                All Products ({notInCollection.length})
              </h4>
              <p className="text-[10px] text-zinc-400 italic font-light">
                Drag products to the left or use Add button.
              </p>
            </div>

            {/* Search Box */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-400">
                <Search size={12} />
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products by name..."
                className="w-full border border-[#E8E0D5] pl-8 pr-3 py-2 text-[12px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] bg-white transition-colors"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[500px] pr-1 space-y-2">
            {filteredNotInCollection.length > 0 ? (
              filteredNotInCollection.map((p) => {
                // Determine if this has a manual exclusion flag set
                const isExcluded = links.some((l) => l.product_id === p.id && l.source === 'manual' && l.manually_excluded)
                
                return (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, p.id, 'all')}
                    className="flex items-center justify-between p-3.5 bg-white border border-[#E8E0D5] hover:border-[#B38B5D] transition-colors cursor-grab active:cursor-grabbing group shadow-xs gap-3 min-w-0"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="text-zinc-300 group-hover:text-zinc-400 transition-colors shrink-0">
                        <GripVertical size={14} className="stroke-[1.5]" />
                      </div>
                      <ProductImage src={p.image_url} alt={p.name} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-zinc-800 tracking-wide break-words">{p.name}</p>
                        {isExcluded && (
                          <div className="flex gap-2.5 mt-1 select-none">
                            <span className="text-[8px] font-bold tracking-widest text-red-500 bg-red-50 px-1.5 py-0.5 uppercase border border-red-100">
                              Manually Excluded
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 ml-1">
                      <button
                        type="button"
                        onClick={() => handleAdd(p.id)}
                        className="text-[9px] font-bold tracking-widest text-[#B38B5D] hover:text-[#9A7347] bg-[#B38B5D]/5 hover:bg-[#B38B5D]/10 border border-[#B38B5D]/20 hover:border-[#B38B5D]/30 px-3 py-1.5 transition-all duration-150 cursor-pointer flex items-center gap-1 select-none whitespace-nowrap uppercase"
                      >
                        <Plus size={10} className="stroke-[2.5]" />
                        Add
                      </button>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] border border-dashed border-[#E8E0D5] text-center p-6 bg-white select-none">
                <p className="text-xs text-zinc-400 font-medium">
                  {search ? 'No products match search' : 'No remaining products'}
                </p>
                <p className="text-[10px] text-zinc-300 mt-1 italic font-light">
                  {search ? 'Try adjusting your search query' : 'All products in the store are currently in this collection'}
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
