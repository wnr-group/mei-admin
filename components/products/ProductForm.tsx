'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createProduct, updateProduct, getProductById } from '@/services/products';
import { uploadProductImage } from '@/services/storage';
import { getCategories } from '@/services/categories';
import { Upload, X, ChevronDown, ChevronUp, Loader2, Plus } from 'lucide-react';
import Link from 'next/link';

const CATEGORIES = ['Bridal Lehengas', 'Sarees', 'Evening Gowns', 'Couture', 'Suits'];
const WORK_TYPES = ['Aari', 'Zardozi', 'Mirror', 'Cut', 'Thread', 'Tailoring', 'Kundan'];

interface ProductFormProps {
  editId?: string;
}

export default function ProductForm({ editId }: ProductFormProps) {
  const router = useRouter();

  // Basic Info state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');

  // Pricing state
  const [price, setPrice] = useState('0.00');
  const [compareAtPrice, setCompareAtPrice] = useState('0.00');

  // Category & Attributes state
  const [category, setCategory] = useState('');
  const [selectedWorkTypes, setSelectedWorkTypes] = useState<string[]>(['Zardozi']); // "Zardozi" default

  // SEO state
  const [seoExpanded, setSeoExpanded] = useState(false);
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [metaKeywords, setMetaKeywords] = useState('');

  // Media state
  const [images, setImages] = useState<string[]>([]);
  // Parallel array of original File objects for upload (index-aligned with images[])
  // data: preview strings are kept for <img> display; Files are used for actual upload.
  const [imageFiles, setImageFiles] = useState<(File | null)[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Status & Visibility state
  const [published, setPublished] = useState(false);
  const [featured, setFeatured] = useState(false);
  const [newArrival, setNewArrival] = useState(true);

  const [loading, setLoading] = useState(editId ? true : false);
  const [isSaving, setIsSaving] = useState(false);

  // Load existing product details if editing
  useEffect(() => {
    if (!editId) return;

    async function loadProduct() {
      try {
        const prod = await getProductById(editId!);
        if (prod) {
          setName(prod.name);
          setDescription(prod.description ?? '');
          setPrice(prod.price.toString());
          setPublished(prod.status === 'PUBLISHED');
          setImages(prod.image_url ? [prod.image_url] : []);
          setImageFiles(prod.image_url ? [null] : []);

          // Populate slug and short_description from DB
          setSlug(prod.slug ?? '');
          setShortDescription(prod.short_description ?? '');

          // Normalize DB-uppercase work types (e.g. 'AARI') → display-case ('Aari')
          // so the UI badge buttons reflect the saved selection.
          const normalizedWorkTypes = (prod.work_types ?? []).map(
            (wt) => WORK_TYPES.find((w) => w.toUpperCase() === wt) ?? wt
          );
          setSelectedWorkTypes(normalizedWorkTypes);

          // Resolve category_id → name for the existing dropdown
          const { categories } = await getCategories();
          const cat = categories.find((c) => c.id === prod.category_id);
          setCategory(cat?.name ?? '');

          // Fields not stored in DB — clear to defaults
          setCompareAtPrice('0.00');
          setFeatured(false);
          setNewArrival(false);
          setMetaTitle('');
          setMetaDescription('');
          setMetaKeywords('');
        } else {
          alert('Product not found.');
          router.push('/products');
        }
      } catch (err) {
        console.error('Failed to load product details:', err);
      } finally {
        setLoading(false);
      }
    }

    loadProduct();
  }, [editId, router]);

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

  // Toggle work types tag selection
  const handleToggleWorkType = (wt: string) => {
    if (selectedWorkTypes.includes(wt)) {
      setSelectedWorkTypes(selectedWorkTypes.filter((item) => item !== wt));
    } else {
      setSelectedWorkTypes([...selectedWorkTypes, wt]);
    }
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
    if (e.dataTransfer.files) {
      const filesArray = Array.from(e.dataTransfer.files);
      addFiles(filesArray);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      addFiles(filesArray);
    }
  };

  const addFiles = (files: File[]) => {
    const remainingSlots = 10 - images.length;
    const filesToProcess = files.slice(0, remainingSlots);

    filesToProcess.forEach((file) => {
      // Keep the original File for upload; generate a data URL only for preview rendering.
      // Using fetch(data:) on preview strings is blocked by CSP connect-src.
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setImages((prev) => [...prev, reader.result as string]);
          setImageFiles((prev) => [...prev, file]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, idx) => idx !== index));
    setImageFiles(imageFiles.filter((_, idx) => idx !== index));
  };

  const triggerFileInput = () => {
    document.getElementById('image-file-input')?.click();
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Please enter a product name.');
      return;
    }
    if (!category) {
      alert('Please select a category.');
      return;
    }

    setIsSaving(true);

    try {
      // Resolve category name → UUID using existing service
      const { categories } = await getCategories();

      const normalize = (value: string) => value.trim().toLowerCase();

      console.log('Selected category:', category);
      console.log(
        'Available categories:',
        categories.map((c) => ({
          id: c.id,
          name: c.name,
        }))
      );

      const matchedCat = categories.find(
        (c) => normalize(c.name) === normalize(category)
      );
      if (!matchedCat) {
        alert('Category not found. Please refresh and try again.');
        setIsSaving(false);
        return;
      }

      const priceNum = parseFloat(price) || 0;
      const workTypesArr = selectedWorkTypes.map((wt) => wt.toUpperCase());
      const descriptionVal = description.trim() || null;

      if (editId) {
        // ── EDIT FLOW ──────────────────────────────────────────────
        const existingProduct = await getProductById(editId);
        let finalImageUrl: string | null = existingProduct?.image_url ?? null;

        if (images[0]?.startsWith('data:') && imageFiles[0] instanceof File) {
          // New image selected — use the original File directly (no fetch(data:) needed).
          finalImageUrl = await uploadProductImage(imageFiles[0], editId);
        } else if (images[0]?.startsWith('http')) {
          finalImageUrl = images[0];
        } else if (images.length === 0) {
          finalImageUrl = null;
        }

        await updateProduct(editId, {
          name: name.trim(),
          slug: slug.trim() || null,
          short_description: shortDescription.trim() || null,
          category_id: matchedCat.id,
          price: priceNum,
          status: published ? 'PUBLISHED' : 'DRAFT',
          work_types: workTypesArr,
          description: descriptionVal,
          image_url: finalImageUrl,
        });
      } else {
        // ── CREATE FLOW ────────────────────────────────────────────
        const newProduct = await createProduct({
          name: name.trim(),
          slug: slug.trim() || null,
          short_description: shortDescription.trim() || null,
          category_id: matchedCat.id,
          price: priceNum,
          status: published ? 'PUBLISHED' : 'DRAFT',
          work_types: workTypesArr,
          description: descriptionVal,
          image_url: null,
        });

        if (images[0]) {
          let imageUrl: string;
          if (images[0].startsWith('data:') && imageFiles[0] instanceof File) {
            // Use the original File directly — avoids fetch(data:) which CSP blocks.
            imageUrl = await uploadProductImage(imageFiles[0], newProduct.id);
          } else {
            imageUrl = images[0];
          }
          await updateProduct(newProduct.id, { image_url: imageUrl });
        }
      }

      router.push('/products');
    } catch (err) {
      console.error('Failed to save product:', err);
      alert('Error saving product. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <span className="font-serif text-lg text-[#B38B5D] tracking-widest uppercase">MEI BRIDAL COUTURE</span>
          <span className="text-xs text-zinc-400 font-inter">Loading Product Details...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto space-y-6 pb-16 font-inter animate-fade-in px-4">
      {/* Breadcrumbs matching screen layout */}
      <div className="flex items-center text-[10px] tracking-widest uppercase text-zinc-400 font-bold select-none">
        <Link href="/products" className="hover:text-zinc-600 transition-colors">
          Products
        </Link>
        <span className="mx-2 text-[#B38B5D] font-bold">/</span>
        <span className="text-zinc-800">{editId ? 'Edit Product' : 'Add Product'}</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Header section with heading */}
        <h1 className="font-serif text-[24px] text-zinc-950 font-normal tracking-wide">
          {editId ? 'Edit Product' : 'Add Product'}
        </h1>

        {/* Main Grid: 2 columns layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Left Column (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Card 1: BASIC INFO */}
            <div className="bg-white border border-[#E8E0D5] p-8 space-y-6">
              <h3 className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
                BASIC INFO
              </h3>
              
              {/* Product Name */}
              <div className="space-y-1 relative">
                <label className="block text-[9px] font-medium tracking-widest text-zinc-600 uppercase">
                  NAME
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={handleNameChange}
                  placeholder="Enter product name"
                  className="w-full border-b border-[#464541] py-2.5 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
                />
              </div>

              {/* Slug */}
              <div className="space-y-1 relative">
                <label className="block text-[9px] font-bold tracking-widest text-zinc-600 uppercase">
                  SLUG
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="auto-generated-slug"
                    className="w-full border-b border-[#464541] py-2.5 pr-24 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors font-sans"
                  />
                  <span className="absolute right-0 bottom-2.5 italic text-[10px] text-zinc-600 select-none">
                    Auto-generated
                  </span>
                </div>
              </div>

              {/* Short Description */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="block text-[9px] font-bold tracking-widest text-zinc-600 uppercase">
                    SHORT DESCRIPTION
                  </label>
                  <span className="text-[9px] text-zinc-600 font-medium font-sans">
                    {shortDescription.length}/300
                  </span>
                </div>
                <textarea
                  maxLength={300}
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  placeholder="Brief summary of the product..."
                  rows={2}
                  className="w-full border-b border-[#464541] py-2.5 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors resize-none"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="block text-[9px] font-bold tracking-widest text-zinc-600 uppercase">
                  DESCRIPTION
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed product description..."
                  rows={4}
                  className="w-full border-b border-[#464541] py-2.5 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors resize-none"
                />
              </div>

            </div>

            {/* Card 2: PRICING */}
            <div className="bg-white border border-[#E8E0D5] p-8 space-y-6">
              <h3 className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
                PRICING
              </h3>
              
              <div className="grid grid-cols-2 gap-8">
                {/* Price */}
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold tracking-widest text-zinc-800 uppercase">
                    PRICE (₹)
                  </label>
                  <input
                    type="text"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full border-b border-[#E8E0D5] py-2.5 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors font-sans"
                  />
                </div>

                {/* Compare At Price */}
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold tracking-widest text-zinc-800 uppercase">
                    COMPARE-AT PRICE (₹)
                  </label>
                  <input
                    type="text"
                    value={compareAtPrice}
                    onChange={(e) => setCompareAtPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full border-b border-[#E8E0D5] py-2.5 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors font-sans"
                  />
                </div>
              </div>
            </div>

            {/* Card 3: CATEGORY & ATTRIBUTES */}
            <div className="bg-white border border-[#E8E0D5] p-8 space-y-6">
              <h3 className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
                CATEGORY & ATTRIBUTES
              </h3>

              {/* Category select dropdown */}
              <div className="space-y-1">
                <label className="block text-[9px] font-bold tracking-widest text-zinc-800 uppercase">
                  CATEGORY
                </label>
                <div className="relative">
                  <select
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full border-b border-[#E8E0D5] py-2.5 pr-8 text-[13px] text-zinc-700 bg-transparent focus:outline-hidden focus:border-[#B38B5D] transition-colors cursor-pointer appearance-none"
                  >
                    <option value="" disabled>Select Category</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-1 bottom-3 flex items-center text-zinc-400">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Work Types Badges Multi-select */}
              <div className="space-y-3">
                <label className="block text-[9px] font-bold tracking-widest text-zinc-800 uppercase">
                  WORK TYPES
                </label>
                <div className="flex flex-wrap gap-2">
                  {WORK_TYPES.map((wt) => {
                    const isSelected = selectedWorkTypes.includes(wt);
                    return (
                      <button
                        type="button"
                        key={wt}
                        onClick={() => handleToggleWorkType(wt)}
                        className={`px-4 py-2 text-[11px] font-medium tracking-wide border transition-all duration-150 rounded-none cursor-pointer ${
                          isSelected
                            ? 'bg-[#C29E75] border-[#C29E75] text-white'
                            : 'bg-white border-[#E8E0D5] text-zinc-600 hover:bg-[#FAF8F5]'
                        }`}
                      >
                        {wt}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Card 4: SEARCH ENGINE OPTIMIZATION (SEO) Collapsible Card */}
            <div className="bg-white border border-[#E8E0D5]">
              <button
                type="button"
                onClick={() => setSeoExpanded(!seoExpanded)}
                className="w-full px-8 py-5 flex items-center justify-between hover:bg-[#FAF8F5]/30 transition-colors cursor-pointer"
              >
                <h3 className="text-[10px] font-bold tracking-widest text-zinc-700 uppercase text-left">
                  SEARCH ENGINE OPTIMIZATION (SEO)
                </h3>
                {seoExpanded ? (
                  <ChevronUp className="w-4 h-4 text-zinc-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-400" />
                )}
              </button>
              
              {seoExpanded && (
                <div className="px-8 pb-8 space-y-6 border-t border-[#FAF8F5]">
                  {/* Meta Title */}
                  <div className="space-y-1 mt-6">
                    <label className="block text-[9px] font-bold tracking-widest text-zinc-800 uppercase">
                      META TITLE
                    </label>
                    <input
                      type="text"
                      value={metaTitle}
                      onChange={(e) => setMetaTitle(e.target.value)}
                      placeholder="Enter meta title"
                      className="w-full border-b border-[#E8E0D5] py-2 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
                    />
                  </div>

                  {/* Meta Description */}
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold tracking-widest text-zinc-800 uppercase">
                      META DESCRIPTION
                    </label>
                    <textarea
                      value={metaDescription}
                      onChange={(e) => setMetaDescription(e.target.value)}
                      placeholder="Enter meta description"
                      rows={2}
                      className="w-full border-b border-[#E8E0D5] py-2 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors resize-none"
                    />
                  </div>

                  {/* Meta Keywords */}
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold tracking-widest text-zinc-800 uppercase">
                      META KEYWORDS
                    </label>
                    <input
                      type="text"
                      value={metaKeywords}
                      onChange={(e) => setMetaKeywords(e.target.value)}
                      placeholder="e.g. bridal lehenga, zardozi lehenga, wedding couture"
                      className="w-full border-b border-[#E8E0D5] py-2 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Cancel & Save Product Buttons */}
            <div className="flex items-center justify-between pt-4">
              <Link
                href="/products"
                className="text-[11px] font-bold tracking-widest text-zinc-500 hover:text-zinc-800 transition-colors uppercase py-2 cursor-pointer select-none"
              >
                Cancel
              </Link>
              
              <button
                type="submit"
                disabled={isSaving}
                className="bg-[#1A1A1A] hover:bg-black text-[#FAF8F5] text-[11px] font-bold tracking-widest px-8 py-3.5 transition-colors duration-200 rounded-none uppercase cursor-pointer flex items-center gap-2"
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {editId ? 'SAVE CHANGES' : 'SAVE PRODUCT'}
              </button>
            </div>

          </div>

          {/* Right Column (1/3 width) */}
          <div className="space-y-6">
            
            {/* Card 5: MEDIA */}
            <div className="bg-white border border-[#E8E0D5] p-8 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
                  MEDIA
                </h3>
                <span className="text-[9px] text-zinc-400 font-medium font-sans">
                  {images.length}/10 images
                </span>
              </div>

              {/* Upload Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={triggerFileInput}
                className={`border border-dashed p-8 text-center cursor-pointer transition-colors duration-200 flex flex-col items-center justify-center min-h-[160px] bg-[#FAF8F5]/30 ${
                  isDragging
                    ? 'border-[#B38B5D] bg-[#FAF8F5]/50'
                    : 'border-[#E8E0D5] hover:border-[#B38B5D] hover:bg-[#FAF8F5]/10'
                }`}
              >
                <input
                  type="file"
                  id="image-file-input"
                  multiple
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                
                <Upload className="w-6 h-6 stroke-[1.5] text-zinc-400 mb-2" />
                <p className="text-[12px] text-zinc-500 font-medium">
                  Click or drag images here
                </p>
              </div>

              {/* Thumbnail Display Grid */}
              <div className="flex flex-wrap gap-3 pt-2">
                {images.map((img, idx) => (
                  <div 
                    key={idx} 
                    className="relative border border-[#E8E0D5] bg-[#E0E0E0] w-[60px] h-[90px] flex items-center justify-center overflow-hidden group"
                  >
                    <img 
                      src={img} 
                      alt={`Preview ${idx + 1}`} 
                      className="w-full h-full object-cover" 
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    
                    {idx === 0 && (
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[7px] font-bold text-center py-0.5 uppercase tracking-wider font-sans">
                        Thumbnail
                      </div>
                    )}
                    
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveImage(idx);
                      }}
                      className="absolute right-0.5 top-0.5 bg-black/60 hover:bg-black text-white rounded-full p-0.5 transition-colors cursor-pointer"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}

                {images.length === 0 && (
                  /* Initial Empty Placeholder Box matching screenshot exactly */
                  <div className="border border-zinc-300 bg-[#E0E0E0] w-[60px] h-[90px] flex flex-col p-1.5 text-left text-zinc-500 select-none overflow-hidden">
                    <span className="text-[9px] font-sans leading-none break-all text-zinc-600 font-medium">
                      Thumbnail
                    </span>
                  </div>
                )}
                
                {/* Gray box with plus icon */}
                {images.length < 10 && (
                  <button
                    type="button"
                    onClick={triggerFileInput}
                    className="border border-zinc-300 bg-[#E0E0E0] w-[60px] h-[90px] hover:border-[#B38B5D] transition-colors flex items-center justify-center text-zinc-400 hover:text-zinc-600 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 stroke-[2]" />
                  </button>
                )}
              </div>
            </div>

            {/* Card 6: VISIBILITY & STATUS */}
            <div className="bg-white border border-[#E8E0D5] p-8 space-y-6">
              <h3 className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
                VISIBILITY & STATUS
              </h3>

              <div className="space-y-4">
                {/* Published Checkbox */}
                <label className="flex items-center gap-3 cursor-pointer group select-none">
                  <input
                    type="checkbox"
                    checked={published}
                    onChange={(e) => setPublished(e.target.checked)}
                    className="w-4 h-4 border border-[#E8E0D5] text-[#B38B5D] focus:ring-[#B38B5D] rounded-none cursor-pointer accent-black"
                  />
                  <span className="text-[12px] font-medium text-zinc-700 group-hover:text-zinc-950 transition-colors select-none">
                    Published
                  </span>
                </label>

                {/* Featured on Homepage Checkbox */}
                <label className="flex items-center gap-3 cursor-pointer group select-none">
                  <input
                    type="checkbox"
                    checked={featured}
                    onChange={(e) => setFeatured(e.target.checked)}
                    className="w-4 h-4 border border-[#E8E0D5] text-[#B38B5D] focus:ring-[#B38B5D] rounded-none cursor-pointer accent-black"
                  />
                  <span className="text-[12px] font-medium text-zinc-700 group-hover:text-zinc-950 transition-colors select-none">
                    Featured on Homepage
                  </span>
                </label>

                {/* New Arrival Checkbox */}
                <label className="flex items-center gap-3 cursor-pointer group select-none">
                  <input
                    type="checkbox"
                    checked={newArrival}
                    onChange={(e) => setNewArrival(e.target.checked)}
                    className="w-4 h-4 border border-[#E8E0D5] text-[#B38B5D] focus:ring-[#B38B5D] rounded-none cursor-pointer accent-black"
                  />
                  <span className="text-[12px] font-medium text-zinc-700 group-hover:text-zinc-950 transition-colors select-none">
                    New Arrival
                  </span>
                </label>
              </div>
            </div>

          </div>

        </div>
      </form>
    </div>
  );
}
