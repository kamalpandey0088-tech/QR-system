'use client';

import { motion } from 'framer-motion';
import { ArrowRight, QrCode, ChefHat, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const ThreeBackground = dynamic(() => import('@/components/ui/ThreeBackground'), { ssr: false });

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.2, delayChildren: 0.3 },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring' as const, stiffness: 100, damping: 10 },
  },
};

export default function LandingPage() {
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* 3D Immersive Background */}
      <ThreeBackground />

      {/* Main Content with Glassmorphism */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-5xl px-6 py-12 flex flex-col items-center text-center"
      >
        <motion.div
          variants={itemVariants}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 backdrop-blur-md border border-white/60 shadow-sm mb-8"
        >
          <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium text-gray-800">Lumina OS v2.0 is live</span>
        </motion.div>

        <motion.h1
          variants={itemVariants}
          className="text-6xl md:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-gray-900 to-gray-600 mb-6"
        >
          Redefine <br />
          <span className="italic font-light">Dining.</span>
        </motion.h1>

        <motion.p
          variants={itemVariants}
          className="text-lg md:text-xl text-gray-600 max-w-2xl mb-12 font-medium"
        >
          An award-winning, zero-friction POS and Kitchen Display System. 
          Scan, order, and cook with fluid precision and completely free payments.
        </motion.p>

        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 w-full justify-center">
          <Link href="/login">
            <button className="group relative w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-gray-900 text-white rounded-2xl overflow-hidden transition-transform active:scale-95">
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
              <span className="font-semibold text-lg relative">Access Dashboard</span>
              <ArrowRight className="w-5 h-5 relative group-hover:translate-x-1 transition-transform" />
            </button>
          </Link>

          <Link href="/demo-qr">
            <button className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/60 backdrop-blur-lg border border-white/80 text-gray-900 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:bg-white/80 transition-all active:scale-95">
              <QrCode className="w-5 h-5" />
              <span className="font-semibold text-lg">Scan Demo QR</span>
            </button>
          </Link>
        </motion.div>

        {/* Feature Cards */}
        <motion.div
          variants={containerVariants}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 w-full"
        >
          {[
            { icon: QrCode, title: "Zero-Friction QR", desc: "No app downloads. Instant browser-based menus with direct UPI payments." },
            { icon: ChefHat, title: "Auto-Refreshing KDS", desc: "Reliable kitchen displays with a 5-second sync and smooth drag-and-drop workflow." },
            { icon: BarChart3, title: "Deep Analytics", desc: "Track revenue, top items, and live order statuses instantly." },
          ].map((feature, i) => (
            <motion.div
              key={i}
              variants={itemVariants}
              whileHover={{ y: -5 }}
              className="p-6 rounded-3xl bg-white/40 backdrop-blur-xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col items-start text-left"
            >
              <div className="p-3 bg-gray-900 text-white rounded-2xl mb-4 shadow-lg">
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-gray-600 font-medium">{feature.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </main>
  );
}
