/**
 * @fileoverview NextAuth.js type augmentation.
 * Extends default types to include role and tenant information.
 */

import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'SUPER_ADMIN' | 'CAFE_OWNER' | 'CHEF';
      tenantId: string | null;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    role: 'SUPER_ADMIN' | 'CAFE_OWNER' | 'CHEF';
    tenantId: string | null;
    passwordHash?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string;
    role: 'SUPER_ADMIN' | 'CAFE_OWNER' | 'CHEF';
    tenantId: string | null;
  }
}
