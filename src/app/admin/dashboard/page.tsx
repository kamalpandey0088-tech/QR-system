'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  ChefHat, 
  Clock,
  ArrowRight,
  LogOut,
  Activity
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';

// Simple count up component
const CountUp = ({ to, prefix = '', suffix = '', decimals = 0 }: { to: number, prefix?: string, suffix?: string, decimals?: number }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    const duration = 1500;
    
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // ease out expo
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(easeProgress * to);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [to]);

  return <span>{prefix}{count.toFixed(decimals)}{suffix}</span>;
};

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/admin/dashboard');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#0B0F1A] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-cyan-400 font-medium tracking-widest uppercase">Initializing Systems...</p>
        </div>
      </div>
    );
  }

  const {
    todayRevenue = 0,
    monthRevenue = 0,
    todayOrderCount = 0,
    activeOrderCount = 0,
    topSellingItems = [],
    ordersByStatus = [],
    recentOrders = [],
    last7DaysRevenue = []
  } = data || {};

  const maxRevenue = Math.max(...last7DaysRevenue.map((d: any) => d.revenue), 1);
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
      PAID: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
      PREPARING: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
      READY: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
      COMPLETED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
      CANCELLED: 'bg-red-500/20 text-red-400 border-red-500/50',
    };
    return colors[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/50';
  };

  const getRankBadge = (index: number) => {
    if (index === 0) return 'bg-yellow-400 text-yellow-900 ring-yellow-400/50 shadow-[0_0_15px_rgba(250,204,21,0.5)]';
    if (index === 1) return 'bg-slate-300 text-slate-900 ring-slate-300/50 shadow-[0_0_15px_rgba(203,213,225,0.3)]';
    if (index === 2) return 'bg-amber-600 text-amber-50 ring-amber-600/50 shadow-[0_0_15px_rgba(217,119,6,0.4)]';
    return 'bg-white/10 text-white/70';
  };

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-slate-200 p-6 md:p-8 relative overflow-hidden font-sans">
      {/* Floating Animated Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[35%] h-[35%] bg-cyan-600/20 rounded-full blur-[100px] pointer-events-none" style={{ animation: 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />

      <motion.div 
        className="max-w-7xl mx-auto relative z-10"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60 tracking-tight">
              Overview
            </h1>
            <div className="flex items-center gap-2 mt-2 text-sm text-slate-400">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              Live updates active • Last refreshed just now
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link 
              href="/kitchen" 
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg backdrop-blur-sm transition-all text-sm font-medium"
            >
              <ChefHat size={16} />
              Go to Kitchen
            </Link>
            <button 
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg backdrop-blur-sm transition-all text-sm font-medium"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div variants={itemVariants} className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-2xl relative overflow-hidden group hover:border-cyan-500/30 transition-all">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm font-medium mb-1">Today's Revenue</p>
                <h3 className="text-3xl font-bold text-white tracking-tight">
                  <CountUp to={todayRevenue} prefix="₹" decimals={2} />
                </h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                <DollarSign size={20} />
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all" />
          </motion.div>

          <motion.div variants={itemVariants} className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-2xl relative overflow-hidden group hover:border-emerald-500/30 transition-all">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm font-medium mb-1">Monthly Revenue</p>
                <h3 className="text-3xl font-bold text-white tracking-tight">
                  <CountUp to={monthRevenue} prefix="₹" decimals={2} />
                </h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <TrendingUp size={20} />
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" />
          </motion.div>

          <motion.div variants={itemVariants} className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-2xl relative overflow-hidden group hover:border-purple-500/30 transition-all">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm font-medium mb-1">Today's Orders</p>
                <h3 className="text-3xl font-bold text-white tracking-tight">
                  <CountUp to={todayOrderCount} />
                </h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">
                <ShoppingBag size={20} />
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all" />
          </motion.div>

          <motion.div variants={itemVariants} className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-2xl relative overflow-hidden group hover:border-amber-500/30 transition-all">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm font-medium mb-1">Active Kitchen</p>
                <h3 className="text-3xl font-bold text-white tracking-tight">
                  <CountUp to={activeOrderCount} />
                </h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400">
                <Activity size={20} />
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all" />
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Sparkline Chart */}
          <motion.div variants={itemVariants} className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-2xl lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-white">Revenue (Last 7 Days)</h3>
            </div>
            <div className="h-48 flex items-end justify-between gap-2 pt-4">
              {last7DaysRevenue.map((day: any, i: number) => {
                const heightPercent = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0;
                return (
                  <div key={day.date} className="flex flex-col items-center flex-1 gap-2 group cursor-crosshair">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium bg-white/10 px-2 py-1 rounded backdrop-blur-md absolute -mt-10">
                      ₹${day.revenue.toFixed(2)}
                    </div>
                    <div className="w-full bg-white/5 rounded-t-sm relative overflow-hidden h-full flex items-end">
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: `${heightPercent}%` }}
                        transition={{ duration: 1, delay: i * 0.1, ease: "easeOut" }}
                        className="w-full bg-gradient-to-t from-cyan-600/50 to-cyan-400/80 rounded-t-sm"
                      />
                    </div>
                    <span className="text-xs text-slate-500 font-medium">
                      {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Top Selling Items */}
          <motion.div variants={itemVariants} className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-2xl">
            <h3 className="text-lg font-medium text-white mb-6">Top Selling Today</h3>
            <div className="space-y-4">
              {topSellingItems.length > 0 ? topSellingItems.map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ring-1 ${getRankBadge(i)}`}>
                      {i + 1}
                    </span>
                    <span className="font-medium text-slate-200">{item.name}</span>
                  </div>
                  <span className="text-sm text-slate-400 bg-white/5 px-2.5 py-1 rounded-md">
                    {item.quantity}x
                  </span>
                </div>
              )) : (
                <div className="text-slate-500 text-sm text-center py-8">No items sold today yet.</div>
              )}
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Orders Table */}
          <motion.div variants={itemVariants} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl lg:col-span-2 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-lg font-medium text-white">Recent Orders</h3>
              <Link href="/kitchen" className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                View All <ArrowRight size={14} />
              </Link>
            </div>
            <div className="overflow-x-auto p-2">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-xs text-slate-400 uppercase tracking-wider">
                    <th className="p-4 font-medium">Order #</th>
                    <th className="p-4 font-medium">Table</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium">Time</th>
                    <th className="p-4 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recentOrders.length > 0 ? recentOrders.map((order: any) => (
                    <tr key={order.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 font-medium text-slate-300">#{order.orderNumber}</td>
                      <td className="p-4 text-slate-400">{order.tableNumber || '-'}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400 text-sm">
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-4 text-right font-medium text-white">
                        ₹${Number(order.total).toFixed(2)}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">No recent orders found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Order Status Breakdown */}
          <motion.div variants={itemVariants} className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-2xl">
            <h3 className="text-lg font-medium text-white mb-6">Status Breakdown</h3>
            <div className="space-y-5">
              {ordersByStatus.length > 0 ? ordersByStatus.map((statusItem: any) => {
                const percent = (statusItem.count / Math.max(todayOrderCount, 1)) * 100;
                return (
                  <div key={statusItem.status}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-slate-300 capitalize">{statusItem.status.toLowerCase()}</span>
                      <span className="text-slate-400">{statusItem.count} <span className="text-xs text-slate-600">({percent.toFixed(0)}%)</span></span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${percent}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className={`h-full rounded-full ${
                          statusItem.status === 'COMPLETED' ? 'bg-emerald-500' :
                          statusItem.status === 'CANCELLED' ? 'bg-red-500' :
                          statusItem.status === 'PENDING' ? 'bg-yellow-500' :
                          'bg-cyan-500'
                        }`} 
                      />
                    </div>
                  </div>
                );
              }) : (
                <div className="text-slate-500 text-sm text-center py-8">No status data today.</div>
              )}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
