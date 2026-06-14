import { describe, it, expect } from 'vitest';
import { FixedWindowRateLimiter, publicFeedRateLimiterFromEnv } from './rateLimit.js';

/**
 * V-5 — unit coverage for the secondary in-process public-feed rate limiter.
 * This is a defense-in-depth layer only; primary limiting is edge/CDN/WAF.
 */

describe('FixedWindowRateLimiter', () => {
  it('allows up to the limit within a window, then blocks', () => {
    const rl = new FixedWindowRateLimiter({ limit: 3, windowMs: 60_000 });
    const t = 1_000_000;
    expect(rl.check('ip', t).allowed).toBe(true); // 1
    expect(rl.check('ip', t).allowed).toBe(true); // 2
    const third = rl.check('ip', t);
    expect(third.allowed).toBe(true); // 3 (== limit)
    expect(third.remaining).toBe(0);
    const fourth = rl.check('ip', t);
    expect(fourth.allowed).toBe(false); // 4 > limit
    expect(fourth.remaining).toBe(0);
    expect(fourth.resetSeconds).toBeGreaterThan(0);
  });

  it('resets after the window elapses', () => {
    const rl = new FixedWindowRateLimiter({ limit: 1, windowMs: 1_000 });
    expect(rl.check('ip', 0).allowed).toBe(true);
    expect(rl.check('ip', 500).allowed).toBe(false); // same window
    expect(rl.check('ip', 1_000).allowed).toBe(true); // new window
  });

  it('keys are independent', () => {
    const rl = new FixedWindowRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(rl.check('a', 0).allowed).toBe(true);
    expect(rl.check('b', 0).allowed).toBe(true);
    expect(rl.check('a', 0).allowed).toBe(false);
  });

  it('bounds memory: exceeding maxKeys clears the table without throwing', () => {
    const rl = new FixedWindowRateLimiter({ limit: 1, windowMs: 60_000, maxKeys: 1000 });
    for (let i = 0; i < 1100; i++) expect(() => rl.check(`ip-${i}`, 0)).not.toThrow();
    // After a wholesale reset a previously-seen key is allowed again — safe behavior.
    expect(rl.check('ip-0', 0).allowed).toBe(true);
  });
});

describe('publicFeedRateLimiterFromEnv', () => {
  it('defaults to a limiter when unset', () => {
    expect(publicFeedRateLimiterFromEnv({})).toBeInstanceOf(FixedWindowRateLimiter);
  });

  it('is disabled (null) when the limit is 0 or malformed', () => {
    expect(publicFeedRateLimiterFromEnv({ COGNITIA_PUBLIC_FEED_RATE_LIMIT: '0' })).toBeNull();
    expect(publicFeedRateLimiterFromEnv({ COGNITIA_PUBLIC_FEED_RATE_LIMIT: 'abc' })).toBeNull();
    expect(publicFeedRateLimiterFromEnv({ COGNITIA_PUBLIC_FEED_RATE_LIMIT: '-5' })).toBeNull();
  });

  it('honors a configured limit', () => {
    const rl = publicFeedRateLimiterFromEnv({
      COGNITIA_PUBLIC_FEED_RATE_LIMIT: '2',
      COGNITIA_PUBLIC_FEED_RATE_WINDOW_SEC: '60',
    });
    expect(rl).not.toBeNull();
    expect(rl!.check('ip', 0).allowed).toBe(true);
    expect(rl!.check('ip', 0).allowed).toBe(true);
    expect(rl!.check('ip', 0).allowed).toBe(false);
  });
});
