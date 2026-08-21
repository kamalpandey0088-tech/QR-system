'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChefHat, ArrowRight } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/kitchen';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await signIn('credentials', {
        redirect: false,
        email,
        password,
        callbackUrl,
      });

      if (res?.error) {
        setError('Invalid email or password');
      } else {
        router.push(callbackUrl);
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-6 relative overflow-hidden font-brand">
      
      {/* Dynamic Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div 
          animate={{ rotate: 360 }} 
          transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] bg-indigo-500/10 rounded-full blur-[120px]"
        />
        <motion.div 
          animate={{ rotate: -360 }} 
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-[20%] -right-[10%] w-[60vw] h-[60vw] bg-emerald-500/10 rounded-full blur-[120px]"
        />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 md:p-10 shadow-[0_30px_60px_rgba(0,0,0,0.4)]">
          <div className="flex justify-center mb-8">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-4 rounded-2xl shadow-lg">
              <ChefHat className="w-8 h-8 text-white" />
            </div>
          </div>
          
          <h2 className="text-3xl font-black text-white text-center mb-2 tracking-tight">Welcome Back</h2>
          <p className="text-gray-400 text-center mb-8 font-medium">Sign in to Lumina Dashboard</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold p-4 rounded-2xl mb-6 text-center">
              {error}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2">Email Address</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@luminacafe.com" 
                required
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" 
                required
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
              />
            </div>

            <div className="mt-6">
              <button 
                type="submit"
                disabled={isLoading}
                className="group w-full flex items-center justify-center gap-2 bg-white text-gray-900 py-4 rounded-2xl font-bold text-[16px] active:scale-95 transition-all shadow-[0_10px_20px_rgba(255,255,255,0.1)] hover:shadow-[0_15px_30px_rgba(255,255,255,0.2)] disabled:opacity-50"
              >
                {isLoading ? 'Signing In...' : 'Access Dashboard'}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0F172A]" />}>
      <LoginForm />
    </Suspense>
  );
}
