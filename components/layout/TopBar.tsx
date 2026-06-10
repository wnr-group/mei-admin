'use client';

import { usePathname } from 'next/navigation';
import { Bell, HelpCircle, User } from 'lucide-react';

export default function Topbar() {
  const pathname = usePathname();

  // Helper function to extract and format the page title from the URL string
  const getPageTitle = () => {
    if (!pathname) return 'Dashboard';
    if (pathname === '/products/add') return 'Add Product';
    
    // Splits the path (e.g. "/products" or "/products/add") and grabs the primary folder
    const segment = pathname.split('/')[1];
    if (!segment) return 'Dashboard';

    // Capitalizes the segment name (e.g., "products" -> "Products")
    return segment.charAt(0).toUpperCase() + segment.slice(1);
  };

  return (
    <header className="h-13 bg-white border-b border-zinc-100 flex items-center justify-between px-8 sticky top-0 z-40">
      
      {/* Left side: Dynamic Page Title */}
      <h2 className="text-[14px] font-bold tracking-wide text-zinc-700 uppercase">
        {getPageTitle()}
      </h2>

      {/* Right side: Action Icon Items matching screenshot exactly */}
      <div className="flex items-center gap-6 text-zinc-400">
        
        {/* 1. Notification Bell */}
        <button className="hover:text-zinc-900 transition-colors">
          <Bell className="w-[18px] h-[18px] stroke-[2] text-zinc-800" />
        </button>

        {/* 2. Help Support Information */}
        <button className="hover:text-zinc-900 transition-colors">
          <HelpCircle className="w-[18px] h-[18px] stroke-[2] text-zinc-800" />
        </button>

        {/* 3. Account User Box Container (Samplified from image_4c8683.png) */}
        <button className="p-2 bg-zinc-300 border border-zinc-100 hover:bg-zinc-600 transition-colors">
          <User className="w-[18px] h-[18px] stroke-[2] text-zinc-800" />
        </button>

      </div>

    </header>
  );
}