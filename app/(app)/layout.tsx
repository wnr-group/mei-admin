// app/(app)/layout.tsx
import React from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/TopBar';


export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      {/* 1. The Persistent Sidebar */}
      <Sidebar />

      {/* 2. Main Content Wrapper */}
      {/* pl-[260px] pushes the page content right, matching the sidebar width */}
      <div className="pl-[260px] flex flex-col min-h-screen">
        
        {/* Optional: Add your shared admin Topbar here if you need one */}
        {/* <header className="h-16 bg-white border-b border-zinc-100 flex items-center px-8"> */}
        {/*   Topbar content */}
        {/* </header> */}

        <Topbar />
              


        {/* 3. Dynamic Sub-Page Content */}
        {/* Clicking 'Dashboard' or 'Products' swaps the content here smoothly */}
        <main className="flex-1 p-8">
          {children}
        </main>
        
      </div>
    </div>
  );
}