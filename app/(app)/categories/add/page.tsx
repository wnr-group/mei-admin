'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  createCategory,
  updateCategory,
  getCategoryById,
  getCategoryBySlug,
  deleteCategory,
} from '@/services/categories';
import { uploadCategoryImage, deleteCategoryImage } from '@/services/storage';
import { Upload, X, Loader2 } from 'lucide-react';
import Link from 'next/link';
import RuleList from '@/components/categories/rules/RuleList';
import { useLibraryTemplates } from '@/lib/hooks/useMeasurementTemplates';
import type { CategoryMatchType } from '@/types';

function CategoryForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [imagePreview, setImagePreview] = useState('');         // blob: URL (new) or https: URL (existing)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);  // original File for upload
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);  // for cleanup on replace
  const [sortOrder, setSortOrder] = useState(0);
  const [active, setActive] = useState(true);
  const [ruleMatchType, setRuleMatchType] = useState<CategoryMatchType>('ALL');
  const [measurementTemplateId, setMeasurementTemplateId] = useState<string>('');
  const { data: templates } = useLibraryTemplates();
  const [loading, setLoading] = useState(editId ? true : false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!editId) return;

    async function loadCategory() {
      try {
        const cat = await getCategoryById(editId!);
        if (cat) {
          setName(cat.name);
          setSlug(cat.slug);
          setSubtitle(cat.subtitle ?? '');
          setDescription(cat.description ?? '');
          setImagePreview(cat.image_url ?? '');
          setOriginalImageUrl(cat.image_url ?? null);
          setSortOrder(cat.sort_order);
          setActive(cat.is_active ?? true);
          setRuleMatchType(cat.rule_match_type ?? 'ALL');
          setMeasurementTemplateId(cat.measurement_template_id ?? '');
        } else {
          alert('Category not found.');
          router.push('/categories');
        }
      } catch {
        alert('Failed to load category. Please try again.');
        router.push('/categories');
      } finally {
        setLoading(false);
      }
    }

    loadCategory();
  }, [editId, router]);

  useEffect(() => {
    return () => {
      if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const generateSlug = (val: string) =>
    val.toLowerCase().trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (!editId) setSlug(generateSlug(val));
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) processFile(e.target.files[0]);
  };

  const processFile = (file: File) => {
    if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    setSelectedFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleClearImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    setImagePreview('');
    setSelectedFile(null);
  };

  const triggerFileInput = () => document.getElementById('category-image-input')?.click();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { alert('Please enter a category name.'); return; }

    setIsSaving(true);

    try {
      const slugVal = slug.trim() || generateSlug(name.trim());

      // Slug uniqueness check — prevent duplicate slugs
      const existingWithSlug = await getCategoryBySlug(slugVal);
      if (existingWithSlug && existingWithSlug.id !== editId) {
        alert(`A category with slug "${slugVal}" already exists. Please choose a different slug.`);
        setIsSaving(false);
        return;
      }

      if (editId) {
        // ── EDIT FLOW ────────────────────────────────────────────
        // Three explicit states — easier to audit than implicit initializer
        let finalImageUrl: string | null = null;

        if (selectedFile) {
          // REPLACE: new file selected — upload, then clean up old
          finalImageUrl = await uploadCategoryImage(selectedFile, editId);
          if (originalImageUrl) deleteCategoryImage(originalImageUrl).catch(() => {});
        } else if (imagePreview.startsWith('http')) {
          // KEEP: existing Supabase URL unchanged
          finalImageUrl = imagePreview;
        } else {
          // REMOVE: image cleared via X button — clean up old storage file
          if (originalImageUrl) deleteCategoryImage(originalImageUrl).catch(() => {});
          // finalImageUrl remains null
        }

        await updateCategory(editId, {
          name: name.trim(),
          slug: slugVal,
          subtitle: subtitle.trim() || null,
          description: description.trim() || null,
          sort_order: sortOrder,
          is_active: active,
          image_url: finalImageUrl,
          rule_match_type: ruleMatchType,
          measurement_template_id: measurementTemplateId || null,
        });
      } else {
        // ── CREATE FLOW ──────────────────────────────────────────
        const newCategory = await createCategory({
          name: name.trim(),
          slug: slugVal,
          subtitle: subtitle.trim() || null,
          description: description.trim() || null,
          sort_order: sortOrder,
          is_active: active,
          image_url: null,
          measurement_template_id: measurementTemplateId || null,
        });

        if (selectedFile) {
          try {
            const imageUrl = await uploadCategoryImage(selectedFile, newCategory.id);
            await updateCategory(newCategory.id, { image_url: imageUrl });
          } catch (uploadErr) {
            // Rollback: soft-delete created category to avoid orphaned records
            await deleteCategory(newCategory.id).catch(() => {});
            throw uploadErr;
          }
        }
      }

      router.push('/categories');
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error?.code === '23505' || error?.message?.toLowerCase().includes('duplicate')) {
        alert('A category with this slug already exists. Please choose a different slug.');
        return;
      }
      alert('Error saving category. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <span className="font-serif text-lg text-[#B38B5D] tracking-widest uppercase">MEI BRIDAL COUTURE</span>
          <span className="text-xs text-zinc-400 font-inter">Loading Category Details...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[480px] mx-auto pt-6 pb-16 font-inter animate-fade-in">
      <div className="flex items-center text-[10px] tracking-widest uppercase text-zinc-400 font-bold select-none mb-1.5">
        <Link href="/categories" className="hover:text-zinc-600 transition-colors">
          Categories
        </Link>
        <span className="mx-2 text-[#B38B5D] font-bold">/</span>
        <span className="text-zinc-400">{editId ? 'Edit Category' : 'Add Category'}</span>
      </div>

      <h1 className="font-serif text-[22px] text-zinc-950 font-medium tracking-wide mb-6">
        {editId ? 'Edit Category' : 'Add Category'}
      </h1>

      <div className="bg-white border border-[#E8E0D5] p-8 shadow-xs">
        <form onSubmit={handleSubmit} className="space-y-6">
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
              Shown on the homepage category card, e.g. &quot;Bridal Classics&quot;
            </p>
          </div>

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

          <div className="space-y-2">
            <label className="block text-[9px] font-bold tracking-widest text-zinc-900 uppercase">
              IMAGE
            </label>

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

            {imagePreview && (
              <div className="relative border border-[#E8E0D5] w-[70px] h-[70px] flex items-center justify-center overflow-hidden mt-2">
                <img
                  src={imagePreview}
                  alt="Uploaded category thumbnail"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={handleClearImage}
                  className="absolute right-0.5 top-0.5 bg-black/60 hover:bg-black text-white rounded-full p-0.5 transition-colors cursor-pointer"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            )}
          </div>

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

          <div className="space-y-1">
            <label className="block text-[9px] font-bold tracking-widest text-zinc-900 uppercase">
              MEASUREMENT TEMPLATE
            </label>
            <select
              value={measurementTemplateId}
              onChange={(e) => setMeasurementTemplateId(e.target.value)}
              className="w-full border-b border-[#E8E0D5] py-2 text-[13px] text-zinc-800 focus:outline-hidden focus:border-[#B38B5D] transition-colors bg-transparent"
            >
              <option value="">None</option>
              {(templates ?? []).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <p className="text-[10px] text-zinc-400 mt-1 italic font-light">
              Products in this category inherit these measurements unless overridden.
            </p>
          </div>

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

          <div className="pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-[#1A1A1A] hover:bg-black text-[#FAF8F5] text-[11px] font-bold tracking-widest py-3.5 transition-colors duration-200 rounded-none uppercase cursor-pointer flex items-center justify-center gap-2"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editId ? 'SAVE CHANGES' : 'SAVE CATEGORY'}
            </button>
          </div>

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

      {editId && (
        <div className="bg-white border border-[#E8E0D5] p-8 shadow-xs mt-6">
          <RuleList
            categoryId={editId}
            matchType={ruleMatchType}
            onMatchTypeChange={setRuleMatchType}
          />
        </div>
      )}
    </div>
  );
}

export default function AddCategoryPage() {
  return (
    <Suspense>
      <CategoryForm />
    </Suspense>
  );
}
