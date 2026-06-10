'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProducts, useCreateProduct, useUpdateProduct } from '@/hooks/use-products';
import { useCategories } from '@/hooks/use-categories';
import type { ProductInsert } from '@/types';
import type { Json } from '@/types/database';
import type { ColorVariant } from '@/types/color-variant';
import { ChevronDown, ChevronUp, Loader2, Plus } from 'lucide-react';
import Link from 'next/link';
import ColorVariantCard from '@/components/products/ColorVariantCard';
import TagInput from '@/components/ui/TagInput';

const WORK_TYPES = ['Aari', 'Zardozi', 'Mirror', 'Cut', 'Thread', 'Tailoring', 'Kundan'];

interface ProductFormProps {
  editId?: string;
}

export default function ProductForm({ editId }: ProductFormProps) {
  const router = useRouter();

  // Hooks
  const { data: categories } = useCategories();
  const { data: productsData } = useProducts();
  const createProduct = useCreateProduct();
  const updateProductMutation = useUpdateProduct();

  // Basic Info state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');

  // Pricing state
  const [price, setPrice] = useState('0.00');
  const [compareAtPrice, setCompareAtPrice] = useState('0.00');

  // Category & Attributes state
  const [category_id, setCategoryId] = useState('');
  const [work_types, setWorkTypes] = useState<string[]>(['Zardozi']);

  // SEO state
  const [seoExpanded, setSeoExpanded] = useState(false);
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [metaKeywords, setMetaKeywords] = useState('');

  // Color Variants state (replaces flat images[])
  const [colorVariants, setColorVariants] = useState<ColorVariant[]>([]);

  // Sizes state
  const [availableSizes, setAvailableSizes] = useState<string[]>([]);
  const [customSizeEnabled, setCustomSizeEnabled] = useState(false);

  // Blouse Options state
  const [blouseOptionsEnabled, setBlouseOptionsEnabled] = useState(false);
  const [blouseTypes, setBlouseTypes] = useState<string[]>([]);

  // Status & Visibility state
  const [published, setPublished] = useState(false);
  const [featured, setFeatured] = useState(false);
  const [newArrival, setNewArrival] = useState(true);

  const [loading, setLoading] = useState(editId ? true : false);
  const [isSaving, setIsSaving] = useState(false);

  // Load existing product details if editing
  useEffect(() => {
    if (!editId || !productsData) return;
    const prod = productsData.products.find((p) => p.id === editId);
    if (prod) {
      setName(prod.name);
      setSlug(prod.slug || '');
      setShortDescription(prod.short_description || '');
      setDescription(prod.description || '');
      setPrice(prod.price.toString());
      setCompareAtPrice(prod.compare_at_price ? prod.compare_at_price.toString() : '0.00');
      setCategoryId(prod.category_id || '');
      setWorkTypes(prod.work_types || []);
      setColorVariants((prod.color_variants as unknown as ColorVariant[]) || []);
      setAvailableSizes(prod.available_sizes || []);
      setCustomSizeEnabled(prod.custom_size_enabled || false);
      setBlouseOptionsEnabled(prod.blouse_options_enabled || false);
      setBlouseTypes(prod.blouse_types || []);
      setPublished(prod.status === 'PUBLISHED');
      setFeatured(prod.featured || false);
      setNewArrival(prod.new_arrival || false);
      setMetaTitle(prod.meta_title || '');
      setMetaDescription(prod.meta_description || '');
      setMetaKeywords(prod.meta_keywords || '');
      setLoading(false);
    } else {
      alert('Product not found.');
      router.push('/products');
    }
  }, [editId, productsData, router]);

  // If not editing, don't show loading
  useEffect(() => {
    if (!editId) setLoading(false);
  }, [editId]);

  // Auto-generate slug from name
  const generateSlug = (val: string) => {
    return val
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    setSlug(generateSlug(val));
  };

  // Toggle work types tag selection
  const handleToggleWorkType = (wt: string) => {
    if (work_types.includes(wt)) {
      setWorkTypes(work_types.filter((item) => item !== wt));
    } else {
      setWorkTypes([...work_types, wt]);
    }
  };

  // Color Variant helpers
  const addColorVariant = () => {
    const newVariant: ColorVariant = {
      id: crypto.randomUUID(),
      colorName: '',
      colorHex: '#C41E3A',
      images: [],
      isDefault: colorVariants.length === 0,
    };
    setColorVariants([...colorVariants, newVariant]);
  };

  const updateColorVariant = (index: number, updated: ColorVariant) => {
    const newVariants = [...colorVariants];
    newVariants[index] = updated;
    setColorVariants(newVariants);
  };

  const removeColorVariant = (index: number) => {
    const newVariants = colorVariants.filter((_, i) => i !== index);
    // If removed was default, make first one default
    if (colorVariants[index].isDefault && newVariants.length > 0) {
      newVariants[0] = { ...newVariants[0], isDefault: true };
    }
    setColorVariants(newVariants);
  };

  const setDefaultVariant = (index: number) => {
    const newVariants = colorVariants.map((v, i) => ({
      ...v,
      isDefault: i === index,
    }));
    setColorVariants(newVariants);
  };

  // Blouse type toggle
  const handleToggleBlouseType = (type: string) => {
    if (blouseTypes.includes(type)) {
      setBlouseTypes(blouseTypes.filter((t) => t !== type));
    } else {
      setBlouseTypes([...blouseTypes, type]);
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Please enter a product name.');
      return;
    }
    if (!category_id) {
      alert('Please select a category.');
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        name: name.trim(),
        slug: slug.trim() || generateSlug(name),
        short_description: shortDescription.trim() || null,
        description: description.trim() || null,
        price: parseFloat(price) || 0,
        compare_at_price: parseFloat(compareAtPrice) || null,
        category_id: category_id || null,
        work_types: work_types,
        color_variants: colorVariants as unknown as Json,
        available_sizes: availableSizes,
        custom_size_enabled: customSizeEnabled,
        blouse_options_enabled: blouseOptionsEnabled,
        blouse_types: blouseOptionsEnabled ? blouseTypes : [],
        status: (published ? 'PUBLISHED' : 'DRAFT') as 'PUBLISHED' | 'DRAFT',
        featured,
        new_arrival: newArrival,
        meta_title: metaTitle.trim() || null,
        meta_description: metaDescription.trim() || null,
        meta_keywords: metaKeywords.trim() || null,
      };

      if (editId) {
        await updateProductMutation.mutateAsync({ id: editId, updates: payload });
      } else {
        await createProduct.mutateAsync(payload as ProductInsert);
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
                    value={category_id}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full border-b border-[#E8E0D5] py-2.5 pr-8 text-[13px] text-zinc-700 bg-transparent focus:outline-hidden focus:border-[#B38B5D] transition-colors cursor-pointer appearance-none"
                  >
                    <option value="" disabled>Select Category</option>
                    {categories?.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
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
                    const isSelected = work_types.includes(wt);
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

            {/* Card 5: COLOR VARIANTS */}
            <div className="bg-white border border-[#E8E0D5] p-8 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
                  COLOR VARIANTS
                </h3>
                <span className="text-[9px] text-zinc-400 font-medium font-sans">
                  {colorVariants.length} variant{colorVariants.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Variant Cards */}
              <div className="space-y-4">
                {colorVariants.map((variant, idx) => (
                  <ColorVariantCard
                    key={variant.id}
                    variant={variant}
                    onChange={(updated) => updateColorVariant(idx, updated)}
                    onRemove={() => removeColorVariant(idx)}
                    onSetDefault={() => setDefaultVariant(idx)}
                  />
                ))}
              </div>

              {/* Add Variant Button */}
              <button
                type="button"
                onClick={addColorVariant}
                className="w-full border border-dashed border-[#E8E0D5] hover:border-[#B38B5D] py-3 flex items-center justify-center gap-2 text-[11px] font-medium text-zinc-500 hover:text-[#B38B5D] transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Color Variant
              </button>
            </div>

            {/* Card 6: SIZES */}
            <div className="bg-white border border-[#E8E0D5] p-8 space-y-6">
              <h3 className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
                SIZES
              </h3>

              <div className="space-y-3">
                <label className="block text-[9px] font-bold tracking-widest text-zinc-800 uppercase">
                  AVAILABLE SIZES
                </label>
                <TagInput
                  tags={availableSizes}
                  onChange={setAvailableSizes}
                  placeholder="Type size and press Enter (e.g. S, M, L, XL)"
                />
              </div>

              {/* Custom Size Checkbox */}
              <label className="flex items-center gap-3 cursor-pointer group select-none">
                <input
                  type="checkbox"
                  checked={customSizeEnabled}
                  onChange={(e) => setCustomSizeEnabled(e.target.checked)}
                  className="w-4 h-4 border border-[#E8E0D5] text-[#B38B5D] focus:ring-[#B38B5D] rounded-none cursor-pointer accent-black"
                />
                <span className="text-[12px] font-medium text-zinc-700 group-hover:text-zinc-950 transition-colors select-none">
                  Enable Custom Size Requests
                </span>
              </label>
            </div>

            {/* Card 7: BLOUSE OPTIONS */}
            <div className="bg-white border border-[#E8E0D5] p-8 space-y-6">
              <h3 className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
                BLOUSE OPTIONS
              </h3>

              {/* Enable Blouse Options */}
              <label className="flex items-center gap-3 cursor-pointer group select-none">
                <input
                  type="checkbox"
                  checked={blouseOptionsEnabled}
                  onChange={(e) => setBlouseOptionsEnabled(e.target.checked)}
                  className="w-4 h-4 border border-[#E8E0D5] text-[#B38B5D] focus:ring-[#B38B5D] rounded-none cursor-pointer accent-black"
                />
                <span className="text-[12px] font-medium text-zinc-700 group-hover:text-zinc-950 transition-colors select-none">
                  Enable Blouse Options
                </span>
              </label>

              {/* Blouse Type Checkboxes */}
              {blouseOptionsEnabled && (
                <div className="space-y-3 pl-1">
                  <label className="block text-[9px] font-bold tracking-widest text-zinc-800 uppercase">
                    BLOUSE TYPES
                  </label>
                  <div className="space-y-2">
                    {['Stitched', 'Unstitched'].map((type) => (
                      <label key={type} className="flex items-center gap-3 cursor-pointer group select-none">
                        <input
                          type="checkbox"
                          checked={blouseTypes.includes(type)}
                          onChange={() => handleToggleBlouseType(type)}
                          className="w-4 h-4 border border-[#E8E0D5] text-[#B38B5D] focus:ring-[#B38B5D] rounded-none cursor-pointer accent-black"
                        />
                        <span className="text-[12px] font-medium text-zinc-700 group-hover:text-zinc-950 transition-colors select-none">
                          {type}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Card 8: VISIBILITY & STATUS */}
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
