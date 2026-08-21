'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChefHat, Clock, Play, CheckCircle2, Package, AlertCircle, LogOut, Flame } from 'lucide-react';
import { signOut } from 'next-auth/react';

type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  notes?: string;
  modifiers?: any; // Adjust based on your schema
};

type Order = {
  id: string;
  orderNumber: string;
  tableNumber: string;
  createdAt: string;
  status: 'PENDING' | 'PAID' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';
  items: OrderItem[];
};

type MenuItem = {
  id: string;
  name: string;
  isAvailable: boolean;
  category: {
    name: string;
  };
};

export default function KitchenDisplay({ tenantId }: { tenantId: string }) {
  const [activeTab, setActiveTab] = useState<'orders' | 'stock'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch orders
  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/kds/orders');
      if (res.ok) {
        const data = await res.json();
        // Placeholder for sound notification when new orders arrive
        // if (data.length > orders.length) playNewOrderSound();
        setOrders(data);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
  };

  // Fetch menu items for stock
  const fetchMenuItems = async () => {
    try {
      const res = await fetch(`/api/menu/items?tenantId=${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setMenuItems(data);
      }
    } catch (error) {
      console.error('Failed to fetch menu items:', error);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab === 'stock') {
      fetchMenuItems();
    }
  }, [activeTab, tenantId]);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchOrders();
      }
    } catch (error) {
      console.error('Failed to update order status:', error);
    }
  };

  const toggleStock = async (itemId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/menu/items/${itemId}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: !currentStatus }),
      });
      if (res.ok) {
        fetchMenuItems();
      }
    } catch (error) {
      console.error('Failed to toggle stock:', error);
    }
  };

  const pendingOrders = orders.filter((o) => ['PENDING', 'PAID'].includes(o.status));
  const preparingOrders = orders.filter((o) => o.status === 'PREPARING');
  const readyOrders = orders.filter((o) => o.status === 'READY');

  const getWaitTimeMinutes = (createdAt: string) => {
    const diffMs = currentTime.getTime() - new Date(createdAt).getTime();
    return Math.floor(diffMs / 60000);
  };

  const renderOrderCard = (order: Order, type: 'pending' | 'preparing' | 'ready') => {
    const waitTime = getWaitTimeMinutes(order.createdAt);
    const isUrgent = waitTime > 15;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        key={order.id}
        className={`relative flex flex-col p-5 rounded-2xl backdrop-blur-md bg-white/5 border ${
          isUrgent && (type === 'pending' || type === 'preparing')
            ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
            : 'border-white/10'
        } overflow-hidden`}
      >
        {isUrgent && (type === 'pending' || type === 'preparing') && (
          <motion.div
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute inset-0 bg-red-500/5 pointer-events-none"
          />
        )}
        
        <div className="flex justify-between items-start mb-4 z-10">
          <div>
            <span className="text-2xl font-bold text-white tracking-tight">#{order.orderNumber}</span>
            <div className="text-gray-400 text-sm mt-1">Table {order.tableNumber}</div>
          </div>
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
              isUrgent ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-gray-300'
            }`}
          >
            <Clock className="w-4 h-4" />
            {waitTime}m
          </div>
        </div>

        <div className="flex-1 space-y-3 mb-6 z-10 overflow-y-auto max-h-[250px] pr-2 scrollbar-thin scrollbar-thumb-white/10">
          {order.items.map((item) => (
            <div key={item.id} className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white font-semibold">
                {item.quantity}
              </div>
              <div>
                <div className="text-white font-medium">{item.name}</div>
                {item.modifiers && (
                  <div className="text-gray-400 text-xs mt-0.5">
                    {Array.isArray(item.modifiers) ? item.modifiers.join(', ') : JSON.stringify(item.modifiers)}
                  </div>
                )}
                {item.notes && (
                  <div className="text-amber-400/80 text-sm mt-1 bg-amber-400/10 px-2 py-1 rounded">
                    Note: {item.notes}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-auto z-10">
          {type === 'pending' && (
            <button
              onClick={() => updateOrderStatus(order.id, 'PREPARING')}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 hover:shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all duration-300 active:scale-95"
            >
              <Flame className="w-5 h-5" />
              Start Cooking
            </button>
          )}
          {type === 'preparing' && (
            <button
              onClick={() => updateOrderStatus(order.id, 'READY')}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all duration-300 active:scale-95"
            >
              <CheckCircle2 className="w-5 h-5" />
              Mark Ready
            </button>
          )}
          {type === 'ready' && (
            <button
              onClick={() => updateOrderStatus(order.id, 'COMPLETED')}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-gray-300 bg-white/10 hover:bg-white/20 hover:text-white transition-all duration-300 active:scale-95"
            >
              <Package className="w-5 h-5" />
              Complete Order
            </button>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0A0E17] text-white overflow-hidden relative selection:bg-indigo-500/30">
      {/* Background Animated Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 150, repeat: Infinity, ease: 'linear' }}
          className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] rounded-full bg-blue-900/10 blur-[120px]"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 200, repeat: Infinity, ease: 'linear' }}
          className="absolute -bottom-[20%] -right-[10%] w-[60vw] h-[60vw] rounded-full bg-emerald-900/10 blur-[120px]"
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[30%] left-[40%] w-[40vw] h-[40vw] rounded-full bg-purple-900/10 blur-[100px]"
        />
      </div>

      <div className="relative z-10 flex flex-col h-screen">
        {/* Header */}
        <header className="relative backdrop-blur-xl bg-[#0A0E17]/80 border-b border-white/10 px-8 py-5">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500" />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <ChefHat className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                    Kitchen Display
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    <span className="text-sm text-emerald-400 font-medium">Live Server</span>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex bg-white/5 p-1.5 rounded-2xl backdrop-blur-sm border border-white/5 ml-4">
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`relative px-6 py-2.5 text-sm font-semibold rounded-xl transition-colors ${
                    activeTab === 'orders' ? 'text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {activeTab === 'orders' && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-white/10 rounded-xl"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <Play className="w-4 h-4" />
                    Active Orders
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('stock')}
                  className={`relative px-6 py-2.5 text-sm font-semibold rounded-xl transition-colors ${
                    activeTab === 'stock' ? 'text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {activeTab === 'stock' && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-white/10 rounded-xl"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Item Stock
                  </span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-3xl font-light tabular-nums tracking-tight">
                  {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="text-gray-400 text-sm">
                  {currentTime.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
                </div>
              </div>
              <button 
                onClick={() => signOut()}
                className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all active:scale-95 text-gray-400"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            {activeTab === 'orders' ? (
              <motion.div
                key="orders-view"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="h-full grid grid-cols-1 md:grid-cols-3 gap-6 p-8 overflow-hidden"
              >
                {/* Pending Column */}
                <div className="flex flex-col h-full bg-white/[0.02] border border-white/5 rounded-3xl overflow-hidden backdrop-blur-sm">
                  <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-white/[0.01]">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)]" />
                      <h2 className="text-lg font-semibold text-gray-200">New Orders</h2>
                    </div>
                    <div className="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full text-sm font-bold border border-blue-500/20">
                      {pendingOrders.length}
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
                    <AnimatePresence mode="popLayout">
                      {pendingOrders.map((order) => renderOrderCard(order, 'pending'))}
                    </AnimatePresence>
                    {pendingOrders.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
                        <Package className="w-12 h-12 opacity-20" />
                        <p>No pending orders</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Preparing Column */}
                <div className="flex flex-col h-full bg-white/[0.02] border border-white/5 rounded-3xl overflow-hidden backdrop-blur-sm">
                  <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-white/[0.01]">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.6)] animate-pulse" />
                      <h2 className="text-lg font-semibold text-gray-200">Preparing</h2>
                    </div>
                    <div className="bg-amber-500/10 text-amber-400 px-3 py-1 rounded-full text-sm font-bold border border-amber-500/20">
                      {preparingOrders.length}
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
                    <AnimatePresence mode="popLayout">
                      {preparingOrders.map((order) => renderOrderCard(order, 'preparing'))}
                    </AnimatePresence>
                    {preparingOrders.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
                        <Flame className="w-12 h-12 opacity-20" />
                        <p>Nothing being prepared</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ready Column */}
                <div className="flex flex-col h-full bg-white/[0.02] border border-white/5 rounded-3xl overflow-hidden backdrop-blur-sm">
                  <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-white/[0.01]">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]" />
                      <h2 className="text-lg font-semibold text-gray-200">Ready for Pickup</h2>
                    </div>
                    <div className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-sm font-bold border border-emerald-500/20">
                      {readyOrders.length}
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
                    <AnimatePresence mode="popLayout">
                      {readyOrders.map((order) => renderOrderCard(order, 'ready'))}
                    </AnimatePresence>
                    {readyOrders.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
                        <CheckCircle2 className="w-12 h-12 opacity-20" />
                        <p>No orders ready</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="stock-view"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="h-full p-8 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10"
              >
                <div className="max-w-4xl mx-auto space-y-6">
                  {Object.entries(
                    menuItems.reduce((acc, item) => {
                      const cat = item.category?.name || 'Uncategorized';
                      if (!acc[cat]) acc[cat] = [];
                      acc[cat].push(item);
                      return acc;
                    }, {} as Record<string, MenuItem[]>)
                  ).map(([category, items]) => (
                    <div key={category} className="bg-white/[0.02] border border-white/5 rounded-3xl overflow-hidden backdrop-blur-sm">
                      <div className="px-6 py-4 bg-white/[0.03] border-b border-white/5">
                        <h3 className="text-lg font-semibold text-white">{category}</h3>
                      </div>
                      <div className="divide-y divide-white/5">
                        {items.map((item) => (
                          <div key={item.id} className="p-6 flex items-center justify-between hover:bg-white/[0.01] transition-colors">
                            <div>
                              <div className="text-lg font-medium text-white">{item.name}</div>
                              <div className={`text-sm mt-1 ${item.isAvailable ? 'text-emerald-400' : 'text-red-400'}`}>
                                {item.isAvailable ? 'In Stock' : 'Out of Stock'}
                              </div>
                            </div>
                            <button
                              onClick={() => toggleStock(item.id, item.isAvailable)}
                              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none ${
                                item.isAvailable ? 'bg-emerald-500' : 'bg-gray-600'
                              }`}
                            >
                              <span
                                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                                  item.isAvailable ? 'translate-x-7' : 'translate-x-1'
                                } shadow-md`}
                              />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  
                  {menuItems.length === 0 && (
                    <div className="text-center text-gray-500 mt-20">
                      Loading menu items or no items found.
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
