'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ShoppingBag, Plus, Minus, ChevronRight, QrCode, Flame, Star } from 'lucide-react';
import { useCartStore } from '@/stores/cart-store';

// ─── Steam Particle Component ─────────────────────────────────────────────────
function SteamParticle({ delay = 0, x = 50 }: { delay?: number; x?: number }) {
  return (
    <motion.div
      className="absolute bottom-6 pointer-events-none"
      style={{ left: `${x}%` }}
      initial={{ opacity: 0, y: 0, scale: 0.5 }}
      animate={{
        opacity: [0, 0.6, 0.3, 0],
        y: [-10, -60, -90, -120],
        x: [0, 8, -5, 10],
        scale: [0.5, 1.2, 1.6, 2],
        rotate: [0, 15, -10, 20],
      }}
      transition={{
        duration: 3,
        delay,
        repeat: Infinity,
        ease: 'easeOut',
        repeatDelay: Math.random() * 1,
      }}
    >
      <div className="w-4 h-6 bg-white/20 rounded-full blur-md" />
    </motion.div>
  );
}

// ─── Food Artwork (CSS-art food illustrations with glow) ──────────────────────
const FOOD_THEMES: Record<string, {
  bg: string;
  glow: string;
  plate: string;
  art: React.ReactNode;
  steam: boolean;
  badge?: string;
}> = {
  truffle: {
    bg: 'from-amber-900/80 via-yellow-900/60 to-orange-950/80',
    glow: 'rgba(251,146,60,0.5)',
    plate: 'from-yellow-200 to-amber-100',
    steam: true,
    badge: '🔥 Chef\'s Pick',
    art: (
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Plate */}
        <div className="absolute w-40 h-40 rounded-full bg-gradient-to-br from-slate-100 to-slate-300 shadow-[0_20px_60px_rgba(0,0,0,0.5),inset_0_2px_4px_rgba(255,255,255,0.8)] border-4 border-white/50" />
        {/* Burger bun bottom */}
        <div className="absolute bottom-12 w-28 h-8 rounded-b-full bg-gradient-to-b from-amber-400 to-amber-600 shadow-[0_8px_20px_rgba(0,0,0,0.4)]" />
        {/* Lettuce */}
        <div className="absolute bottom-16 w-32 h-5 rounded-full bg-gradient-to-b from-green-400 to-green-600 shadow-inner" style={{ clipPath: 'ellipse(60% 70% at 50% 50%)' }} />
        {/* Patty */}
        <div className="absolute bottom-[68px] w-28 h-6 rounded-full bg-gradient-to-b from-amber-800 to-stone-900 shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_1px_2px_rgba(255,255,255,0.1)]" />
        {/* Cheese dripping */}
        <div className="absolute bottom-[84px] w-30 h-5 bg-gradient-to-b from-yellow-400 to-amber-500 rounded-full" style={{ width: '7.5rem', clipPath: 'polygon(0% 0%, 100% 0%, 95% 100%, 85% 70%, 75% 100%, 60% 70%, 45% 100%, 30% 70%, 15% 100%, 5% 70%)' }} />
        {/* Bun top */}
        <div className="absolute bottom-[88px] w-28 h-14 rounded-t-full bg-gradient-to-b from-amber-400 via-amber-500 to-amber-700 shadow-[0_-4px_20px_rgba(251,146,60,0.4)]">
          {/* Sesame seeds */}
          {[[30,30],[55,20],[70,35],[45,45],[60,50]].map(([lx, ly], i) => (
            <div key={i} className="absolute w-1.5 h-2.5 bg-amber-200 rounded-full rotate-12" style={{ left: `${lx}%`, top: `${ly}%` }} />
          ))}
        </div>
        {/* Heat shimmer */}
        <motion.div
          animate={{ opacity: [0.3, 0.7, 0.3], scaleX: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute inset-0 bg-gradient-to-t from-orange-500/0 via-orange-400/10 to-orange-300/0 rounded-xl"
        />
      </div>
    ),
  },
  chicken: {
    bg: 'from-red-900/80 via-orange-900/60 to-amber-950/80',
    glow: 'rgba(239,68,68,0.5)',
    plate: 'from-red-100 to-orange-50',
    steam: true,
    badge: '🌶️ Spicy',
    art: (
      <div className="relative w-full h-full flex items-center justify-center">
        <div className="absolute w-40 h-40 rounded-full bg-gradient-to-br from-slate-100 to-slate-300 shadow-[0_20px_60px_rgba(0,0,0,0.5),inset_0_2px_4px_rgba(255,255,255,0.8)] border-4 border-white/50" />
        {/* Bun bottom */}
        <div className="absolute bottom-11 w-28 h-8 rounded-b-full bg-gradient-to-b from-amber-400 to-amber-600 shadow-lg" />
        {/* Jalapeño slaw */}
        <div className="absolute bottom-[62px] w-32 h-4 rounded-full bg-gradient-to-r from-green-500 via-lime-400 to-green-600 opacity-90" />
        {/* Crispy chicken */}
        <div className="absolute bottom-[68px] w-30 h-10 rounded-2xl bg-gradient-to-b from-amber-500 to-amber-800 shadow-[0_6px_20px_rgba(0,0,0,0.5)]" style={{ width: '7rem' }}>
          {/* Crispy texture */}
          {[15,35,55,75].map((tx, i) => (
            <div key={i} className="absolute top-1 h-2 w-3 bg-amber-300/40 rounded-full" style={{ left: `${tx}%` }} />
          ))}
        </div>
        {/* Hot honey drizzle */}
        <div className="absolute bottom-[88px] w-24 h-2">
          {[20,40,60].map((dx, i) => (
            <motion.div key={i} animate={{ scaleY: [1, 1.3, 1] }} transition={{ duration: 1.5, delay: i * 0.3, repeat: Infinity }}
              className="absolute h-6 w-1 bg-gradient-to-b from-amber-500 to-orange-600 rounded-full opacity-80" style={{ left: `${dx}%`, bottom: 0 }} />
          ))}
        </div>
        {/* Bun top */}
        <div className="absolute bottom-[90px] w-28 h-14 rounded-t-full bg-gradient-to-b from-amber-400 via-amber-500 to-amber-700 shadow-[0_-6px_20px_rgba(239,68,68,0.4)]" />
      </div>
    ),
  },
  coffee: {
    bg: 'from-stone-900/80 via-amber-950/60 to-brown-950/80',
    glow: 'rgba(120,53,15,0.6)',
    plate: 'from-stone-200 to-stone-100',
    steam: true,
    badge: '⚡ Nitro',
    art: (
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Glass body */}
        <div className="absolute bottom-8 w-20 h-28 bg-gradient-to-b from-stone-800/80 to-stone-950/90 rounded-b-3xl border border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.15)] overflow-hidden backdrop-blur-sm">
          {/* Nitro bubbles */}
          {[10,30,50,70,85].map((bx, i) => (
            <motion.div key={i}
              animate={{ y: ['100%', '-10%'], opacity: [0.8, 0] }}
              transition={{ duration: 2 + i * 0.4, delay: i * 0.3, repeat: Infinity }}
              className="absolute w-1 h-1 bg-white/30 rounded-full" style={{ left: `${bx}%`, bottom: 0 }}
            />
          ))}
          {/* Coffee gradient layers */}
          <div className="absolute bottom-0 w-full h-3/4 bg-gradient-to-b from-amber-900/40 to-stone-900/80" />
          <div className="absolute bottom-3/4 w-full h-1/4 bg-gradient-to-b from-amber-200/20 to-amber-900/40" />
        </div>
        {/* Glass rim */}
        <div className="absolute bottom-[7.5rem] w-20 h-3 bg-gradient-to-r from-stone-300/20 via-white/30 to-stone-300/20 rounded-full border-t border-white/20" />
        {/* Cream top */}
        <div className="absolute bottom-[8.5rem] w-16 h-4 bg-gradient-to-b from-amber-100/70 to-amber-200/50 rounded-full blur-[1px]" />
        {/* Handle */}
        <div className="absolute bottom-14 right-[30%] w-5 h-8 border-r-4 border-t-4 border-b-4 border-white/20 rounded-r-full" />
        {/* Condensation drops */}
        {[25, 60, 80].map((dx, i) => (
          <motion.div key={i}
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 3 + i, delay: i, repeat: Infinity }}
            className="absolute w-1 h-2 bg-white/20 rounded-full blur-[0.5px]" style={{ left: `calc(50% - 2.5rem + ${dx/100 * 5}rem)`, bottom: '2.5rem' }}
          />
        ))}
      </div>
    ),
  },
  latte: {
    bg: 'from-amber-950/80 via-stone-900/60 to-slate-900/80',
    glow: 'rgba(180,83,9,0.5)',
    plate: 'from-amber-100 to-stone-100',
    steam: true,
    badge: '🌿 Oat Milk',
    art: (
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Cup base */}
        <div className="absolute bottom-6 w-24 h-28 bg-gradient-to-b from-white/95 to-slate-100/90 rounded-b-3xl border border-stone-200/60 shadow-[0_20px_50px_rgba(0,0,0,0.4),inset_0_1px_0_white] overflow-hidden">
          {/* Coffee */}
          <div className="absolute bottom-0 w-full h-3/4 bg-gradient-to-b from-amber-800/70 to-amber-950/90" />
          {/* Steamed milk */}
          <div className="absolute bottom-3/4 w-full h-1/4 bg-gradient-to-b from-amber-50/60 to-amber-800/40" />
        </div>
        {/* Latte art on top */}
        <div className="absolute bottom-[8.5rem] w-20 h-5 bg-gradient-to-b from-amber-100/80 to-amber-200/60 rounded-full overflow-hidden flex items-center justify-center">
          {/* Heart latte art */}
          <div className="text-amber-700/50 text-xs">♥</div>
        </div>
        {/* Cup rim */}
        <div className="absolute bottom-[8.8rem] w-24 h-2 bg-gradient-to-r from-stone-200/80 via-white to-stone-200/80 rounded-full" />
        {/* Handle */}
        <div className="absolute bottom-12 right-[28%] w-6 h-10 border-r-4 border-t-4 border-b-4 border-stone-200 rounded-r-full" />
        {/* Saucer */}
        <div className="absolute bottom-4 w-28 h-3 rounded-full bg-gradient-to-b from-slate-200 to-slate-300 shadow-md" />
      </div>
    ),
  },
};

// ─── Ultra 3D Dish Card ───────────────────────────────────────────────────────
function DishCard({ item, onAdd }: { item: any; onAdd: (item: any) => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const theme = FOOD_THEMES[item.themeKey] ?? FOOD_THEMES.truffle!;

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const springX = useSpring(mx, { stiffness: 120, damping: 18 });
  const springY = useSpring(my, { stiffness: 120, damping: 18 });
  const rotateX = useTransform(springY, [-0.5, 0.5], ['12deg', '-12deg']);
  const rotateY = useTransform(springX, [-0.5, 0.5], ['-12deg', '12deg']);
  const glowX = useTransform(springX, [-0.5, 0.5], ['0%', '100%']);
  const glowY = useTransform(springY, [-0.5, 0.5], ['0%', '100%']);

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!cardRef.current) return;
    const r = cardRef.current.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const handlePointerLeave = () => { mx.set(0); my.set(0); };

  return (
    <motion.div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d', boxShadow: '0 30px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.07)' }}
      variants={{
        hidden: { opacity: 0, y: 40, scale: 0.9 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 80, damping: 14 } },
      }}
      whileTap={{ scale: 0.97 }}
      className="relative rounded-[2.5rem] overflow-hidden cursor-pointer select-none"
    >
      {/* Dynamic glow that follows cursor */}
      <motion.div
        className="absolute inset-0 opacity-60 pointer-events-none z-10 rounded-[2.5rem]"
        style={{
          background: `radial-gradient(circle 180px at ${glowX} ${glowY}, ${theme.glow}, transparent 70%)`,
        }}
      />

      {/* Food Illustration Area */}
      <div className={`relative w-full h-56 bg-gradient-to-br ${theme.bg} overflow-hidden`}>
        {/* Starfield / particle background */}
        {Array.from({ length: 12 }).map((_, i) => (
          <motion.div key={i}
            animate={{ opacity: [0.2, 0.8, 0.2], scale: [0.8, 1.2, 0.8] }}
            transition={{ duration: 2 + i * 0.3, delay: i * 0.2, repeat: Infinity }}
            className="absolute w-1 h-1 bg-white/30 rounded-full"
            style={{ left: `${(i * 37 + 10) % 90}%`, top: `${(i * 23 + 5) % 80}%` }}
          />
        ))}

        {/* Radial ambient glow from food */}
        <motion.div
          animate={{ opacity: [0.4, 0.7, 0.4], scale: [0.9, 1.1, 0.9] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-32 rounded-full blur-3xl"
          style={{ background: theme.glow }}
        />

        {/* CSS Food Art */}
        <div className="absolute inset-0" style={{ transform: 'translateZ(30px)' }}>
          {theme.art}
        </div>

        {/* Steam Particles */}
        {theme.steam && (
          <>
            <SteamParticle delay={0} x={35} />
            <SteamParticle delay={0.8} x={50} />
            <SteamParticle delay={1.6} x={62} />
          </>
        )}

        {/* Badge */}
        {theme.badge && (
          <div className="absolute top-4 left-4 z-20" style={{ transform: 'translateZ(50px)' }}>
            <motion.div
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="px-3 py-1.5 rounded-full text-[11px] font-black tracking-wide bg-white/15 backdrop-blur-md border border-white/20 text-white shadow-lg"
            >
              {theme.badge}
            </motion.div>
          </div>
        )}

        {/* Bottom gradient fade to card */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-slate-900 to-transparent" />
      </div>

      {/* Card Content */}
      <div className="relative bg-slate-900/95 backdrop-blur-xl px-6 pb-6 pt-4 border-t border-white/5">
        {/* Stars */}
        <div className="flex gap-0.5 mb-2">
          {[1,2,3,4,5].map(s => (
            <Star key={s} className="w-3 h-3 fill-amber-400 text-amber-400" />
          ))}
          <span className="text-[11px] text-gray-400 ml-1 font-medium">(4.9)</span>
        </div>

        <div className="flex justify-between items-start mb-4" style={{ transform: 'translateZ(20px)' }}>
          <div className="flex-1 pr-4">
            <h3 className="text-[20px] font-black text-white leading-tight tracking-tight">{item.name}</h3>
            <p className="text-[13px] text-gray-400 mt-1.5 leading-relaxed line-clamp-2">{item.description}</p>
          </div>
          <div className="shrink-0 bg-gradient-to-br from-amber-400 to-orange-500 px-3 py-1.5 rounded-2xl shadow-lg shadow-orange-500/30">
            <span className="font-black text-white text-[16px]">₹{item.price}</span>
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => onAdd(item)}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-[1.5rem] font-black text-[15px] tracking-wide relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)',
            color: '#0f172a',
            boxShadow: '0 10px 30px rgba(255,255,255,0.15), 0 0 0 1px rgba(255,255,255,0.1)',
            transform: 'translateZ(40px)'
          }}
        >
          {/* Shimmer */}
          <motion.div
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
            className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12 pointer-events-none"
          />
          <Flame className="w-5 h-5 text-orange-500" />
          Add to Order
          <Plus className="w-5 h-5" />
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── Main Customer Menu ───────────────────────────────────────────────────────
export default function CustomerMenu({ tenantName, initialCategories, initialItems }: any) {
  const router = useRouter();
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const handleCheckout = async (method: 'CASH' | 'UPI') => {
    if (isCheckingOut) return;
    setIsCheckingOut(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(typeof window !== 'undefined' && localStorage.getItem('customer_session_token') ? { 'Authorization': 'Bearer ' + localStorage.getItem('customer_session_token') } : {}) },
        credentials: 'include',
        body: JSON.stringify({ paymentMethod: method }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || 'Failed to place order');
        setIsCheckingOut(false);
        return;
      }

      router.push(`/order/${data.data.id}/invoice`);
    } catch (e) {
      alert('Network error. Please try again.');
      setIsCheckingOut(false);
    }
  };

  const [activeCategory, setActiveCategory] = useState(initialCategories[0]?.id);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const cart = useCartStore();

  useEffect(() => { cart.fetchCart(); }, []);

  const filteredItems = initialItems.filter((item: any) => item.categoryId === activeCategory);

  function handleAdd(item: any) {
    cart.addItem(item.id, 1, [], undefined, { name: item.name, price: item.price });
    // Haptic
    if (window.navigator?.vibrate) window.navigator.vibrate(40);
  }

  return (
    <div className="min-h-screen bg-[#060B14] pb-36 overflow-x-hidden" style={{ perspective: '1200px' }}>
      
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.25, 0.15] }}
          transition={{ duration: 8, repeat: Infinity }}
          className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600 rounded-full blur-[120px]"
        />
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 10, repeat: Infinity, delay: 2 }}
          className="absolute -bottom-32 -right-32 w-96 h-96 bg-orange-600 rounded-full blur-[120px]"
        />
      </div>

      {/* Premium Header */}
      <header className="sticky top-0 z-40 px-6 pt-14 pb-5 border-b border-white/5"
        style={{ background: 'rgba(6,11,20,0.85)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)' }}>
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <span className="text-[12px] text-emerald-400 font-bold tracking-widest uppercase">Open Now</span>
          </div>
          <h1 className="text-[32px] font-black tracking-tight text-white leading-none">
            {tenantName || 'Lumina Cafe'}
          </h1>
          <p className="text-gray-400 text-[13px] font-medium mt-1">Artisan food, zero compromise</p>
        </motion.div>

        {/* Category Tabs */}
        <div className="flex gap-3 mt-6 overflow-x-auto pb-1 scrollbar-hide -mx-6 px-6">
          {initialCategories.map((cat: any, i: number) => (
            <motion.button
              key={cat.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => setActiveCategory(cat.id)}
              className={`whitespace-nowrap px-6 py-3 rounded-full text-[13px] font-black transition-all duration-300 relative overflow-hidden ${
                activeCategory === cat.id
                  ? 'text-gray-900'
                  : 'text-gray-400 border border-white/10 bg-white/5 hover:bg-white/10'
              }`}
            >
              {activeCategory === cat.id && (
                <motion.div layoutId="activeTab"
                  className="absolute inset-0 bg-white rounded-full"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
              <span className="relative z-10">{cat.name}</span>
            </motion.button>
          ))}
        </div>
      </header>

      {/* Menu Grid */}
      <main className="relative z-10 px-5 pt-6 mx-auto max-w-md md:max-w-2xl">
        <motion.div
          key={activeCategory}
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.15 } } }}
          className="grid grid-cols-1 gap-8"
        >
          {filteredItems.map((item: any) => (
            <DishCard key={item.id} item={item} onAdd={handleAdd} />
          ))}
        </motion.div>
      </main>

      {/* Floating Cart Button */}
      <AnimatePresence>
        {cart.items.length > 0 && !isCartOpen && (
          <motion.div
            initial={{ opacity: 0, y: 120, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 120, scale: 0.8 }}
            transition={{ type: 'spring', damping: 22, stiffness: 280 }}
            className="fixed bottom-10 inset-x-0 flex justify-center px-6 z-50 pointer-events-none"
          >
            <motion.button
              onClick={() => setIsCartOpen(true)}
              whileTap={{ scale: 0.95 }}
              className="pointer-events-auto flex items-center justify-between w-full max-w-sm p-4 rounded-[2rem] relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                boxShadow: '0 25px 50px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1), 0 0 80px rgba(255,165,0,0.15)',
              }}
            >
              {/* Shimmer sweep */}
              <motion.div
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 2 }}
                className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent skew-x-12 pointer-events-none"
              />
              <div className="flex items-center gap-4">
                <div className="bg-gray-900 p-3 rounded-2xl relative shadow-lg">
                  <ShoppingBag className="w-6 h-6 text-white" />
                  <motion.span
                    key={cart.items.reduce((a, i) => a + i.quantity, 0)}
                    initial={{ scale: 1.5 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-2 -right-2 bg-rose-500 text-white text-[11px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow"
                  >
                    {cart.items.reduce((a, i) => a + i.quantity, 0)}
                  </motion.span>
                </div>
                <span className="font-black text-[17px] text-gray-900">View Order</span>
              </div>
              <div className="flex items-center gap-2 bg-gray-900 text-white pl-5 pr-4 py-2.5 rounded-2xl shadow-lg">
                <span className="font-black text-[17px]">₹{cart.total || cart.subtotal}</span>
                <ChevronRight className="w-5 h-5 opacity-70" />
              </div>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart Bottom Sheet */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50"
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 200 }}
              className="fixed inset-x-0 bottom-0 rounded-t-[3rem] p-7 pb-12 z-50 max-h-[90vh] overflow-y-auto flex flex-col"
              style={{ background: 'rgba(10,15,28,0.97)', backdropFilter: 'blur(40px)', border: '1px solid rgba(255,255,255,0.08)', borderBottom: 'none' }}
            >
              <div className="w-14 h-1.5 bg-white/20 rounded-full mx-auto mb-8" />
              <h2 className="text-[30px] font-black text-white mb-6">Your Order 🛍️</h2>

              <div className="space-y-4 mb-6 flex-1 overflow-y-auto">
                {cart.items.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex justify-between items-center p-4 rounded-2xl border border-white/8"
                    style={{ background: 'rgba(255,255,255,0.04)' }}
                  >
                    <div>
                      <h4 className="font-bold text-[15px] text-white">{item.menuItemName}</h4>
                      <p className="text-gray-400 text-[13px] font-medium">₹{item.unitPrice} each</p>
                    </div>
                    <div className="flex items-center gap-3 bg-white/8 border border-white/10 p-1.5 rounded-2xl">
                      <button onClick={() => cart.updateItem(item.id, item.quantity - 1)}
                        className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-white/10 rounded-full transition-colors">
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="font-black text-white w-4 text-center text-[15px]">{item.quantity}</span>
                      <button onClick={() => cart.updateItem(item.id, item.quantity + 1)}
                        className="w-8 h-8 flex items-center justify-center bg-white text-gray-900 rounded-full shadow-md">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="pt-5 border-t border-white/8 mb-7 space-y-2">
                <div className="flex justify-between text-gray-400 font-medium text-[14px]">
                  <span>Subtotal</span><span>₹{cart.subtotal || cart.items.reduce((a,i)=>a+i.lineTotal,0)}</span>
                </div>
                <div className="flex justify-between text-gray-400 font-medium text-[14px]">
                  <span>GST (5%)</span><span>₹{cart.tax || Math.round(cart.items.reduce((a,i)=>a+i.lineTotal,0)*0.05*100)/100}</span>
                </div>
                <div className="flex justify-between text-white font-black text-[28px] pt-2">
                  <span>Total</span>
                  <span>₹{cart.total || Math.round(cart.items.reduce((a,i)=>a+i.lineTotal,0)*1.05*100)/100}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => handleCheckout('CASH')} disabled={cart.isLoading || isCheckingOut || cart.items.length === 0} className="flex flex-col items-center justify-center gap-1.5 p-5 rounded-[1.75rem] border border-white/15 bg-white/5 text-white hover:bg-white/10 transition-all active:scale-95 disabled:opacity-50">
                  <span className="font-black text-[15px]">Pay at Counter</span>
                  <span className="text-[11px] opacity-60 font-bold uppercase tracking-widest">Cash / Card</span>
                </button>
                <button onClick={() => handleCheckout('UPI')} disabled={cart.isLoading || isCheckingOut || cart.items.length === 0} className="relative flex flex-col items-center justify-center gap-1.5 p-5 rounded-[1.75rem] text-white overflow-hidden active:scale-95 transition-all shadow-[0_15px_40px_rgba(74,222,128,0.35)] disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
                  <QrCode className="w-7 h-7" />
                  <span className="font-black text-[15px]">Scan & Pay</span>
                  <span className="text-[11px] opacity-90 font-bold uppercase tracking-widest">Via UPI · Free</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
