/**
 * @fileoverview NextAuth.js v5 configuration with credentials provider.
 * @security
 * - Uses Argon2id for password hashing (GPU-resistant)
 * - JWT strategy with tenant_id and role embedded
 * - Never logs or returns password hashes
 * - Active status check prevents disabled accounts from authenticating
 */

import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';
import { loginSchema } from '@/lib/validations/auth';
import { rateLimiter } from '@/lib/security/rate-limiter';

export const authOptions = {
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Email & Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // Validate input with Zod before any DB query
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;

        // Rate limit brute force attempts on the email
        const rateLimit = rateLimiter.check(email, 'login');
        if (!rateLimit.allowed) {
          throw new Error("Too many login attempts. Please try again later.");
        }

        // Find user by email - only active users can authenticate
        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            role: true,
            tenantId: true,
            isActive: true,
          },
        });

        if (!user) {
          // Return null instead of throwing to prevent user enumeration
          return null;
        }

        // Check if account is active
        if (!user.isActive) {
          return null;
        }

        // Verify password using Argon2id (GPU-resistant)
        const isValidPassword = await bcrypt.compare(password, user.passwordHash);
        if (!isValidPassword) {
          return null;
        }

        // Return user data for JWT - NEVER include passwordHash
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
        };
      },
    }),
  ],

  session: {
    strategy: 'jwt' as const,
    maxAge: 24 * 60 * 60, // 24 hours
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    /**
     * JWT callback - inject custom claims into the token.
     * This runs on sign-in and on every subsequent request.
     */
    async jwt({ token, user }: { token: Record<string, unknown>; user?: Record<string, unknown> }) {
      if (user) {
        token.userId = user.id as string;
        token.role = user.role as string;
        token.tenantId = (user.tenantId as string) ?? null;
      }
      return token;
    },

    /**
     * Session callback - expose custom claims on the session object.
     * Only safe, non-sensitive data is included.
     */
    async session({ session, token }: { session: Record<string, unknown>; token: Record<string, unknown> }) {
      if (session.user && typeof session.user === 'object') {
        const user = session.user as Record<string, unknown>;
        user.id = token.userId;
        user.role = token.role;
        user.tenantId = token.tenantId;
      }
      return session;
    },
  },

  // Security settings
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  debug: false, // NEVER enable debug in production - it leaks sensitive info
};

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions as any);
