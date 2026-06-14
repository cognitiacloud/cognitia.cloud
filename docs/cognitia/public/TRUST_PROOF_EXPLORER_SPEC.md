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
