'use client';

import React, { useState, useEffect } from 'react';
import { fetchCategories, Category } from '@/lib/mockDb';
import { Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    async function loadData() {
      const data = await fetchCategories();
      setCategories(data);
      setMounted(true);
    }
    loadData();
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <span className="font-serif text-lg text-[#B38B5D] tracking-widest uppercase">MEI BRIDAL COUTURE</span>
          <span className="text-xs text-zinc-400">Loading Categories...</span>
        </div>
      </div>
    );
  }

  // Render category thumbnail image
  const renderThumbnail = (category: Category) => {
    if (category.image) {
      return (
        <img 
          src={category.image} 
          alt={category.name} 
          className="w-[35px] h-[35px] object-cover border border-[#E8E0D5]" 
        />
      );
    }
    return (
      <div className="w-[35px] h-[35px] bg-[#F5F5F5] border border-[#E8E0D5] flex items-center justify-center text-zinc-400">
        <ImageIcon className="w-4 h-4 stroke-[1.5]" />
      </div>
    );
  };

  return (
    <div className="space-y-6 px-8 pt-10 font-inter relative animate-fade-in">
      
      {/* 1. Page Header Section matching screenshot exactly */}
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-[22px] text-[#B38B5D] font-medium tracking-wide">
          Categories
        </h3>
        
        <Link href="/categories/add">
          <button
            className="bg-[#B38B5D] hover:bg-[#A37B4D] text-white text-[10px] font-bold tracking-widest px-6 py-3.5 transition-colors duration-200 rounded-none uppercase cursor-pointer"
          >
            ADD CATEGORY
          </button>
        </Link>
      </div>

      {/* 2. Categories Listing Table Container */}
      <div className="bg-white border border-[#E8E0D5] shadow-xs">
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAF8F5] border-b border-[#E8E0D5]">
                <th className="px-6 py-3 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[30%]">
                  CATEGORY NAME
                </th>
                <th className="px-6 py-3 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[25%]">
                  SUBTITLE
                </th>
                <th className="px-6 py-3 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[20%]">
                  SLUG
                </th>
                <th className="px-6 py-3 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[10%] text-center">
                  SORT
                </th>
                <th className="px-6 py-3 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[10%] text-center">
                  STATUS
                </th>
                <th className="px-6 py-3 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[5%] text-right">
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E0D5]">
              {categories.length > 0 ? (
                categories.map((category) => (
                  <tr key={category.id} className="hover:bg-[#FAF8F5]/40 transition-colors">
                    {/* Category Name & Image */}
                    <td className="px-6 py-4 flex items-center">
                      {renderThumbnail(category)}
                      <span className="ml-3.5 text-[12px] font-bold text-zinc-800">
                        {category.name}
                      </span>
                    </td>
                    
                    {/* Subtitle */}
                    <td className="px-6 py-4 text-[12px] text-zinc-500 font-medium">
                      {category.subtitle}
                    </td>
                    
                    {/* Slug */}
                    <td className="px-6 py-4 text-[12px] text-zinc-500  font-light lowercase">
                      {category.slug}
                    </td>
                    
                    {/* Sort Order */}
                    <td className="px-6 py-4 text-[12px] font-medium text-zinc-700 text-center font-sans">
                      {category.sortOrder}
                    </td>
                    
                    {/* Status Badge */}
                    <td className="px-6 py-4 text-center">
                      <span className="inline-block px-2.5 py-0.5 text-[7.5px] font-bold tracking-widest rounded-none uppercase bg-[#E8F5E9] text-[#2E7D32]">
                        {category.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    
                    {/* Action Link */}
                    <td className="px-6 py-4 text-right">
                      <button className="text-[#B38B5D] hover:text-[#A37B4D] text-[10px] font-bold tracking-widest uppercase transition-colors cursor-pointer">
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[12px] text-zinc-400 font-medium">
                    No categories found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}
