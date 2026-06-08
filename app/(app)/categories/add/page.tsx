'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addCategory } from '@/lib/mockDb';
import { Upload, X, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function AddCategoryPage() {
  const router = useRouter();

  // Form states
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [active, setActive] = useState(true); // Checked by default in screenshot

  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-generate slug from name
  const generateSlug = (val: string) => {
    return val
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // remove non-word characters
      .replace(/[\s_-]+/g, '-') // replace spaces/underscores with hyphens
      .replace(/^-+|-+$/g, ''); // remove leading/trailing hyphens
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    setSlug(generateSlug(val));
  };

  // Drag-and-drop file handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const triggerFileInput = () => {
    document.getElementById('category-image-input')?.click();
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Please enter a category name.');
      return;
    }

    setIsSaving(true);

    try {
      // Provide a nice fallback if they didn't upload any image
      const finalImage = image || 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=150&auto=format&fit=crop';

      await addCategory({
        name: name.trim(),
        slug: slug.trim() || generateSlug(name),
        subtitle: subtitle.trim(),
        description: description.trim(),
        sortOrder: sortOrder,
        status: active ? 'ACTIVE' : 'INACTIVE',
        image: finalImage,
      });

      router.push('/categories');
    } catch (err) {
      console.error('Failed to save category:', err);
      alert('Error saving category. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-[480px] mx-auto pt-6 pb-16 font-inter animate-fade-in">
      {/* Breadcrumbs matching screen layout */}
      <div className="flex items-center text-[10px] tracking-widest uppercase text-zinc-400 font-bold select-none mb-1.5">
        <Link href="/categories" className="hover:text-zinc-600 transition-colors">
          Categories
        </Link>
        <span className="mx-2 text-[#B38B5D] font-bold">/</span>
        <span className="text-zinc-400">Add Category</span>
      </div>

      {/* Header Title */}
      <h1 className="font-serif text-[22px] text-zinc-950 font-medium tracking-wide mb-6">
        Add Category
      </h1>

      {/* Form Container Card */}
      <div className="bg-white border border-[#E8E0D5] p-8 shadow-xs">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Category Name */}
          <div className="space-y-1">
            <label className="block text-[9px] font-bold tracking-widest text-zinc-900 uppercase">
              NAME
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={handleNameChange}
              placeholder="e.g. Bridal Lehengas"
              className="w-full border-b border-[#E8E0D5] py-2 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
            />
          </div>

          {/* Slug */}
          <div className="space-y-1">
            <label className="block text-[9px] font-bold tracking-widest text-zinc-900 uppercase">
              SLUG
            </label>
            <input
              type="text"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="e.g. bridal-lehengas"
              className="w-full border-b border-[#E8E0D5] py-2 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors font-sans"
            />
            <p className="text-[10px] text-zinc-400 mt-1 italic font-light">
              Auto-generated. Editable.
            </p>
          </div>

          {/* Subtitle */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="block text-[9px] font-bold tracking-widest text-zinc-900 uppercase">
                SUBTITLE
              </label>
              <span className="text-[9px] text-zinc-400 font-medium font-sans">
                {subtitle.length}/40
              </span>
            </div>
            <input
              type="text"
              maxLength={40}
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="e.g. Timeless Elegance"
              className="w-full border-b border-[#E8E0D5] py-2 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
            />
            <p className="text-[10px] text-zinc-400 mt-1 italic font-light">
              Shown on the homepage category card, e.g. "Bridal Classics"
            </p>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="block text-[9px] font-bold tracking-widest text-zinc-900 uppercase">
              DESCRIPTION
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter category description..."
              rows={3}
              className="w-full border border-[#E8E0D5] p-3 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors resize-none"
            />
          </div>

          {/* Image */}
          <div className="space-y-2">
            <label className="block text-[9px] font-bold tracking-widest text-zinc-900 uppercase">
              IMAGE
            </label>

            {/* Dropzone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={triggerFileInput}
              className={`border border-dashed p-6 text-center cursor-pointer transition-colors duration-200 flex flex-col items-center justify-center min-h-[110px] ${
                isDragging
                  ? 'border-[#B38B5D] bg-[#FAF8F5]'
                  : 'border-[#E8E0D5] hover:border-[#B38B5D] hover:bg-[#FAF8F5]/10'
              }`}
            >
              <input
                type="file"
                id="category-image-input"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              
              <Upload className="w-5 h-5 stroke-[1.5] text-zinc-400 mb-1" />
              <p className="text-[12px] text-zinc-500 font-medium">
                Upload category Image
              </p>
              <p className="text-[10px] text-zinc-400 font-light">
                or drag and drop
              </p>
            </div>

            {/* Image Preview */}
            {image && (
              <div className="relative border border-[#E8E0D5] w-[70px] h-[70px] flex items-center justify-center overflow-hidden mt-2">
                <img
                  src={image}
                  alt="Uploaded category thumbnail"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImage('');
                  }}
                  className="absolute right-0.5 top-0.5 bg-black/60 hover:bg-black text-white rounded-full p-0.5 transition-colors cursor-pointer"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            )}
          </div>

          {/* Sort Order */}
          <div className="flex items-center gap-4">
            <label className="text-[9px] font-bold tracking-widest text-zinc-900 uppercase">
              SORT ORDER
            </label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
              className="w-[70px] border border-[#E8E0D5] px-3 py-1.5 text-center text-[13px] text-zinc-800 focus:outline-hidden focus:border-[#B38B5D] font-sans"
            />
          </div>

          {/* Active Status Checkbox */}
          <div className="pt-2">
            <label className="flex items-center gap-2.5 cursor-pointer group select-none">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="w-4 h-4 border border-[#E8E0D5] text-[#B38B5D] focus:ring-[#B38B5D] rounded-none cursor-pointer accent-black"
              />
              <span className="text-[12px] font-medium text-zinc-800 group-hover:text-black transition-colors">
                Active (visible on storefront)
              </span>
            </label>
          </div>

          {/* Action Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-[#1A1A1A] hover:bg-black text-[#FAF8F5] text-[11px] font-bold tracking-widest py-3.5 transition-colors duration-200 rounded-none uppercase cursor-pointer flex items-center justify-center gap-2"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              SAVE CATEGORY
            </button>
          </div>

          {/* Cancel */}
          <div className="text-center pt-2">
            <Link
              href="/categories"
              className="text-[11px] font-bold tracking-widest text-zinc-500 hover:text-zinc-800 transition-colors uppercase cursor-pointer"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
