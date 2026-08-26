'use client';

import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { useState, useEffect } from 'react';

export default function DemoQRPage() {
  const [isNavigating, setIsNavigating] = useState(false);
  const [qrUrl, setQrUrl] = useState('');

  useEffect(() => {
    // Generate the exact URL for table 4 dynamically based on whatever domain they are on
    if (typeof window !== 'undefined') {
      setQrUrl(`${window.location.origin}/menu?table=4`);
    }
  }, []);

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
          
          {/* REAL, SCANNABLE QR CODE */}
          <div className="bg-white p-4 rounded-[2rem] mb-8 border-2 border-gray-100 shadow-sm flex items-center justify-center">
            {qrUrl ? (
              <QRCodeSVG 
                value={qrUrl} 
                size={200} 
                bgColor="#ffffff"
                fgColor="#000000"
                level="H"
                includeMargin={false}
              />
            ) : (
              <div className="w-[200px] h-[200px] bg-gray-100 animate-pulse rounded-2xl" />
            )}
          </div>
          
          <h2 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">Table 4</h2>
          <p className="text-gray-500 font-medium leading-relaxed mb-8">
            Scan this real QR code, or tap the button below to open the menu directly on this device!
          </p>
          
          <Link href="/menu?table=4" className="w-full" onClick={() => setIsNavigating(true)}>
            <button className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold text-[16px] active:scale-95 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2">
              {isNavigating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Opening Menu...
                </>
              ) : (
                'Open Menu Directly'
              )}
            </button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
