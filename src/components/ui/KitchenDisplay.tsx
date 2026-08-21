'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CheckCircle2, ChefHat, Play, AlertCircle, Package } from 'lucide-react';

interface KDSOrderItem {
  id: string;
  itemName: string;
  quantity: number;
  notes: string | null;
  modifiers: { modifierName: string }[];
}

interface KDSOrder {
  id: string;
  orderNumber: number;
  tableNumber: string | null;
  status: 'PENDING' | 'PAID' | 'PREPARING' | 'READY';
  items: KDSOrderItem[];
  createdAt: string;
  paidAt: string | null;
}

export default function KitchenDisplay({ tenantId }: { tenantId?: string }) {
  const [activeTab, setActiveTab] = useState<'orders' | 'stock'>('orders');
  const [orders, setOrders] = useState<KDSOrder[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch initial orders
  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab === 'stock' && tenantId) {
      fetchMenuItems();
    }
  }, [activeTab, tenantId]);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/kds/orders');
      const data = await res.json();
      if (data.success) {
        setOrders(data.data);
      }
    } catch (e) {
      console.error('Failed to fetch orders', e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMenuItems = async () => {
    try {
      const res = await fetch(`/api/menu/items?tenant_id=${tenantId}&include_all=true`);
      const data = await res.json();
      if (data.success) {
        setMenuItems(data.data);
      }
    } catch (e) {
      console.error('Failed to fetch menu items', e);
    }
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
    // Optimistic update
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus as any } : o)).filter((o) => o.status !== 'COMPLETED')
    );

    try {
      await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (e) {
      fetchOrders();
    }
  };

  const toggleStock = async (itemId: string, currentAvailable: boolean) => {
    // Optimistic update
    setMenuItems(prev => prev.map(item => item.id === itemId ? { ...item, isAvailable: !currentAvailable } : item));
    try {
      await fetch(`/api/menu/items/${itemId}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: !currentAvailable }),
      });
    } catch (e) {
      fetchMenuItems();
    }
  };

  // Group orders by status
  const pending = orders.filter((o) => o.status === 'PENDING' || o.status === 'PAID');
  const preparing = orders.filter((o) => o.status === 'PREPARING');
  const ready = orders.filter((o) => o.status === 'READY');

  const TicketCard = ({ order, actionBtn }: { order: KDSOrder, actionBtn: React.ReactNode }) => {
    const waitTime = Math.floor((new Date().getTime() - new Date(order.createdAt).getTime()) / 60000);
    const isUrgent = waitTime > 15;

    return (
      <motion.div layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
        className={`flex flex-col bg-gray-900 rounded-3xl p-5 shadow-2xl border ${isUrgent ? 'border-red-500/50' : 'border-gray-800'}`}>
        <div className="flex justify-between items-start mb-4 border-b border-gray-800 pb-4">
          <div>
            <h3 className="text-3xl font-black text-white">#{order.orderNumber}</h3>
            {order.tableNumber && (
              <span className="inline-flex items-center mt-2 px-3 py-1 rounded-lg bg-gray-800 text-gray-300 font-bold text-sm">
                Table {order.tableNumber}
              </span>
            )}
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-sm ${isUrgent ? 'bg-red-500/20 text-red-400' : 'bg-gray-800 text-gray-400'}`}>
            <Clock className="w-4 h-4" />{waitTime}m
          </div>
        </div>
        <div className="flex-1 overflow-y-auto mb-4 space-y-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex gap-3">
              <span className="font-black text-xl text-primary-light bg-gray-800 h-8 w-8 rounded-lg flex items-center justify-center shrink-0">{item.quantity}</span>
              <div>
                <p className="font-bold text-lg text-white leading-tight">{item.itemName}</p>
                {item.modifiers.length > 0 && <p className="text-sm text-gray-400 mt-1">+ {item.modifiers.map(m => m.modifierName).join(', ')}</p>}
                {item.notes && <p className="text-sm text-amber-400/90 font-medium mt-1.5 bg-amber-400/10 px-2 py-1 rounded-md border border-amber-400/20 flex items-start gap-1.5"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{item.notes}</p>}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-auto pt-4 border-t border-gray-800">{actionBtn}</div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-black font-brand p-6">
      <header className="flex justify-between items-center mb-8 bg-gray-900 p-4 rounded-3xl border border-gray-800">
        <div className="flex items-center gap-6">
          <div className="bg-primary p-3 rounded-2xl"><ChefHat className="w-8 h-8 text-white" /></div>
          <div>
            <h1 className="text-2xl font-black text-white">Lumina Kitchen</h1>
            <p className="text-gray-400 font-medium flex items-center gap-2">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>
              Live Sync Active
            </p>
          </div>
          
          <div className="ml-8 flex bg-gray-800 p-1 rounded-2xl">
            <button onClick={() => setActiveTab('orders')} className={`px-6 py-2 rounded-xl font-bold transition-all ${activeTab === 'orders' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-white'}`}>Live Orders</button>
            <button onClick={() => setActiveTab('stock')} className={`px-6 py-2 rounded-xl font-bold transition-all ${activeTab === 'stock' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-white'}`}>Menu Stock</button>
          </div>
        </div>
      </header>

      {activeTab === 'orders' ? (
        <main className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
          <section className="flex flex-col bg-gray-900/50 rounded-[2.5rem] p-6 border border-gray-800">
            <h2 className="text-xl font-black text-white mb-6 flex items-center gap-2"><span className="bg-blue-500 w-3 h-3 rounded-full" /> New Orders</h2>
            <div className="flex flex-col gap-4 overflow-y-auto pr-2 scrollbar-hide">
              <AnimatePresence>
                {pending.map((order) => <TicketCard key={order.id} order={order} actionBtn={<button onClick={() => updateStatus(order.id, 'PREPARING')} className="w-full flex justify-center items-center gap-2 py-4 bg-primary hover:bg-primary-light text-white rounded-2xl font-black text-lg transition-colors active:scale-95"><Play className="w-5 h-5 fill-current" /> Start Cooking</button>} />)}
              </AnimatePresence>
            </div>
          </section>

          <section className="flex flex-col bg-gray-900/50 rounded-[2.5rem] p-6 border border-gray-800">
            <h2 className="text-xl font-black text-white mb-6 flex items-center gap-2"><span className="bg-amber-500 w-3 h-3 rounded-full" /> Preparing</h2>
            <div className="flex flex-col gap-4 overflow-y-auto pr-2 scrollbar-hide">
              <AnimatePresence>
                {preparing.map((order) => <TicketCard key={order.id} order={order} actionBtn={<button onClick={() => updateStatus(order.id, 'READY')} className="w-full flex justify-center items-center gap-2 py-4 bg-green-500 hover:bg-green-400 text-white rounded-2xl font-black text-lg transition-colors active:scale-95"><CheckCircle2 className="w-6 h-6" /> Mark Ready</button>} />)}
              </AnimatePresence>
            </div>
          </section>

          <section className="flex flex-col bg-gray-900/50 rounded-[2.5rem] p-6 border border-gray-800">
            <h2 className="text-xl font-black text-white mb-6 flex items-center gap-2"><span className="bg-green-500 w-3 h-3 rounded-full" /> Ready for Pickup</h2>
            <div className="flex flex-col gap-4 overflow-y-auto pr-2 scrollbar-hide opacity-60">
              <AnimatePresence>
                {ready.map((order) => <TicketCard key={order.id} order={order} actionBtn={<button onClick={() => updateStatus(order.id, 'COMPLETED')} className="w-full py-4 bg-gray-800 text-gray-400 rounded-2xl font-bold text-lg hover:bg-gray-700 transition-colors active:scale-95">Complete Order</button>} />)}
              </AnimatePresence>
            </div>
          </section>
        </main>
      ) : (
        <main className="bg-gray-900 rounded-[2.5rem] p-8 border border-gray-800 min-h-[calc(100vh-140px)]">
          <h2 className="text-2xl font-black text-white mb-8 flex items-center gap-3">
            <Package className="w-6 h-6 text-gray-400" /> Mark Items Out of Stock
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {menuItems.map(item => (
              <div key={item.id} className={`flex items-center justify-between p-5 rounded-2xl border ${item.isAvailable ? 'bg-gray-800 border-gray-700' : 'bg-red-500/10 border-red-500/30'}`}>
                <div>
                  <h3 className={`font-bold text-lg ${item.isAvailable ? 'text-white' : 'text-red-400 line-through'}`}>{item.name}</h3>
                  <p className="text-gray-400 text-sm">₹{item.price}</p>
                </div>
                <button 
                  onClick={() => toggleStock(item.id, item.isAvailable)}
                  className={`px-4 py-2 rounded-xl font-bold text-sm transition-all active:scale-95 ${item.isAvailable ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-green-500 text-white hover:bg-green-400 shadow-lg shadow-green-500/20'}`}
                >
                  {item.isAvailable ? 'Mark Out of Stock' : 'Mark Available'}
                </button>
              </div>
            ))}
            {menuItems.length === 0 && <p className="text-gray-500 font-bold p-4">No menu items found.</p>}
          </div>
        </main>
      )}
    </div>
  );
}
