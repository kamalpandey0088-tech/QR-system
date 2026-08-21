'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Package, Clock, LogOut, ArrowRight, Activity, DollarSign } from 'lucide-react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then(res => res.json())
      .then(data => {
        if (data.success) setStats(data.data);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-bold text-gray-500">Loading Dashboard...</div>;
  if (!stats) return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-bold text-red-500">Error loading data. Are you an owner?</div>;

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-6 font-brand">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Owner Dashboard</h1>
            <p className="text-gray-500 font-medium mt-1">Live restaurant performance for today</p>
          </div>
          <div className="flex gap-3">
            <Link href="/kitchen" className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-5 py-2.5 rounded-full font-bold hover:bg-indigo-100 transition-colors">
              Go to Kitchen <ArrowRight className="w-4 h-4" />
            </Link>
            <button onClick={() => signOut({ callbackUrl: '/' })} className="flex items-center gap-2 bg-gray-100 text-gray-700 px-5 py-2.5 rounded-full font-bold hover:bg-gray-200 transition-colors">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>

        {/* Top Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-green-50 rounded-full flex items-center justify-center">
              <DollarSign className="w-10 h-10 text-green-500 opacity-20" />
            </div>
            <p className="text-gray-500 font-bold text-sm uppercase tracking-wider mb-2">Today's Revenue</p>
            <h2 className="text-5xl font-black text-gray-900">₹{stats.todayRevenue}</h2>
            <p className="text-green-600 text-sm font-bold mt-4 flex items-center gap-1"><TrendingUp className="w-4 h-4"/> Live update</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-blue-50 rounded-full flex items-center justify-center">
              <Package className="w-10 h-10 text-blue-500 opacity-20" />
            </div>
            <p className="text-gray-500 font-bold text-sm uppercase tracking-wider mb-2">Total Orders</p>
            <h2 className="text-5xl font-black text-gray-900">{stats.todayOrderCount}</h2>
            <p className="text-blue-600 text-sm font-bold mt-4 flex items-center gap-1"><Activity className="w-4 h-4"/> Paid & completed</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-orange-50 rounded-full flex items-center justify-center">
              <Clock className="w-10 h-10 text-orange-500 opacity-20" />
            </div>
            <p className="text-gray-500 font-bold text-sm uppercase tracking-wider mb-2">Active Kitchen</p>
            <h2 className="text-5xl font-black text-gray-900">{stats.activeOrderCount}</h2>
            <p className="text-orange-600 text-sm font-bold mt-4 flex items-center gap-1"><Clock className="w-4 h-4"/> Being prepared right now</p>
          </motion.div>
        </div>

        {/* Detailed Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="text-xl font-black text-gray-900 mb-6">Top Selling Items 🚀</h3>
            {stats.topSellingItems?.length > 0 ? (
              <div className="space-y-4">
                {stats.topSellingItems.map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center">{i + 1}</div>
                      <span className="font-bold text-gray-900">{item.itemName}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-gray-900">{item.totalQuantity} sold</div>
                      <div className="text-sm font-bold text-green-600">₹{item.totalRevenue} generated</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 font-medium">No sales yet today.</p>
            )}
          </motion.div>
          
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="text-xl font-black text-gray-900 mb-6">Order Status Breakdown</h3>
            <div className="space-y-4">
              {Object.entries(stats.ordersByStatus || {}).map(([status, count]: any) => (
                <div key={status} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                  <span className="font-bold text-gray-700 capitalize">{status.toLowerCase()}</span>
                  <span className="font-black text-xl text-gray-900 bg-white px-4 py-1 rounded-xl shadow-sm">{count}</span>
                </div>
              ))}
              {Object.keys(stats.ordersByStatus || {}).length === 0 && (
                <p className="text-gray-500 font-medium">No active or past orders today.</p>
              )}
            </div>
          </motion.div>
        </div>

      </div>
    </div>
  );
}
