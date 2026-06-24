import React from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Order } from '@/types'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Fetch real stats from Supabase
  const [productsResult, ordersResult, enquiriesResult] = await Promise.all([
    supabase.from('products').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('orders').select('*', { count: 'exact' }).is('deleted_at', null).order('created_at', { ascending: false }).limit(5),
    supabase.from('enquiries').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'NEW')
  ])

  const totalProducts = productsResult.count ?? 0
  const totalOrders = ordersResult.count ?? 0
  const newEnquiries = enquiriesResult.count ?? 0
  const recentOrders = (ordersResult.data ?? []) as Order[]

  // Calculate total revenue from recent orders
  const totalRevenue = recentOrders.reduce((sum, order) => sum + order.total, 0)
  const formattedRevenue = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(totalRevenue)

  // Styling maps for order status badges
  const getStatusStyle = (status: Order['status']) => {
    switch (status) {
      case 'DELIVERED':
        return 'border-[2px] border-[#C8E6C9] bg-[#E8F5E9] text-gray-700'
      case 'SHIPPED':
        return 'border-[2px] border-[#FFE0B2] bg-[#FFF3E0] text-gray-700'
      case 'CONFIRMED':
        return 'border-[2px] border-[#B3E5FC] bg-[#E1F5FE] text-gray-700'
      case 'PROCESSING':
        return 'border-[2px] border-[#D1C4E9] bg-[#F3E5F5] text-gray-700'
      case 'PENDING':
        return 'border-[2px] border-[#FFE082] bg-[#FFF8E1] text-gray-700'
      default:
        return 'border-[2px] border-zinc-200 bg-zinc-50 text-zinc-600'
    }
  }

  return (
    <div className="space-y-8 pb-8 pt-8 px-8  font-inter animate-fade-in">
      
      {/* 1. Statistics Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Total Products */}
        <div className="bg-white border border-[#E8E0D5] p-8 flex flex-col justify-between h-[150px]">
          <span className="text-[10px] font-bold tracking-[0.15em] text-zinc-900 uppercase">
            TOTAL PRODUCTS
          </span>
          <span className="text-[36px] font-bold text-zinc-900 font-sans mt-2">
            {totalProducts}
          </span>
        </div>

        {/* Total Orders */}
        <div className="bg-white border border-[#E8E0D5] p-8 flex flex-col justify-between h-[150px]">
          <span className="text-[10px] font-bold tracking-[0.15em] text-zinc-900 uppercase">
            TOTAL ORDERS
          </span>
          <span className="text-[36px] font-bold text-zinc-900 font-sans mt-2">
            {totalOrders}
          </span>
        </div>

        {/* New Enquiries */}
        <div className="bg-white border border-[#E8E0D5] p-8 flex flex-col justify-between h-[150px] relative">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-[0.15em] text-zinc-900 uppercase">
              NEW ENQUIRIES
            </span>
            <span className="w-2 h-2 bg-[#B38B5D]" />
          </div>
          <span className="text-[36px] font-bold text-zinc-900 font-sans mt-2">
            {newEnquiries}
          </span>
        </div>

        {/* Revenue */}
        <div className="bg-white border border-[#E8E0D5] p-8 flex flex-col justify-between h-[150px]">
          <span className="text-[10px] font-bold tracking-[0.15em] text-zinc-400 uppercase">
            REVENUE
          </span>
          <div className="flex flex-col mt-2">
            <span className="text-[32px] font-bold text-zinc-900 font-sans leading-none">
              {formattedRevenue.replace('INR', '₹')}
            </span>
            <span className="text-[10px] text-zinc-400 mt-1 font-medium">
              Last 30 days
            </span>
          </div>
        </div>

      </div>

      {/* 2. Recent Orders Table Section */}
      <div className="bg-white border border-[#E8E0D5]">
        
        {/* Header of Section */}
        <div className="flex items-center justify-between px-8 py-2.5 border-b border-[#E8E0D5]">
          <h3 className="text-[13px] font-bold tracking-widest text-zinc-800 uppercase font-sans">
            Recent Orders
          </h3>
          <Link 
            href="/orders" 
            className="text-[10px] font-bold tracking-widest text-[#B38B5D] hover:text-[#c9a465] transition-colors flex items-center gap-1.5"
          >
            VIEW ALL <span className="text-[12px] font-sans">→</span>
          </Link>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAF8F5] border-b border-[#E8E0D5]">
                <th className="px-8 py-2.5 text-[9px] font-bold tracking-widest text-zinc-800 uppercase w-[20%]">
                  ORDER #
                </th>
                <th className="px-8 py-2.5 text-[9px] font-bold tracking-widest text-zinc-800 uppercase w-[30%]">
                  CUSTOMER
                </th>
                <th className="px-8 py-2.5 text-[9px] font-bold tracking-widest text-zinc-800 uppercase w-[20%]">
                  TOTAL
                </th>
                <th className="px-8 py-2.5 text-[9px] font-bold tracking-widest text-zinc-800 uppercase w-[15%]">
                  STATUS
                </th>
                <th className="px-8 py-2.5 text-[9px] font-bold tracking-widest text-zinc-800 uppercase w-[15%]">
                  DATE
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E0D5]">
              {recentOrders.map((order) => {
                const formattedTotal = new Intl.NumberFormat('en-IN', {
                  style: 'currency',
                  currency: 'INR',
                  maximumFractionDigits: 0
                }).format(order.total)

                const createdDate = new Date(order.created_at).toLocaleDateString('en-IN')

                return (
                  <tr key={order.id} className="hover:bg-[#FAF8F5]/50 transition-colors">
                    <td className="px-8 py-2.5 text-[12px] font-medium text-gold">
                      {order.order_number}
                    </td>
                    <td className="px-8 py-2.5 text-[12px] font-medium text-zinc-800">
                      {order.customer_id ?? '-'}
                    </td>
                    <td className="px-8 py-2.5 text-[12px] font-medium text-zinc-900 font-sans">
                      {formattedTotal.replace('INR', '₹')}
                    </td>
                    <td className="px-8 py-2.5">
                      <span className={`inline-block px-3 py-1 text-[8px] font-bold tracking-widest rounded-none uppercase text-center min-w-[90px] ${getStatusStyle(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-8 py-2.5 text-[11px] text-zinc-500 font-medium">
                      {createdDate}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}