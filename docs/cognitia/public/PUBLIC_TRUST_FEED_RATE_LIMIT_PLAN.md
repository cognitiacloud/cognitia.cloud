# Public Trust Feed — Rate-Limit Plan (V-5)

The authoritative rate limiting for the unauthenticated `GET /public/trust-feed`
surface belongs at the **edge (CDN / WAF / reverse proxy)**, not in application
code. This document specifies the required edge controls. The in-process limiter
shipped in V-5 is a secondary, best-effort layer only.

## Why the edge, not the app

- In-process counters do not coordinate across multiple app instances, so a
  fleet of N instances effectively multiplies any in-app limit by N.
- The app only sees a trustworthy client IP when an edge sets
  `X-Forwarded-For` and the server enables `trustProxy`. Without that,
  `request.ip` may be a load-balancer address shared by all clients.
- The cheapest place to drop abusive traffic is before it reaches compute.

## Required edge controls (to enable when the feed is published)

1. **Per-IP rate limit**
   - Sustained: ~60 requests / minute / IP (matches the in-app default).
   - Burst: allow short bursts up to ~20 requests / 10s, then throttle.
   - Response: `429 Too Many Requests` with `Retry-After`.
2. **Global / route ceiling**
   - A coarse ceiling on total `/public/trust-feed` RPS to cap blast radius of
     a distributed scrape, independent of per-IP limits.
3. **Edge cache**
   - Honor the app's `Cache-Control: public, max-age=60`. Serve cached responses
     at the edge so repeat traffic never reaches the origin within the TTL.
   - Cache key: path only (the route takes no client-controlled query that
     affects output). Do NOT vary cache on client headers.
4. **WAF / abuse rules**
   - Block obvious bot signatures and known-bad ASNs/IPs as appropriate.
   - Optional: challenge (CAPTCHA/JS) on anomalous spikes.
5. **Abuse logging (no PII)**
   - Log only: timestamp, truncated/hashed IP or ASN, route, status, and a
     coarse rate bucket. Do NOT log full IPs alongside identifying data, request
     bodies (there are none), tenant ids, or any proof content.
   - Retain per the standard log-retention policy; the feed itself contains only
     already-public-safe data.

## App-side defaults (already shipped, secondary)

| Env                                    | Default | Notes                         |
| -------------------------------------- | ------- | ----------------------------- |
| `COGNITIA_PUBLIC_FEED_RATE_LIMIT`      | 60      | per IP per window; 0 disables |
| `COGNITIA_PUBLIC_FEED_RATE_WINDOW_SEC` | 60      | window seconds                |

If the app runs behind a proxy/CDN, enable Fastify `trustProxy` (config follow-up)
so the in-app limiter keys on the real client IP rather than the proxy.

## Status

- In-app secondary limiter: **shipped (V-5)**.
- Edge controls 1–5: **not configured** (no production deploy in scope; this is
  the runbook for when the feed is published). Founder/infra-gated.
