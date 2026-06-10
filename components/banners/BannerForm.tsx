'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { fetchBanners, addBanner, updateBanner, Banner } from '@/lib/mockDb';
import { Upload, X, Loader2, Link as LinkIcon } from 'lucide-react';
import Link from 'next/link';

interface BannerFormProps {
  editId?: string;
}

export default function BannerForm({ editId }: BannerFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [image, setImage] = useState('');
  const [link, setLink] = useState('');
  const [linkText, setLinkText] = useState('');
  const [position, setPosition] = useState<Banner['type']>('HERO');
  const [sortOrder, setSortOrder] = useState(0);
  const [active, setActive] = useState(true);
  
  // Date schedule states
  const [showFrom, setShowFrom] = useState('');
  const [showUntil, setShowUntil] = useState('');

  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(editId ? true : false);
  const [saving, setSaving] = useState(false);

  // Load existing banner data if in edit mode
  useEffect(() => {
    if (!editId) return;

    async function loadBanner() {
      try {
        const banners = await fetchBanners();
        const banner = banners.find((b) => b.id === editId);
        if (banner) {
          setName(banner.name || '');
          setTitle(banner.title);
          setSubtitle(banner.subtitle || '');
          setImage(banner.image || '');
          setLink(banner.link || '');
          setLinkText(banner.linkText || '');
          setPosition(banner.type);
          setSortOrder(banner.sortOrder || 0);
          setActive(banner.status === 'ACTIVE');
          setShowFrom(banner.startDate || '');
          setShowUntil(banner.endDate || '');
        } else {
          alert('Banner not found.');
          router.push('/banners');
        }
      } catch (err) {
        console.error('Failed to load banner details:', err);
      } finally {
        setLoading(false);
      }
    }

    loadBanner();
  }, [editId, router]);

  // Drag-and-drop handlers
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
    fileInputRef.current?.click();
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('Please enter a banner title.');
      return;
    }

    // Dynamic banner internal name fallback if not specified
    const finalName = name.trim() || `${title.trim()} Banner`;

    // Date validation
    if (showFrom && showUntil && new Date(showFrom) > new Date(showUntil)) {
      alert('Show From date cannot be after the Show Until date.');
      return;
    }

    setSaving(true);

    const payload = {
      name: finalName,
      title: title.trim(),
      subtitle: subtitle.trim(),
      type: position,
      status: active ? ('ACTIVE' as const) : ('INACTIVE' as const),
      startDate: showFrom,
      endDate: showUntil,
      image: image.trim(),
      link: link.trim(),
      linkText: linkText.trim(),
      sortOrder: sortOrder
    };

    try {
      if (editId) {
        await updateBanner({
          id: editId,
          ...payload
        });
      } else {
        await addBanner(payload);
      }
      router.push('/banners');
    } catch (err) {
      console.error('Failed to save banner:', err);
      alert('Failed to save banner. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <span className="font-serif text-lg text-[#B38B5D] tracking-widest uppercase">MEI BRIDAL COUTURE</span>
          <span className="text-xs text-zinc-400 font-inter">Loading Banner details...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[480px] mx-auto pt-6 pb-16 font-inter animate-fade-in px-4">
      
      {/* 1. Breadcrumbs matching screenshot */}
      <div className="flex items-center text-[10px] tracking-widest uppercase text-zinc-600 font-medium select-none mb-1.5 font-inter">
        <Link href="/banners" className="hover:text-zinc-600 transition-colors">
          BANNERS
        </Link>
        <span className="mx-2.5 text-[#B38B5D] font-bold">›</span>
        <span className="text-gold">{editId ? 'EDIT BANNER' : 'ADD BANNER'}</span>
      </div>

      {/* 2. Heading */}
      <h1 className="font-serif text-[24px] text-zinc-950 font-normal tracking-wide mb-6">
        {editId ? 'Edit Banner' : 'Add Banner'}
      </h1>

      {/* 3. Form Card Container */}
      <div className="bg-white border border-[#E8E0D5] p-8 shadow-xs">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* TITLE field */}
          <div className="space-y-1">
            <label className="block text-[9px] font-bold tracking-widest text-zinc-900 uppercase">
              TITLE
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Summer Bridal Collection"
              className="w-full border border-[#E8E0D5] px-4 py-2.5 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
            />
          </div>

          {/* SUBTITLE field */}
          <div className="space-y-1">
            <label className="block text-[9px] font-bold tracking-widest text-zinc-900 uppercase">
              SUBTITLE
            </label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="e.g., Discover the new elegance"
              className="w-full border border-[#E8E0D5] px-4 py-2.5 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
            />
          </div>

          {/* BANNER IMAGE field */}
          <div className="space-y-2">
            <label className="block text-[9px] font-bold tracking-widest text-zinc-900 uppercase">
              BANNER IMAGE
            </label>

            {/* Dropzone / Upload area */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={triggerFileInput}
              className={`border border-dashed p-6 text-center cursor-pointer transition-colors duration-200 flex flex-col items-center justify-center min-h-[140px] relative overflow-hidden bg-[#FAF8F5]/30 ${
                isDragging
                  ? 'border-[#B38B5D] bg-[#FAF8F5]'
                  : 'border-[#E8E0D5] hover:border-[#B38B5D]'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {image ? (
                <div className="absolute inset-0 w-full h-full p-2 flex items-center justify-center bg-[#FAF8F5]">
                  <img
                    src={image}
                    alt="Preview of editorial bridal banner image"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setImage('');
                    }}
                    className="absolute right-2 top-2 bg-black/60 hover:bg-black text-white rounded-full p-1.5 transition-colors cursor-pointer z-10"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : null}

              {/* Alt/placeholder details matching screenshot exactly */}
              <div className="flex flex-col items-center justify-center select-none p-4 pointer-events-none">
                <Upload className="w-5 h-5 stroke-[1.5] text-zinc-400 mb-2" />
                <span className="text-[11px] text-zinc-500 font-medium leading-relaxed max-w-[85%] break-words">
                  Preview of editorial bridal banner image
                </span>
                <span className="text-[9px] text-zinc-400 mt-1 uppercase tracking-widest font-bold">
                  Click or drag image here
                </span>
              </div>
            </div>

            {/* Image URL text input for backup support */}
            <div className="space-y-1 pt-1.5">
              <label className="block text-[8px] font-bold tracking-wider text-zinc-400 uppercase flex items-center gap-1">
                <LinkIcon className="w-2.5 h-2.5" /> OR ENTER IMAGE URL
              </label>
              <input
                type="text"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="e.g., https://images.unsplash.com/photo-..."
                className="w-full border border-[#E8E0D5] px-4 py-2 text-[12px] text-zinc-700 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
              />
            </div>
          </div>

          {/* LINK URL field */}
          <div className="space-y-1">
            <label className="block text-[9px] font-bold tracking-widest text-zinc-900 uppercase">
              LINK URL
            </label>
            <input
              type="text"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="/collections/summer"
              className="w-full border border-[#E8E0D5] px-4 py-2.5 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
            />
          </div>

          {/* LINK TEXT field */}
          <div className="space-y-1">
            <label className="block text-[9px] font-bold tracking-widest text-zinc-900 uppercase">
              LINK TEXT
            </label>
            <input
              type="text"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              placeholder="e.g., Explore Collection"
              className="w-full border border-[#E8E0D5] px-4 py-2.5 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
            />
          </div>

          {/* POSITION and SORT ORDER side-by-side */}
          <div className="grid grid-cols-2 gap-4">
            
            {/* POSITION control */}
            <div className="space-y-1">
              <label className="block text-[9px] font-bold tracking-widest text-zinc-900 uppercase">
                POSITION
              </label>
              <div className="flex border border-[#E8E0D5] rounded-none overflow-hidden h-[40px]">
                {['HERO', 'PROMO'].map((pos) => {
                  const isActive = position === pos;
                  return (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => setPosition(pos as Banner['type'])}
                      className={`flex-1 text-[10px] font-bold tracking-widest uppercase transition-all duration-150 text-center cursor-pointer ${
                        isActive
                          ? 'bg-[#C29E75] text-white border-none'
                          : 'bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 border-r border-[#E8E0D5] last:border-none'
                      }`}
                    >
                      {pos}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SORT ORDER field */}
            <div className="space-y-1">
              <label className="block text-[9px] font-bold tracking-widest text-zinc-900 uppercase">
                SORT ORDER
              </label>
              <input
                type="number"
                min={0}
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
                placeholder="0"
                className="w-full border border-[#E8E0D5] px-4 py-2.5 text-[13px] text-zinc-800 focus:outline-hidden focus:border-[#B38B5D] transition-colors font-sans h-[40px]"
              />
            </div>

          </div>

          {/* Internal Name (Internal classification, optional) */}
          <div className="space-y-1">
            <label className="block text-[8px] font-bold tracking-wider text-zinc-400 uppercase">
              INTERNAL NAME (FOR ADMIN REFERENCE)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Summer Bridal Collection Banner"
              className="w-full border border-[#E8E0D5] px-4 py-2 text-[12px] text-zinc-700 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
            />
          </div>

          {/* ACTIVE STATUS toggle */}
          <div className="flex items-center justify-between border-t border-[#FAF6F0] pt-4 select-none">
            <span className="text-[9px] font-bold tracking-widest text-zinc-900 uppercase">
              ACTIVE STATUS
            </span>

            {/* Switch Toggle */}
            <button
              type="button"
              onClick={() => setActive(!active)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                active ? 'bg-[#C29E75]' : 'bg-zinc-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                  active ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Schedule (Optional) divider */}
          <div className="border-t border-dashed border-[#E8E0D5] my-6" />

          {/* Schedule Header */}
          <div className="space-y-0.5">
            <h3 className="font-serif text-[15px] font-medium text-zinc-800">
              Schedule (Optional)
            </h3>
            <p className="text-[11px] text-zinc-400 font-inter font-light italic">
              Leave blank to show indefinitely.
            </p>
          </div>

          {/* Schedule Dates pickers */}
          <div className="grid grid-cols-2 gap-4">
            
            {/* SHOW FROM */}
            <div className="space-y-1">
              <label className="block text-[9px] font-bold tracking-widest text-zinc-900 uppercase">
                SHOW FROM
              </label>
              <input
                type="datetime-local"
                value={showFrom}
                onChange={(e) => setShowFrom(e.target.value)}
                className="w-full border border-[#E8E0D5] px-3 py-2 text-[12px] text-zinc-800 bg-white focus:outline-hidden focus:border-[#B38B5D] transition-colors font-sans"
              />
            </div>

            {/* SHOW UNTIL */}
            <div className="space-y-1">
              <label className="block text-[9px] font-bold tracking-widest text-zinc-900 uppercase">
                SHOW UNTIL
              </label>
              <input
                type="datetime-local"
                value={showUntil}
                onChange={(e) => setShowUntil(e.target.value)}
                className="w-full border border-[#E8E0D5] px-3 py-2 text-[12px] text-zinc-800 bg-white focus:outline-hidden focus:border-[#B38B5D] transition-colors font-sans"
              />
            </div>

          </div>

          {/* Action buttons */}
          <div className="pt-4 space-y-4">
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-[#1A1A1A] hover:bg-black text-[#FAF8F5] text-[11px] font-bold tracking-widest py-4 transition-colors duration-200 rounded-none uppercase cursor-pointer flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              SAVE BANNER
            </button>

            <Link
              href="/banners"
              className="text-[10px] font-bold tracking-widest text-zinc-500 hover:text-zinc-800 transition-colors uppercase text-center block pt-1 cursor-pointer select-none"
            >
              CANCEL
            </Link>
          </div>

        </form>
      </div>

    </div>
  );
}
