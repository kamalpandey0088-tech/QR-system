'use client';
import { useEffect } from 'react';
import { setCustomerSessionCookie } from './actions';

export default function SessionInitializer({ token }: { token: string }) {
  useEffect(() => {
    setCustomerSessionCookie(token).catch(console.error);
  }, [token]);
  return null;
}
