'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingBag,
  Layers,
  ShoppingCart,
  Mail,
  Image as ImageIcon,
  Settings,
  LogOut
} from 'lucide-react';
import { signOut } from '@/services/auth';

// Navigation items
const navItems = [
  { href: '/dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
  { href: '/products', label: 'PRODUCTS', icon: ShoppingBag },
  { href: '/categories', label: 'CATEGORIES', icon: Layers },
  { href: '/orders', label: 'ORDERS', icon: ShoppingCart },
  { href: '/enquiries', label: 'ENQUIRIES', icon: Mail },
  { href: '/banners', label: 'BANNERS', icon: ImageIcon },
  { href: '/settings', label: 'SETTINGS', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="fixed inset-y-0 left-0 w-[260px] bg-white border-r border-zinc-100 flex flex-col justify-between py-3 z-50">
      
      {/* Top Section: Branding & Navigation */}
      <div className="flex flex-col gap-5">
        
        {/* Brand Header */}
        <div className='p-8'>
          <h1 className="text-[20px] font-serif tracking-wide text-amber-900 font-medium">
            MEI Bridal Couture
          </h1>
          <p className="text-[10px] tracking-widest text-zinc-600 font-bold mt-1">
            ADMIN MANAGEMENT
          </p>
        </div>

        {/* Navigation Links */}
        <nav className="flex flex-col gap-1 pl-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            // State Management: Checks if the current URL matches this item's path
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-4 px-4 py-3 text-[11px] font-bold tracking-widest transition-all duration-150 ${
                  isActive
                    ? 'bg-[#FAF6F0] text-[#B38B5D] border-l-4 border-[#B38B5D] -ml-[4px]' 
                    : 'text-zinc-500 hover:text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#B38B5D]' : 'text-zinc-600'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: Sign Out */}
      <div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-4 px-4 py-3 text-[11px] font-bold tracking-widest text-zinc-500 hover:text-red-600 transition-colors w-full"
        >
          <LogOut className="w-4 h-4 text-zinc-400 hover:text-red-600" />
          <span>SIGN OUT</span>
        </button>
      </div>

    </aside>
  );
}