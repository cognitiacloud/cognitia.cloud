# Trust / Proof Explorer — Spec (V-4)

Date: 2026-06-14. Route: **`/trust`** (`apps/web/src/app/trust/page.tsx`).
Public-safe, read-only, static. This spec is the source of truth for what the
page shows and the guardrails it must keep.

## Purpose

A researcher-facing surface that states, conservatively and with evidence
tags, what Cognitia has actually built, what is runtime-verified, what is
design-only, what is blocked/founder-gated, and why any future token remains
internal, legal-gated, usage-gated, and optional. It exists to make Cognitia
honestly **evaluable** — not to market anything.

## Hard constraints (enforced by `trust.test.ts`)

- **Read-only / static**: no `'use client'`, no API client, no `fetch(`, no
  `useState`, no session-token paste. No writes anywhere.
- **No private data**: no `details_private`, no `evidence_ref`/`verifier_ref`
  values, no PII, no internal customer data, no wallet secrets.
- **No token purchase CTA**; **no public sale / pre-sale / drop language**;
  **no price or return copy**; **no DEX/liquidity/staking/yield marketing**
  (status disclosure like "DEX: No" is allowed, marketing is not).
- **No public marketplace transaction route** and no token/coin route dir is
  added anywhere under `apps/web/src/app`.
- Required verbatim wording: _"Cognitia's future token architecture is
  internal, legal-gated, usage-gated, and optional. No public token exists."_

## Sections

1. Cognitia Trust Overview
2. What is built / runtime-verified / design-only / blocked
3. Runtime Verification Status (smoke passed; 443/443; migration chain
   0001–0014 + 0016–0018, 0015 reserved/absent; verified paths; RLS caveat)
4. Token Architecture Status (gate panel)
5. Evidence Cards (12)
6. Researcher FAQ (see `RESEARCHER_FAQ.md`)
7. What Cognitia does not claim

## Evidence card model

Each card: **name · status · evidence source · public-safe claim · caveat**.
Status ∈ `built | runtime-verified | design-only | blocked`. Cards: ATC,
Proof Registry, SkillProof, Reputation, Credits, Work Orders, Escrow
Simulation, Dispute Resolution, Agent Action Ledger, Internal Marketplace,
Cross-tenant Settlement (design-only), Token Architecture (blocked).

## Token gate panel

Public token: No · Token launched: No · Liquidity: No · DEX: No ·
Staking/yield: No · Mainnet: No · Launch date: None · Legal gate: Not passed ·
Usage gate: Not passed · Cross-tenant settlement gate: Not passed ·
Managed-Postgres RLS gate: Not passed · Token may never launch.

## Data sourcing

All content is hard-coded from merged docs on `main`
(`MAINLINE_RUNTIME_VERIFICATION_STATUS.md`, `ECONOMY_SMOKE_001_REPORT.md`,
`crypto/TOKEN_GATES.md`, `PUBLIC_DILIGENCE_OVERVIEW.md`). The page makes no
live calls, so it can never leak private state. When those facts change
(e.g., the managed-Postgres RLS run completes, or the test count moves),
update the page constants and this spec together.

## Out of scope (deliberately)

No live proof feed (would require an authed, redaction-gated read API — a
later roadmap item, V-4b), no charts, no token surface, no marketing.

## V-4b — Live public proof feed (`/trust/live` + `GET /public/trust-feed`)

A second, **live** surface complements the static `/trust` page without
changing it (so V-4's static guards stay intact).

- **API**: `GET /public/trust-feed` — **unauthenticated, read-only**. The
  tenant is taken ONLY from server config `COGNITIA_PUBLIC_TENANT_ID`, NEVER
  from the request, so the endpoint cannot be used to enumerate tenants.
  Deny-by-default: with no public tenant configured it returns
  `{ configured: false, proofs: [], reputation: {…zeros} }` — never an error.
  Proofs are the **public projection only** (id, kind, evidence_tag,
  summary_public, supersedes_proof_id, created_at) and **only** public_safe,
  redaction-passed rows. Reputation is an **aggregate** (agents_with_reputation,
  total_events, positive_events) — never agent ids or per-agent scores.
- **Page**: `/trust/live` — a client page that GETs the feed (no auth, no
  token, no writes), renders the aggregate reputation + the public-safe proof
  table, links back to `/trust`, and shows an explicit empty state when no
  public tenant is configured.
- **Guards**: `apps/api/src/publicTrustFeed.test.ts` (config-only tenant,
  deny-by-default, projection-only, no enumeration, aggregate reputation) and
  `apps/web/src/app/trust/live/trust-live.test.ts` (read-only GET, no
  auth/token, no private fields, no purchase/price/marketing copy).

To publish a demo feed, set `COGNITIA_PUBLIC_TENANT_ID` to a tenant whose
proofs have been redaction-checked into `public_safe`. Nothing is exposed
until that is set, and only redaction-passed projections ever appear.

## V-5 operational hardening

The feed is now bounded, cached, and rate-limited (see
`public/PUBLIC_TRUST_FEED_HARDENING.md` and the exact shape in
`public/PUBLIC_EVIDENCE_MANIFEST_SPEC.md`):

- Proofs capped at **50**, newest-first; response reports `proof_limit`,
  `proof_count_returned`, `truncated`.
- Reputation computed by a DB aggregate (`countReputation`) — no event bodies
  loaded; still counts-only.
- Freshness/cache metadata (`generated_at`, `feed_version`, `cache_ttl_seconds`,
  `source`) + `Cache-Control: public, max-age=60`.
- A secondary in-process rate limiter (env-tunable) returns `429` past the
  limit; the primary control is edge/CDN/WAF
  (`public/PUBLIC_TRUST_FEED_RATE_LIMIT_PLAN.md`).
