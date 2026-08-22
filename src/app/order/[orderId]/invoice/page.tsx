'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Download, Receipt } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';

export default function InvoicePage({ params }: { params: { orderId: string } }) {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
          <h1 className="text-3xl font-black text-gray-900">Payment Successful</h1>
          <p className="text-gray-500 font-bold mt-2 text-lg">Your food is being prepared!</p>
        </motion.div>

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
              <p>TOTAL PAID</p>
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
