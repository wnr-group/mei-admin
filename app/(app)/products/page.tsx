'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchProducts, Product } from '@/lib/mockDb';
import { Image as ImageIcon, Plus } from 'lucide-react';

export default function ProductsPage() {
  const [mounted, setMounted] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

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


  return (
    <div className="space-y-6 px-8 pt-10  font-inter relative animate-fade-in">
      


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
                        <Link
                          href={`/products/edit/${product.id}`}
                          className="text-[#B38B5D] hover:text-[#A37B4D] uppercase transition-colors"
                        >
                          EDIT
                        </Link>
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



    </div>
  );
}