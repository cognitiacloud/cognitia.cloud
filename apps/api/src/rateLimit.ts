/**
 * Lightweight, dependency-free fixed-window rate limiter (V-5).
 *
 * This is a SECONDARY, in-process defense for the unauthenticated public trust
 * feed — NOT the primary control. Primary rate limiting for public traffic
 * belongs at the CDN / WAF / edge (see
 * docs/cognitia/public/PUBLIC_TRUST_FEED_RATE_LIMIT_PLAN.md): in-process
 * counters do not coordinate across instances, and an attacker can spread load
 * across many source IPs. This guard exists to blunt trivial single-source
 * bursts and to make the limit explicit, configurable, and testable in code.
 *
 * Properties:
 *   - fixed window keyed by a caller key (client IP);
 *   - O(1) per request; bounded memory (the whole table is dropped when it
 *     grows past a cap — safe, since the worst case is all windows restarting);
 *   - callers should treat any internal failure as "allowed" (fail-open).
 */
export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the current window resets. */
  resetSeconds: number;
}

interface WindowEntry {
  count: number;
  windowStart: number;
}

export class FixedWindowRateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly maxKeys: number;
  private readonly hits = new Map<string, WindowEntry>();

  constructor(opts: { limit: number; windowMs: number; maxKeys?: number }) {
    this.limit = Math.max(1, Math.floor(opts.limit));
    this.windowMs = Math.max(1000, Math.floor(opts.windowMs));
    this.maxKeys = Math.max(1000, Math.floor(opts.maxKeys ?? 50_000));
  }

  check(key: string, now: number = Date.now()): RateLimitDecision {
    // Bounded memory: if the table grows too large, reset it wholesale. The only
    // effect is that all current windows restart — cheap and safe.
    if (this.hits.size > this.maxKeys) this.hits.clear();

    const entry = this.hits.get(key);
    if (!entry || now - entry.windowStart >= this.windowMs) {
      this.hits.set(key, { count: 1, windowStart: now });
      return {
        allowed: true,
        limit: this.limit,
        remaining: this.limit - 1,
        resetSeconds: Math.ceil(this.windowMs / 1000),
      };
    }
    entry.count += 1;
    const remaining = Math.max(0, this.limit - entry.count);
    const resetSeconds = Math.max(0, Math.ceil((entry.windowStart + this.windowMs - now) / 1000));
    return { allowed: entry.count <= this.limit, limit: this.limit, remaining, resetSeconds };
  }
}

/**
 * Build the public-feed limiter from env, or `null` when disabled.
 *   COGNITIA_PUBLIC_FEED_RATE_LIMIT       — max requests per window (default 60; 0/invalid disables)
 *   COGNITIA_PUBLIC_FEED_RATE_WINDOW_SEC  — window length in seconds (default 60)
 */
export function publicFeedRateLimiterFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): FixedWindowRateLimiter | null {
  const rawLimit = env.COGNITIA_PUBLIC_FEED_RATE_LIMIT?.trim();
  const limit = rawLimit === undefined || rawLimit === '' ? 60 : Number(rawLimit);
  if (!Number.isFinite(limit) || limit <= 0) return null; // disabled or malformed ⇒ no in-process limiter
  const rawWindow = env.COGNITIA_PUBLIC_FEED_RATE_WINDOW_SEC?.trim();
  const windowSec = rawWindow === undefined || rawWindow === '' ? 60 : Number(rawWindow);
  const windowMs = (Number.isFinite(windowSec) && windowSec > 0 ? windowSec : 60) * 1000;
  return new FixedWindowRateLimiter({ limit, windowMs });
}
