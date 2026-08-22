'use client';

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Printer, LayoutGrid } from 'lucide-react';
import Link from 'next/link';

export default function QRBuilderPage() {
  const [tableCount, setTableCount] = useState(20);
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(`${window.location.origin}/menu`);
    }
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const tables = Array.from({ length: tableCount }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-[#060B14] font-brand text-slate-200">
      {/* NO PRINT AREA: Controls */}
      <div className="print:hidden p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/admin/dashboard" className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <LayoutGrid className="w-6 h-6 text-indigo-400" />
              Table QR Code Generator
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
              <label className="text-sm font-medium text-slate-400">Total Tables:</label>
              <input 
                type="number" 
                min="1" 
                max="200"
                value={tableCount} 
                onChange={(e) => setTableCount(parseInt(e.target.value) || 1)}
                className="bg-transparent text-white font-bold w-16 outline-none border-b border-white/20 focus:border-indigo-500 text-center"
              />
            </div>
            <button 
              onClick={handlePrint}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-bold transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              Print / Save as PDF
            </button>
          </div>
        </div>
        
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-4 rounded-xl text-sm font-medium mb-8">
          Tip: When printing, make sure to enable "Background Graphics" in your printer settings for the best look.
        </div>
      </div>

      {/* PRINT AREA: The actual grid of QRs */}
      <div className="bg-white text-black min-h-screen print:p-0 p-8">
        <div className="max-w-5xl mx-auto print:max-w-none">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 print:grid-cols-4 gap-8 print:gap-x-4 print:gap-y-12">
            {tables.map(num => (
              <div key={num} className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-200 rounded-3xl print:break-inside-avoid">
                <div className="text-center mb-4">
                  <h3 className="font-black text-2xl tracking-tight text-gray-900">Table {num}</h3>
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mt-1">Scan to Order</p>
                </div>
                
                <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
                  {baseUrl ? (
                    <QRCodeSVG 
                      value={`${baseUrl}?table=${num}`} 
                      size={140} 
                      bgColor="#ffffff"
                      fgColor="#000000"
                      level="H"
                      includeMargin={false}
                    />
                  ) : (
                    <div className="w-[140px] h-[140px] bg-gray-100" />
                  )}
                </div>
                
                <div className="mt-4 flex items-center justify-center gap-2 text-gray-800">
                  {/* Optional branding slot */}
                  <span className="font-bold text-sm">Lumina POS</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
