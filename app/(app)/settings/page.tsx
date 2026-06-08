'use client';

import React, { useState, useEffect } from 'react';
import { fetchSettings, saveSettings, StoreSettings } from '@/lib/mockDb';
import { Loader2 } from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState<StoreSettings>({
    whatsappNumber: '',
    storeEmail: '',
    storePhone: '',
    streetAddress: '',
    city: '',
    state: '',
    pincode: '',
    instagramUrl: ''
  });

  const [mounted, setMounted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await fetchSettings();
        setSettings(data);
      } catch (err) {
        console.error('Error loading settings:', err);
      } finally {
        setMounted(true);
      }
    }
    loadSettings();
  }, []);

  const handleChange = (key: keyof StoreSettings, value: string) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await saveSettings(settings);
      setSaveSuccess(true);
      // Automatically dismiss the success message after 4 seconds
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      alert('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <span className="font-serif text-lg text-[#B38B5D] tracking-widest uppercase">MEI BRIDAL COUTURE</span>
          <span className="text-xs text-zinc-400">Loading Settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[680px] mx-auto space-y-6 pb-20 font-inter animate-fade-in">
      
      {/* 1. Header Section */}
      <div className="pt-2">
        <h3 className="font-serif text-[26px] text-zinc-900 font-medium tracking-wide">
          Settings
        </h3>
      </div>

      {/* Success Banner */}
      {saveSuccess && (
        <div className="bg-[#FAF6F0] border border-[#B38B5D] text-[#B38B5D] px-6 py-4 text-[10px] font-bold tracking-widest uppercase transition-all duration-200 animate-fade-in flex justify-between items-center">
          <span>Settings saved successfully</span>
          <button 
            type="button" 
            onClick={() => setSaveSuccess(false)}
            className="text-[#B38B5D] hover:text-zinc-800 transition-colors text-xs font-sans cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* CARD 1: STORE INFO */}
        <div className="bg-white border border-[#E8E0D5] p-8 space-y-6">
          <h4 className="text-[10px] font-medium tracking-widest text-zinc-400 uppercase">
            STORE INFO
          </h4>

          {/* WhatsApp Number */}
          <div className="space-y-1">
            <label className="block text-[9px] font-bold tracking-widest text-zinc-800 uppercase">
              WHATSAPP NUMBER
            </label>
            <input
              type="text"
              required
              value={settings.whatsappNumber}
              onChange={(e) => handleChange('whatsappNumber', e.target.value)}
              placeholder="919XXXXXXXXX"
              className="w-full border-b border-[#E8E0D5] py-2.5 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
            />
            <p className="text-[9.5px] text-zinc-400 font-medium font-sans">
              Include country code, no + sign.
            </p>
          </div>

          {/* Store Email */}
          <div className="space-y-1">
            <label className="block text-[9px] font-bold tracking-widest text-zinc-800 uppercase">
              STORE EMAIL
            </label>
            <input
              type="email"
              required
              value={settings.storeEmail}
              onChange={(e) => handleChange('storeEmail', e.target.value)}
              placeholder="info@navarachna.in"
              className="w-full border-b border-[#E8E0D5] py-2.5 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
            />
          </div>

          {/* Store Phone */}
          <div className="space-y-1">
            <label className="block text-[9px] font-bold tracking-widest text-zinc-800 uppercase">
              STORE PHONE
            </label>
            <input
              type="text"
              required
              value={settings.storePhone}
              onChange={(e) => handleChange('storePhone', e.target.value)}
              placeholder="+91 9XXXXXXXXX"
              className="w-full border-b border-[#E8E0D5] py-2.5 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
            />
          </div>
        </div>

        {/* CARD 2: STORE ADDRESS */}
        <div className="bg-white border border-[#E8E0D5] p-8 space-y-6">
          <div className="space-y-0.5">
            <h4 className="text-[10px] font-medium tracking-widest text-zinc-400 uppercase">
              STORE ADDRESS
            </h4>
            <p className="text-[9.5px] text-zinc-400 font-inter">
              Shown in the footer.
            </p>
          </div>

          {/* Street Address */}
          <div className="space-y-1">
            <label className="block text-[9px] font-bold tracking-widest text-zinc-800 uppercase">
              STREET ADDRESS
            </label>
            <input
              type="text"
              required
              value={settings.streetAddress}
              onChange={(e) => handleChange('streetAddress', e.target.value)}
              placeholder="Street name, landmark..."
              className="w-full border-b border-[#E8E0D5] py-2.5 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
            />
          </div>

          {/* City, State, Pincode Row */}
          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-1">
              <label className="block text-[9px] font-bold tracking-widest text-zinc-800 uppercase">
                CITY
              </label>
              <input
                type="text"
                required
                value={settings.city}
                onChange={(e) => handleChange('city', e.target.value)}
                placeholder="City"
                className="w-full border-b border-[#E8E0D5] py-2.5 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[9px] font-bold tracking-widest text-zinc-800 uppercase">
                STATE
              </label>
              <input
                type="text"
                required
                value={settings.state}
                onChange={(e) => handleChange('state', e.target.value)}
                placeholder="State"
                className="w-full border-b border-[#E8E0D5] py-2.5 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[9px] font-bold tracking-widest text-zinc-800 uppercase">
                PINCODE
              </label>
              <input
                type="text"
                required
                value={settings.pincode}
                onChange={(e) => handleChange('pincode', e.target.value)}
                placeholder="Pincode"
                className="w-full border-b border-[#E8E0D5] py-2.5 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
              />
            </div>
          </div>
        </div>

        {/* CARD 3: SOCIAL LINKS */}
        <div className="bg-white border border-[#E8E0D5] p-8 space-y-6">
          <h4 className="text-[10px] font-medium tracking-widest text-zinc-400 uppercase">
            SOCIAL LINKS
          </h4>

          {/* Instagram URL */}
          <div className="space-y-1">
            <label className="block text-[9px] font-bold tracking-widest text-zinc-800 uppercase">
              INSTAGRAM URL
            </label>
            <input
              type="url"
              required
              value={settings.instagramUrl}
              onChange={(e) => handleChange('instagramUrl', e.target.value)}
              placeholder="https://instagram.com/brandname"
              className="w-full border-b border-[#E8E0D5] py-2.5 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
            />
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-[#1A1A1A] hover:bg-black text-[#FAF8F5] text-[11px] font-bold tracking-widest py-4 transition-colors duration-200 rounded-none uppercase cursor-pointer flex items-center justify-center gap-2"
          >
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin animate-infinite" />}
            SAVE CHANGES
          </button>
        </div>

      </form>
    </div>
  );
}
