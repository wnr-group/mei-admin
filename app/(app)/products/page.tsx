'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchProducts, addProduct, updateProduct, deleteProduct, Product } from '@/lib/mockDb';
import { Image as ImageIcon, X, Plus } from 'lucide-react';

const CATEGORIES = ['Bridal Lehengas', 'Sarees', 'Evening Gowns', 'Couture', 'Suits'];
const WORK_TYPES_OPTIONS = ['ZARDOZI', 'AARI', 'HANDLOOM', 'SEQUIN', 'BESPOKE', 'GOTA PATTI', 'EMBROIDERY', 'CHIKANKARI', 'MUKAISH'];

export default function ProductsPage() {
  const [mounted, setMounted] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Drawer Form state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // Input fields
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState(CATEGORIES[0]);
  const [formPrice, setFormPrice] = useState('');
  const [formStatus, setFormStatus] = useState<'PUBLISHED' | 'DRAFT'>('PUBLISHED');
  const [formWorkTypes, setFormWorkTypes] = useState<string[]>([]);
  const [workInput, setWorkInput] = useState('');

  // Load products on mount
  useEffect(() => {
    async function loadData() {
      const data = await fetchProducts();
      setProducts(data);
      setMounted(true);
    }
    loadData();
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <span className="font-serif text-lg text-[#B38B5D] tracking-widest uppercase">MEI BRIDAL COUTURE</span>
          <span className="text-xs text-zinc-400">Loading Products...</span>
        </div>
      </div>
    );
  }

  // Pagination calculations (Directly on the products array, no filters)
  const totalEntries = products.length;
  const totalPages = Math.ceil(totalEntries / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalEntries);
  const currentProducts = products.slice(startIndex, endIndex);

  // Render thumbnail image from our saree mock database
  const renderThumbnail = (product: Product) => {
    if (product.image) {
      return (
        <img 
          src={product.image} 
          alt={product.name} 
          className="w-[45px] h-[45px] object-cover border border-[#E8E0D5]" 
        />
      );
    }
    return (
      <div className="w-[45px] h-[45px] bg-[#F5F5F5] border border-zinc-200 flex items-center justify-center text-zinc-400">
        <ImageIcon className="w-4 h-4 stroke-[1.5]" />
      </div>
    );
  };

  // Open drawer to ADD a new product
  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormName('');
    setFormCategory(CATEGORIES[0]);
    setFormPrice('');
    setFormStatus('PUBLISHED');
    setFormWorkTypes([]);
    setWorkInput('');
    setIsDrawerOpen(true);
  };

  // Open drawer to EDIT an existing product
  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setFormName(product.name);
    setFormCategory(product.category);
    setFormPrice(product.price.toString());
    setFormStatus(product.status);
    setFormWorkTypes(product.workTypes);
    setWorkInput('');
    setIsDrawerOpen(true);
  };

  // DELETE a product
  const handleDeleteProduct = async (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      setIsLoading(true);
      await deleteProduct(id);
      
      const data = await fetchProducts();
      setProducts(data);
      setIsLoading(false);
      
      if ((currentPage - 1) * itemsPerPage >= data.length && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      }
    }
  };

  // SAVE product (Add or Edit)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formPrice) return;

    setIsLoading(true);
    const priceNum = parseInt(formPrice, 10);

    if (editingProduct) {
      // Update in database
      await updateProduct({
        id: editingProduct.id,
        name: formName,
        category: formCategory,
        price: priceNum,
        status: formStatus,
        workTypes: formWorkTypes,
        image: editingProduct.image // Keep existing image
      });
    } else {
      // Add new to database (Assign a random sample image from Unsplash for visual consistency)
      const randomImageId = Math.floor(Math.random() * 3) + 1;
      const sampleImages = [
        'https://images.unsplash.com/photo-1610030469983-98e550d6193c?q=80&w=150&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=150&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1610030469668-93535c17b6b3?q=80&w=150&auto=format&fit=crop'
      ];
      await addProduct({
        name: formName,
        category: formCategory,
        price: priceNum,
        status: formStatus,
        workTypes: formWorkTypes,
        image: sampleImages[randomImageId - 1]
      });
    }

    const data = await fetchProducts();
    setProducts(data);
    setIsDrawerOpen(false);
    setIsLoading(false);
  };

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
    <div className="space-y-6 px-8 pt-10  font-inter relative animate-fade-in">
      
      {/* Loading overlay for database queries */}
      {isLoading && (
        <div className="fixed inset-0 bg-white/50 z-50 flex items-center justify-center">
          <div className="text-zinc-500 font-medium text-xs">Saving updates...</div>
        </div>
      )}

      {/* 1. Header Page Section */}
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
              {currentProducts.length > 0 ? (
                currentProducts.map((product) => {
                  const formattedPrice = new Intl.NumberFormat('en-IN', {
                    style: 'currency',
                    currency: 'INR',
                    maximumFractionDigits: 0
                  }).format(product.price);

                  return (
                    <tr key={product.id} className="hover:bg-[#FAF8F5]/40 transition-colors">
                      <td className="px-6 py-3">
                        {renderThumbnail(product)}
                      </td>
                      <td className="px-6 py-3 text-[12px] font-medium text-zinc-800">
                        {product.name}
                      </td>
                      <td className="px-6 py-3 text-[12px] text-zinc-700 font-medium">
                        {product.category}
                      </td>
                      <td className="px-6 py-3 text-[12px] font-medium text-zinc-900 font-sans">
                        {formattedPrice.replace('INR', '₹')}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex flex-wrap gap-1">
                          {product.workTypes.map((wt) => (
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
                          //onClick={() => handleOpenEdit(product)}
                          className="text-[#B38B5D] hover:text-[#A37B4D] uppercase transition-colors"
                        >
                          EDIT
                        </button>
                       
                      </td>
                    </tr>
                  );
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
            Showing {totalEntries === 0 ? 0 : startIndex + 1} to {endIndex} of {totalEntries} entries
          </span>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
                className={`border border-[#E8E0D5] bg-white px-3.5 py-1.5 text-[9px] font-bold tracking-wider uppercase transition-colors duration-150 ${
                  currentPage === 1 
                    ? 'text-zinc-300 border-zinc-100 cursor-not-allowed' 
                    : 'text-zinc-500 hover:bg-zinc-50'
                }`}
              >
                PREV
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className={`px-3 py-1.5 text-[9px] font-bold transition-all duration-150 ${
                    currentPage === p
                      ? 'bg-[#B38B5D] text-white'
                      : 'border border-[#E8E0D5] bg-white text-zinc-500 hover:bg-zinc-50'
                  }`}
                >
                  {p}
                </button>
              ))}

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
                className={`border border-[#E8E0D5] bg-white px-3.5 py-1.5 text-[9px] font-bold tracking-wider uppercase transition-colors duration-150 ${
                  currentPage === totalPages 
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

      {/* 4. Slide-over Form Drawer */}
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
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full border-b border-[#E8E0D5] py-2 text-[13px] text-zinc-700 bg-white focus:outline-hidden focus:border-[#B38B5D] transition-colors"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
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