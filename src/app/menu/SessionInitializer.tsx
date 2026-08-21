'use client';
import { useEffect, useState } from 'react';
import { setCustomerSessionCookie } from './actions';

export default function SessionInitializer({ token, children }: { token: string, children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  
  useEffect(() => {
    setCustomerSessionCookie(token)
      .then(() => setReady(true))
      .catch((err) => {
        console.error(err);
        setReady(true); // fall back so it doesn't block forever
      });
  }, [token]);

  if (!ready) {
    return <div className="min-h-screen bg-[#060B14] flex items-center justify-center"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return <>{children}</>;
}
