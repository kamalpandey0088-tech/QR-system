'use client';

import { useEffect, useState, use } from 'react';
import { CheckCircle2, Download, Receipt } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';

export default function InvoicePage(props: { params: Promise<{ orderId: string }> }) {
  const params = use(props.params);
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    let interval: any;
    if (order && order.paymentMethod === 'UPI' && !order.paidAt && order.status === 'PENDING') {
      const expiresAt = new Date(order.createdAt).getTime() + 3 * 60 * 1000;
      
      interval = setInterval(() => {
        const remaining = Math.max(0, expiresAt - Date.now());
        setTimeLeft(remaining);
        
        if (remaining === 0) {
          clearInterval(interval);
          // Automatically cancel the order
          fetch(`/api/orders/${order.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'CANCELLED' })
          }).then(() => {
            setOrder({ ...order, status: 'CANCELLED' });
          });
        }
      }, 1000);
      
    }
    return () => { if (interval) clearInterval(interval); };
  }, [order]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };


  useEffect(() => {
    // In a real app we'd fetch from a new GET /api/orders/[orderId]
    // Let's just create that API next!
    fetch(`/api/orders/${params.orderId}`)
      .then(res => res.json())
      .then(data => {
        if(data.success) {
          setOrder(data.data);
        }
        setLoading(false);
      });
  }, [params.orderId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-gray-500">Generating Invoice...</div>;
  if (!order) return <div className="min-h-screen flex items-center justify-center font-bold text-red-500">Invoice not found</div>;

  const config = order.tenant.themeConfig || {};
  const gstin = config.gstin || '27XXXXX0000X1Z5';
  const address = config.address || 'Restaurant Address';

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center py-12 px-4 font-brand">
      <div className="w-full max-w-md">
        
        {/* Success Header */}
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center mb-8">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/30">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black text-gray-900">{order.paymentMethod === 'CASH' ? 'Order Confirmed!' : (order.paymentMethod === 'UPI' && !order.paidAt ? 'Payment Required' : 'Payment Successful')}</h1>
          <p className="text-gray-500 font-bold mt-2 text-lg">Your food is being prepared! {order.paymentMethod === 'CASH' && 'You can pay the waiter at the end of your meal.'}</p>
        </motion.div>

        
        {order.paymentMethod === 'CASH' && (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white rounded-[2rem] p-6 mb-6 shadow-sm border-2 border-gray-200 text-center">
            <h3 className="font-bold text-gray-900 mb-2 text-lg">Pay at Counter / Waiter</h3>
            <p className="text-gray-500 text-sm">Please pay your waiter or at the billing counter after your meal is finished.</p>
          </motion.div>
        )}

        {/* UPI Payment Block */}
        {order.paymentMethod === 'UPI' && !order.paidAt && order.status !== 'CANCELLED' && (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white rounded-[2rem] p-6 mb-6 shadow-sm border-2 border-indigo-500 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 bg-indigo-500 text-white text-[11px] uppercase tracking-widest font-black py-1">
              {timeLeft !== null ? `Action Required • Expires in ${formatTime(timeLeft)}` : 'Action Required'}
            </div>
            <h3 className="font-bold text-gray-900 mt-4 mb-2 text-lg">Pay via UPI to confirm order</h3>
            <p className="text-gray-500 text-sm mb-4">Scan with any UPI app (GPay, PhonePe, Paytm)</p>
            
            {timeLeft !== null && timeLeft <= 60000 && (
              <p className="text-red-500 font-black text-sm mb-4 animate-pulse">Hurry! Payment window closing soon.</p>
            )}
            
            <div className="bg-gray-50 p-4 rounded-2xl inline-block mb-4 border border-gray-200">
              <QRCodeSVG 
                value={`upi://pay?pa=${config.upiId || 'restaurant@upi'}&pn=${encodeURIComponent(config.restaurantName || 'Restaurant')}&am=${order.total}&cu=INR`} 
                size={180} 
                level="H"
              />
            </div>
            
            <a href={`upi://pay?pa=${config.upiId || 'restaurant@upi'}&pn=${encodeURIComponent(config.restaurantName || 'Restaurant')}&am=${order.total}&cu=INR`} 
               className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-bold transition-colors shadow-lg shadow-indigo-200 active:scale-95">
              Tap here to Pay on this Phone
            </a>
          </motion.div>
        )}

        
        {/* Cancelled/Expired Block */}
        {order.status === 'CANCELLED' && (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-red-50 rounded-[2rem] p-6 mb-6 shadow-sm border-2 border-red-500 text-center">
            <h3 className="font-bold text-red-900 mb-2 text-lg">Payment Window Expired</h3>
            <p className="text-red-600 text-sm">This order has been cancelled due to inactivity. Please return to the menu to place a new order.</p>
            <Link href={`/menu?table=${order.tableNumber}`} className="mt-4 inline-block bg-red-600 text-white px-6 py-2 rounded-xl font-bold">
              Return to Menu
            </Link>
          </motion.div>
        )}

        {/* Digital Invoice Ticket */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="bg-white rounded-[2rem] p-8 shadow-2xl shadow-gray-200/50 relative overflow-hidden">
          {/* Header */}
          <div className="text-center border-b-2 border-dashed border-gray-200 pb-6 mb-6">
            <h2 className="text-2xl font-black text-gray-900 uppercase tracking-widest">{order.tenant.name}</h2>
            <p className="text-gray-500 text-sm font-bold mt-1">{address}</p>
            <p className="text-gray-400 text-xs font-bold mt-1">GSTIN: {gstin}</p>
          </div>

          {/* Order Info */}
          <div className="flex justify-between items-center mb-6 text-sm font-bold">
            <div className="text-gray-500">
              <p>Order No: <span className="text-gray-900 font-black">#{order.orderNumber}</span></p>
              <p>Table: <span className="text-gray-900 font-black">{order.tableNumber || 'Takeaway'}</span></p>
            </div>
            <div className="text-right text-gray-500">
              <p>{new Date(order.createdAt).toLocaleDateString()}</p>
              <p>{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-4 mb-6">
            {order.items.map((item: any) => (
              <div key={item.id} className="flex justify-between items-start font-bold">
                <div>
                  <p className="text-gray-900">{item.quantity} x {item.itemName}</p>
                </div>
                <p className="text-gray-900">₹{Number(item.unitPrice) * item.quantity}</p>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t-2 border-dashed border-gray-200 pt-6 space-y-2 font-bold">
            <div className="flex justify-between text-gray-500">
              <p>Subtotal</p>
              <p>₹{Number(order.subtotal)}</p>
            </div>
            <div className="flex justify-between text-gray-500">
              <p>CGST (2.5%)</p>
              <p>₹{Number(order.tax) / 2}</p>
            </div>
            <div className="flex justify-between text-gray-500">
              <p>SGST (2.5%)</p>
              <p>₹{Number(order.tax) / 2}</p>
            </div>
            <div className="flex justify-between text-xl font-black text-gray-900 pt-4 mt-2 border-t border-gray-100">
              <p>{(order.paymentMethod === 'UPI' && !order.paidAt) || order.paymentMethod === 'CASH' ? 'TOTAL DUE' : 'TOTAL PAID'}</p>
              <p>₹{Number(order.total)}</p>
            </div>
            <div className="text-center text-xs font-bold text-gray-400 mt-2 uppercase tracking-widest">
              Paid via {order.paymentMethod}
            </div>
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="mt-8 flex gap-4">
          <Link href={`/menu?table=${order.tableNumber}`} className="flex-1 bg-gray-200 text-gray-900 py-4 rounded-2xl font-black text-center transition-transform active:scale-95">
            Back to Menu
          </Link>
          <button onClick={() => window.print()} className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 transition-transform active:scale-95">
            <Download className="w-5 h-5" /> Save PDF
          </button>
        </motion.div>

      </div>
    </div>
  );
}
