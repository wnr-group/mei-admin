'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const tabs = [
    { name: 'GENERAL', href: '/settings' },
    { name: 'SHIPPING', href: '/settings/shipping' },
  ]

  return (
    <div className="space-y-6 px-8 pt-10 font-inter relative animate-fade-in">
      {/* Settings Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold tracking-wider text-zinc-800 uppercase font-sans">
          Settings
        </h3>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-8 border-b border-[#E8E0D5]">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`text-[11px] font-bold tracking-widest uppercase pb-3 transition-colors ${
                isActive
                  ? 'border-b-2 border-[#B38B5D] text-zinc-900'
                  : 'border-b-2 border-transparent text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {tab.name}
            </Link>
          )
        })}
      </div>

      {/* Content */}
      {children}
    </div>
  )
}
