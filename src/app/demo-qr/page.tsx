'use client';

import { motion } from 'framer-motion';
import { QrCode, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function DemoQRPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-6 relative font-brand">
      <Link href="/" className="absolute top-8 left-8 flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors font-bold">
        <ArrowLeft className="w-5 h-5" /> Back
      </Link>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm"
      >
        <div className="bg-white rounded-[2.5rem] p-10 shadow-[0_30px_60px_rgba(0,0,0,0.08)] border border-gray-100 flex flex-col items-center text-center">
          <div className="bg-gray-50 p-6 rounded-[2rem] mb-8 border border-gray-100">
            {/* Mock QR Code Visual */}
            <div className="w-48 h-48 bg-gray-900 rounded-3xl flex items-center justify-center relative overflow-hidden">
               <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,white_2px,transparent_2px)] bg-[length:12px_12px]" />
               <QrCode className="w-20 h-20 text-white" />
            </div>
          </div>
          
          <h2 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">Table 4</h2>
          <p className="text-gray-500 font-medium leading-relaxed mb-8">Scan this QR code with your phone camera to open the immersive interactive menu.</p>
          
          <Link href="/menu" className="w-full">
            <button className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold text-[16px] active:scale-95 transition-all shadow-lg hover:shadow-xl">
              Open Menu Directly
            </button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
