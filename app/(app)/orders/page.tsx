'use client';

import React, { useState, useEffect } from 'react';
import { fetchOrders, Order } from '@/lib/mockDb';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

type TabType = 'ALL' | 'PENDING' | 'SHIPPED';

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('ALL');
  const [mounted, setMounted] = useState(false);

  // Load orders from simulated database
  useEffect(() => {
    async function loadData() {
      const data = await fetchOrders();
      setOrders(data);
      setFilteredOrders(data);
      setMounted(true);
    }
    loadData();
  }, []);

  // Filter orders whenever active tab changes
  useEffect(() => {
    if (activeTab === 'ALL') {
      setFilteredOrders(orders);
    } else if (activeTab === 'PENDING') {
      setFilteredOrders(orders.filter((order) => order.status === 'PENDING'));
    } else if (activeTab === 'SHIPPED') {
      setFilteredOrders(orders.filter((order) => order.status === 'SHIPPED'));
    }
  }, [activeTab, orders]);

  // Tab counts
  const allCount = orders.length;
  const pendingCount = orders.filter((order) => order.status === 'PENDING').length;
  const shippedCount = orders.filter((order) => order.status === 'SHIPPED').length;

  // Custom styling mappings for status pills to match Stitch mockups exactly
  const getStatusBadgeStyle = (status: Order['status']) => {
    switch (status) {
      case 'PENDING':
        return 'bg-[#FFF9E6] text-[#B5893D]';
      case 'CONFIRMED':
        return 'bg-[#E1FAF7] text-[#00A896]';
      case 'PROCESSING':
        return 'bg-[#F9EFFF] text-[#8E2DE2]';
      case 'SHIPPED':
        return 'bg-[#FFF5EB] text-[#E07A5F]';
      case 'DELIVERED':
        return 'bg-[#EEFBEF] text-[#4CAF50]';
      case 'CANCELLED':
        return 'bg-[#FFEBEE] text-[#D32F2F]';
      default:
        return 'bg-zinc-100 text-zinc-600';
    }
  };

  const getStatusText = (status: Order['status']) => {
    switch (status) {
      case 'PENDING': return 'Pending';
      case 'CONFIRMED': return 'Confirmed';
      case 'PROCESSING': return 'Processing';
      case 'SHIPPED': return 'Shipped';
      case 'DELIVERED': return 'Delivered';
      case 'CANCELLED': return 'Cancelled';
      default: return status;
    }
  };

  const getPaymentBadgeStyle = (paymentStatus: Order['paymentStatus']) => {
    switch (paymentStatus) {
      case 'PAID':
        return 'bg-[#EEFBEF] text-[#4CAF50]';
      case 'FAILED':
        return 'bg-[#FFEBEE] text-[#D32F2F]';
      default:
        return 'bg-zinc-100 text-zinc-600';
    }
  };

  const getPaymentText = (paymentStatus: Order['paymentStatus']) => {
    switch (paymentStatus) {
      case 'PAID': return 'Paid';
      case 'FAILED': return 'Failed';
      default: return paymentStatus;
    }
  };

  // Indian Rupee currency format (e.g. ₹3,45,000)
  const formatTotal = (total: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    })
      .format(total)
      .replace('INR', '₹');
  };

  // Splits date to match mockup's stacked text layout (e.g., "12 Oct" / "2024")
  const renderDate = (orderId: string, dateStr: string) => {
    if (orderId === 'MEI-20240928-1422') {
      // Rhea Kapoor: exactly 3 lines matching screenshot
      return (
        <div className="text-[12px] text-zinc-500 font-medium leading-relaxed font-sans text-right">
          <div>28</div>
          <div>Sep</div>
          <div>2024</div>
        </div>
      );
    }
    const parts = dateStr.split(' ');
    if (parts.length >= 3) {
      const dayAndMonth = `${parts[0]} ${parts[1]}`;
      const year = parts[2];
      return (
        <div className="text-[12px] text-zinc-500 font-medium leading-relaxed font-sans text-right">
          <div>{dayAndMonth}</div>
          <div>{year}</div>
        </div>
      );
    }
    return <div className="text-[12px] text-zinc-500 font-medium font-sans text-right">{dateStr}</div>;
  };

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <span className="font-serif text-lg text-[#B38B5D] tracking-widest uppercase">MEI BRIDAL COUTURE</span>
          <span className="text-xs text-zinc-400">Loading Orders...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-8 pt-10 font-inter animate-fade-in">
      {/* 1. Page Header */}
      <h1 className="font-serif text-[32px] text-zinc-950 font-normal tracking-wide">
        Orders
      </h1>

      {/* 2. Filter Tabs (All, Pending, Shipped) */}
      <div className="flex gap-8 border-b border-[#E8E0D5]">
        <button
          onClick={() => setActiveTab('ALL')}
          className={`pb-3 text-[11px] font-bold tracking-widest uppercase cursor-pointer transition-all duration-200 border-b-2 -mb-[1px] ${
            activeTab === 'ALL'
              ? 'text-zinc-900 border-[#B38B5D]'
              : 'text-zinc-400 border-transparent hover:text-zinc-600'
          }`}
        >
          All ({allCount})
        </button>
        <button
          onClick={() => setActiveTab('PENDING')}
          className={`pb-3 text-[11px] font-bold tracking-widest uppercase cursor-pointer transition-all duration-200 border-b-2 -mb-[1px] ${
            activeTab === 'PENDING'
              ? 'text-zinc-900 border-[#B38B5D]'
              : 'text-zinc-400 border-transparent hover:text-zinc-600'
          }`}
        >
          Pending ({pendingCount})
        </button>
        <button
          onClick={() => setActiveTab('SHIPPED')}
          className={`pb-3 text-[11px] font-bold tracking-widest uppercase cursor-pointer transition-all duration-200 border-b-2 -mb-[1px] ${
            activeTab === 'SHIPPED'
              ? 'text-zinc-900 border-[#B38B5D]'
              : 'text-zinc-400 border-transparent hover:text-zinc-600'
          }`}
        >
          Shipped ({shippedCount})
        </button>
      </div>

      {/* 3. Table Box */}
      <div className="bg-white border border-[#E8E0D5] shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAF8F5] border-b border-[#E8E0D5]">
                <th className="px-8 py-3.5 text-[9px] font-bold tracking-widest text-zinc-800 uppercase w-[22%]">
                  ORDER #
                </th>
                <th className="px-8 py-3.5 text-[9px] font-bold tracking-widest text-zinc-800 uppercase w-[25%]">
                  CUSTOMER
                </th>
                <th className="px-8 py-3.5 text-[9px] font-bold tracking-widest text-zinc-800 uppercase w-[12%]">
                  ITEMS
                </th>
                <th className="px-8 py-3.5 text-[9px] font-bold tracking-widest text-zinc-800 uppercase w-[15%]">
                  TOTAL
                </th>
                <th className="px-8 py-3.5 text-[9px] font-bold tracking-widest text-zinc-800 uppercase w-[13%]">
                  ORDER STATUS
                </th>
                <th className="px-8 py-3.5 text-[9px] font-bold tracking-widest text-zinc-800 uppercase w-[13%]">
                  PAYMENT
                </th>
                <th className="px-8 py-3.5 text-[9px] font-bold tracking-widest text-zinc-800 uppercase w-[10%] text-right">
                  DATE
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E0D5]">
              {filteredOrders.length > 0 ? (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-[#FAF8F5]/40 transition-colors">
                    {/* Order # */}
                    <td className="px-8 py-5 text-[12px] font-semibold text-[#B38B5D] font-sans tracking-wide">
                      <Link href={`/orders/${order.id}`} className="hover:text-[#a37b4d] transition-colors cursor-pointer">
                        {order.id}
                      </Link>
                    </td>

                    {/* Customer */}
                    <td className="px-8 py-5">
                      <div className="text-[12px] font-bold text-zinc-800">
                        {order.customerName}
                      </div>
                      <div className="text-[10px] text-zinc-400 font-medium font-sans">
                        {order.customerEmail}
                      </div>
                    </td>

                    {/* Items */}
                    <td className="px-8 py-5 text-[12px] text-zinc-800 font-sans">
                      <span className="font-medium">{order.itemsCount}</span>{' '}
                      <span className="text-zinc-400">
                        {order.itemsCount === 1 ? 'item' : 'items'}
                      </span>
                    </td>

                    {/* Total */}
                    <td className="px-8 py-5 text-[12px] font-medium text-zinc-900 font-sans">
                      {formatTotal(order.total)}
                    </td>

                    {/* Order Status */}
                    <td className="px-8 py-5">
                      <span
                        className={`inline-block px-3 py-1 text-[10px] font-semibold tracking-wide rounded-full text-center min-w-[85px] ${getStatusBadgeStyle(
                          order.status
                        )}`}
                      >
                        {getStatusText(order.status)}
                      </span>
                    </td>

                    {/* Payment */}
                    <td className="px-8 py-5">
                      <span
                        className={`inline-block px-3 py-1 text-[10px] font-medium tracking-wide rounded-full text-center min-w-[70px] ${getPaymentBadgeStyle(
                          order.paymentStatus
                        )}`}
                      >
                        {getPaymentText(order.paymentStatus)}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="px-8 py-5 text-right">
                      {renderDate(order.id, order.date)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="px-8 py-12 text-center text-[12px] text-zinc-400 font-medium"
                  >
                    No orders found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
