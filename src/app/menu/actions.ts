'use server'
import { cookies } from 'next/headers';

export async function setCustomerSessionCookie(sessionToken: string) {
  cookies().set('customer_session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 86400,
  });
}
