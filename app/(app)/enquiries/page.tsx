'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { fetchEnquiries, Enquiry } from '@/lib/mockDb';
import { Search } from 'lucide-react';
import Link from 'next/link';

type TabType = 'ALL' | 'NEW' | 'CONTACTED' | 'QUOTED' | 'CONVERTED' | 'CLOSED';

export default function EnquiriesPage() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Load enquiries on mount
  useEffect(() => {
    async function loadData() {
      const data = await fetchEnquiries();
      setEnquiries(data);
      setMounted(true);
    }
    loadData();
  }, []);

  // Filter & Search Logic
  const filteredEnquiries = useMemo(() => {
    let result = enquiries;

    // Filter by tab
    if (activeTab !== 'ALL') {
      result = result.filter((item) => item.status === activeTab);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.id.toLowerCase().includes(query) ||
          item.customerName.toLowerCase().includes(query) ||
          item.product.toLowerCase().includes(query)
      );
    }

    return result;
  }, [activeTab, searchQuery, enquiries]);

  // Tab counts
  const newCount = enquiries.filter((item) => item.status === 'NEW').length;

  // Pagination calculation
  const totalItems = filteredEnquiries.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, totalItems);

  // Paginated chunk
  const paginatedEnquiries = filteredEnquiries.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Export CSV mock trigger
  const handleExportCSV = () => {
    alert('Enquiries data exported to CSV successfully.');
  };

  // Status mapping matching mockup styling
  const getStatusBadgeStyle = (status: Enquiry['status']) => {
    switch (status) {
      case 'NEW':
        return 'bg-zinc-100 text-zinc-900 border border-zinc-200/80';
      case 'CONTACTED':
        return 'bg-zinc-100/60 text-zinc-500 border border-zinc-200/80';
      case 'QUOTED':
        return 'bg-zinc-500 text-white border border-zinc-600';
      case 'CONVERTED':
        return 'bg-[#B38B5D] text-white border border-[#B38B5D]';
      case 'CLOSED':
        return 'bg-zinc-200 text-zinc-600 border border-zinc-300';
      default:
        return 'bg-zinc-100 text-zinc-700';
    }
  };

  const getStatusDotColor = (status: Enquiry['status']) => {
    switch (status) {
      case 'NEW': return 'bg-zinc-900';
      case 'CONTACTED': return 'bg-zinc-400';
      case 'QUOTED': return 'bg-zinc-200';
      case 'CONVERTED': return 'bg-white';
      case 'CLOSED': return 'bg-zinc-500';
      default: return 'bg-zinc-500';
    }
  };

  const getStatusText = (status: Enquiry['status']) => {
    switch (status) {
      case 'NEW': return 'NEW';
      case 'CONTACTED': return 'CONTACTED';
      case 'QUOTED': return 'QUOTED';
      case 'CONVERTED': return 'CONVERTED';
      case 'CLOSED': return 'CLOSED';
      default: return status;
    }
  };

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <span className="font-serif text-lg text-[#B38B5D] tracking-widest uppercase">MEI BRIDAL COUTURE</span>
          <span className="text-xs text-zinc-400">Loading Enquiries...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-8 pt-10 font-inter animate-fade-in pb-16">
      {/* 1. Header & Search Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-serif text-[32px] text-zinc-950 font-normal tracking-wide">
            Enquiries
          </h1>
          <p className="text-[12px] text-zinc-600 font-inter mt-1">
            Manage incoming client requests, quotes, and custom consultations.
          </p>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 md:flex-initial">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search enquiries..."
              className="w-full md:w-[220px] pl-9 pr-4 py-2 border border-[#E8E0D5] bg-white text-[12px] font-sans font-medium text-zinc-800 focus:outline-hidden focus:border-[#B38B5D]"
            />
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-400" />
          </div>

          {/* Export button */}
          <button
            onClick={handleExportCSV}
            className="bg-[#1A1A1A] hover:bg-black text-[#FAF8F5] text-[10px] font-bold tracking-widest px-5 py-2.5 transition-colors duration-200 rounded-none uppercase cursor-pointer flex-shrink-0"
          >
            EXPORT CSV
          </button>
        </div>
      </div>

      {/* 2. Filter Tabs */}
      <div className="flex gap-8 border-b border-[#E8E0D5] select-none flex-wrap">
        <button
          onClick={() => { setActiveTab('ALL'); setCurrentPage(1); }}
          className={`pb-3 text-[11px] font-inter tracking-widest uppercase cursor-pointer transition-all duration-200 border-b-2 -mb-[1px] ${
            activeTab === 'ALL'
              ? 'text-zinc-900 border-[#B38B5D]'
              : 'text-zinc-600 border-transparent hover:text-zinc-800'
          }`}
        >
          ALL
        </button>
        <button
          onClick={() => { setActiveTab('NEW'); setCurrentPage(1); }}
          className={`pb-3 text-[11px] font-inter tracking-widest uppercase cursor-pointer transition-all duration-200 border-b-2 -mb-[1px] flex items-center gap-2 ${
            activeTab === 'NEW'
              ? 'text-zinc-900 border-[#B38B5D]'
              : 'text-zinc-600 border-transparent hover:text-zinc-800'
          }`}
        >
          <span>NEW</span>
          <span className="bg-zinc-950 text-white rounded-full flex items-center justify-center text-[9px] w-4.5 h-4.5 font-bold font-sans">
            {newCount}
          </span>
        </button>
        <button
          onClick={() => { setActiveTab('CONTACTED'); setCurrentPage(1); }}
          className={`pb-3 text-[11px] font-inter tracking-widest uppercase cursor-pointer transition-all duration-200 border-b-2 -mb-[1px] ${
            activeTab === 'CONTACTED'
              ? 'text-zinc-900 border-[#B38B5D]'
              : 'text-zinc-600 border-transparent hover:text-zinc-800'
          }`}
        >
          CONTACTED
        </button>
        <button
          onClick={() => { setActiveTab('QUOTED'); setCurrentPage(1); }}
          className={`pb-3 text-[11px] font-inter tracking-widest uppercase cursor-pointer transition-all duration-200 border-b-2 -mb-[1px] ${
            activeTab === 'QUOTED'
              ? 'text-zinc-900 border-[#B38B5D]'
              : 'text-zinc-600 border-transparent hover:text-zinc-800'
          }`}
        >
          QUOTED
        </button>
        <button
          onClick={() => { setActiveTab('CONVERTED'); setCurrentPage(1); }}
          className={`pb-3 text-[11px] font-inter tracking-widest uppercase cursor-pointer transition-all duration-200 border-b-2 -mb-[1px] ${
            activeTab === 'CONVERTED'
              ? 'text-zinc-900 border-[#B38B5D]'
              : 'text-zinc-600 border-transparent hover:text-zinc-800'
          }`}
        >
          CONVERTED
        </button>
        <button
          onClick={() => { setActiveTab('CLOSED'); setCurrentPage(1); }}
          className={`pb-3 text-[11px] font-inter tracking-widest uppercase cursor-pointer transition-all duration-200 border-b-2 -mb-[1px] ${
            activeTab === 'CLOSED'
              ? 'text-zinc-900 border-[#B38B5D]'
              : 'text-zinc-600 border-transparent hover:text-zinc-800'
          }`}
        >
          CLOSED
        </button>
      </div>

      {/* 3. Table Container */}
      <div className="bg-white border border-[#E8E0D5] shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAF8F5] border-b border-[#E8E0D5]">
                <th className="px-8 py-3.5 text-[15px] font-bold tracking-widest text-zinc-600 uppercase w-[23%]">
                  ENQUIRY #
                </th>
                <th className="px-8 py-3.5 text-[15px] font-bold tracking-widest text-zinc-600 uppercase w-[25%]">
                  CUSTOMER
                </th>
                <th className="px-8 py-3.5 text-[15px] font-bold tracking-widest text-zinc-600 uppercase w-[17%]">
                  PRODUCT
                </th>
                <th className="px-8 py-3.5 text-[15px] font-bold tracking-widest text-zinc-600 uppercase w-[12%]">
                  TYPE
                </th>
                <th className="px-8 py-3.5 text-[15px] font-bold tracking-widest text-zinc-600 uppercase w-[13%]">
                  STATUS
                </th>
                <th className="px-8 py-3.5 text-[15px] font-bold tracking-widest text-zinc-600 uppercase w-[10%] text-right">
                  DATE
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E0D5]">
              {paginatedEnquiries.length > 0 ? (
                paginatedEnquiries.map((item) => {
                  const isNew = item.status === 'NEW';
                  return (
                    <tr key={item.id} className="hover:bg-[#FAF8F5]/40 transition-colors">
                      {/* Enquiry ID with vertical left highlight bar if new */}
                      <td className={`px-8 py-5 text-[12px] font-semibold text-[#B38B5D] font-sans tracking-wide ${isNew ? 'border-l-[3px] border-zinc-950 pl-[29px]' : ''}`}>
                        <Link href={`/enquiries/${item.id}`} className="hover:text-[#a37b4d] transition-colors cursor-pointer">
                          {item.id}
                        </Link>
                      </td>

                      {/* Customer Info */}
                      <td className="px-8 py-5">
                        <div className="text-[12px] font-inter text-zinc-800">
                          {item.customerName}
                        </div>
                        <div className="text-[10px] text-zinc-400 font-inter font-sans mt-0.5">
                          {item.customerContact}
                        </div>
                      </td>

                      {/* Product Name */}
                      <td className="px-8 py-5 text-[12px] font-inter text-zinc-600">
                        {item.product}
                      </td>

                      {/* Type Badge */}
                      <td className="px-8 py-5">
                        <span className="inline-block border border-black px-2 py-0.5 text-[9px] font-inter font-sans tracking-wider text-black rounded-none uppercase">
                          {item.type}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="px-8 py-5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 text-[9px] font-bold tracking-widest rounded-none text-center min-w-[100px] uppercase font-sans ${getStatusBadgeStyle(
                            item.status
                          )}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(item.status)}`} />
                          {getStatusText(item.status)}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-8 py-5 text-[12px] text-zinc-500 font-inter font-sans text-right">
                        {item.date}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-8 py-12 text-center text-[12px] text-zinc-400 font-medium"
                  >
                    No enquiries found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 4. Table Pagination Footer */}
        <div className="px-8 py-4 border-t border-[#E8E0D5] bg-[#FAF8F5]/40 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-[11px] font-sans font-inter text-zinc-700">
            Showing {startIndex} to {endIndex} of {totalItems} entries
          </div>

          <div className="flex items-center gap-1">
            {/* Previous page button */}
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className={`border px-3 py-1.5 text-[11px] font-sans font-medium rounded-none select-none ${
                currentPage === 1
                  ? 'border-zinc-100 text-zinc-300 cursor-not-allowed'
                  : 'border-zinc-200 text-zinc-600 hover:bg-[#FAF8F5] cursor-pointer'
              }`}
            >
              Previous
            </button>

            {/* Pagination numbers */}
            {Array.from({ length: totalPages }).map((_, idx) => {
              const pageNum = idx + 1;
              const isActive = currentPage === pageNum;
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`border px-3.5 py-1.5 text-[11px] font-sans font-medium rounded-none cursor-pointer transition-colors ${
                    isActive
                      ? 'border-[#B38B5D] text-[#B38B5D] font-bold bg-[#FAF8F5]/30'
                      : 'border-zinc-200 text-zinc-600 hover:bg-[#FAF8F5]'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            {/* Next page button */}
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className={`border px-3 py-1.5 text-[11px] font-sans font-medium rounded-none select-none ${
                currentPage === totalPages
                  ? 'border-zinc-100 text-zinc-300 cursor-not-allowed'
                  : 'border-zinc-200 text-zinc-600 hover:bg-[#FAF8F5] cursor-pointer'
              }`}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
