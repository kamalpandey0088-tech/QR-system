'use client';

import { motion } from 'framer-motion';

/**
 * Premium 3D Background using Framer Motion and Pure CSS.
 * (Replaced React Three Fiber to prevent the React 18/19 SSR Engine crash).
 */
export default function ThreeBackground() {
  return (
    <div className="fixed inset-0 -z-10 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden perspective-[1200px]">
      {/* 3D Floating Crystal Object */}
      <motion.div 
        animate={{ 
          rotateX: [0, 360], 
          rotateY: [0, 360], 
          rotateZ: [0, 180] 
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-64 h-64 opacity-40 mix-blend-screen"
        style={{ transformStyle: 'preserve-3d' }}
      >
        <div className="absolute inset-0 border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 backdrop-blur-3xl" style={{ transform: 'translateZ(100px)' }} />
        <div className="absolute inset-0 border border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 backdrop-blur-3xl" style={{ transform: 'rotateY(90deg) translateZ(100px)' }} />
        <div className="absolute inset-0 border border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur-3xl" style={{ transform: 'rotateX(90deg) translateZ(100px)' }} />
      </motion.div>

      {/* Floating Orbs */}
      <motion.div 
        animate={{ y: [0, -40, 0], x: [0, 20, 0] }} 
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px]"
      />
      <motion.div 
        animate={{ y: [0, 50, 0], x: [0, -30, 0] }} 
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/20 rounded-full blur-[100px]"
      />
      
      {/* Soft overlay gradient to ensure text readability */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] pointer-events-none" />
    </div>
  );
}
