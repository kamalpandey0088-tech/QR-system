/**
 * @fileoverview In-memory token bucket rate limiter.
 * @security Prevents brute force attacks on auth endpoints.
 * Upgradeable to Redis for multi-instance deployments.
 */

interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
}

interface RateLimitConfig {
  maxTokens: number;
  refillRate: number; // tokens per second
  refillInterval: number; // milliseconds
}

/** Rate limit configurations per endpoint type */
const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  login: { maxTokens: 5, refillRate: 5, refillInterval: 60000 },       // 5 per minute
  signup: { maxTokens: 3, refillRate: 3, refillInterval: 60000 },      // 3 per minute  
  'password-reset': { maxTokens: 3, refillRate: 3, refillInterval: 3600000 }, // 3 per hour
  api: { maxTokens: 60, refillRate: 60, refillInterval: 60000 },       // 60 per minute
  webhook: { maxTokens: 100, refillRate: 100, refillInterval: 60000 }, // 100 per minute
};

class RateLimiter {
  private buckets: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    // Clean up expired entries every 5 minutes to prevent memory leaks
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    // Allow garbage collection if the process is shutting down
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Check if a request is within rate limits.
   * @param identifier - Unique identifier (e.g., IP address)
   * @param endpoint - Endpoint type key (e.g., 'login', 'api')
   * @returns Object with allowed status and optional retryAfter in seconds
   */
  check(
    identifier: string,
    endpoint: string
  ): { allowed: boolean; retryAfter?: number; remaining: number } {
    const config = RATE_LIMIT_CONFIGS[endpoint] ?? RATE_LIMIT_CONFIGS['api']!;
    const key = `${endpoint}:${identifier}`;
    const now = Date.now();

    let entry = this.buckets.get(key);

    if (!entry) {
      entry = { tokens: config.maxTokens, lastRefill: now };
      this.buckets.set(key, entry);
    }

    // Refill tokens based on elapsed time
    const elapsed = now - entry.lastRefill;
    const tokensToAdd = Math.floor(
      (elapsed / config.refillInterval) * config.refillRate
    );

    if (tokensToAdd > 0) {
      entry.tokens = Math.min(config.maxTokens, entry.tokens + tokensToAdd);
      entry.lastRefill = now;
    }

    // Check if request is allowed
    if (entry.tokens > 0) {
      entry.tokens -= 1;
      return { allowed: true, remaining: entry.tokens };
    }

    // Calculate retry-after
    const retryAfter = Math.ceil(
      (config.refillInterval - elapsed) / 1000
    );

    return {
      allowed: false,
      retryAfter: Math.max(1, retryAfter),
      remaining: 0,
    };
  }

  /** Remove expired entries to prevent memory bloat */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 15 * 60 * 1000; // 15 minutes

    this.buckets.forEach((entry, key) => {
      if (now - entry.lastRefill > maxAge) {
        this.buckets.delete(key);
      }
    });
  }

  /** Destroy the rate limiter and clear the cleanup interval */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.buckets.clear();
  }
}

/** Singleton rate limiter instance */
const globalForRateLimit = globalThis as unknown as {
  rateLimiter: RateLimiter | undefined;
};

export const rateLimiter =
  globalForRateLimit.rateLimiter ?? new RateLimiter();

if (process.env.NODE_ENV !== 'production') {
  globalForRateLimit.rateLimiter = rateLimiter;
}

export { RATE_LIMIT_CONFIGS };
