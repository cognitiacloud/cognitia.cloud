# COG-011 (UI) — Lead Detail Console

**Date:** 2026-06-15 · **Branch:** `claude/cog-011-lead-detail-console` · **Base:** `main` @ `313a82d`

## Why

The lead-detail aggregate endpoint already shipped — `GET /leads/:id`
(`handlers.getLeadDetail`, operator/owner-gated) — but its console page was
explicitly deferred. The deferral is recorded in the platform's own summary:
`apps/api/src/commandSummary.ts:176` → `'API exists (GET /leads/:id); console page deferred'`.
A lead-detail console page is also a named gate for the simulation→live pilot
(`docs/cognitia/execution/LANE_A_PILOT_READINESS.md`, "Lead-detail console page
(ticket 6) for operator ergonomics"). This lane closes that gap.

This is the highest-leverage _safe-to-revive_ item after the parallel build
converged into `main`: the backend is already built and tested, so the work is
purely additive UI with **no API change, no schema change, no external
dependency, and no trust-control surface touched**.

## What

- **New page** `apps/web/src/app/moveros/front-desk/leads/[id]/page.tsx`
  (Next.js App Router dynamic route). Operator-gated decrypted lead view —
  contact name, masked phone, decrypted message, source, consent, PII status,
  received time — built on the existing `ApiClient.getLead(id)` /
  `LeadDetailView`. Reuses the existing proof-backed controls via existing
  client methods: `proposeLeadAction`, `recordLeadOutcome` (verified_fact
  requires an evidence source), and `purgeLeadPii` (PIPEDA). Purged leads blank
  the decrypted fields.
- **List → detail link**: an `Open` link per row in
  `apps/web/src/app/moveros/front-desk/page.tsx` routes to the detail page. The
  masked list itself is unchanged (still no raw PII).

## Trust posture (unchanged)

No raw PII on the list; decryption happens only on the detail page, behind the
same operator/owner role gate the endpoint already enforces (viewer → 403,
already covered server-side). Simulation-only; real SMS remains structurally
refused. No endpoint, schema, migration, or guard test was modified.

## Verification

`pnpm check` (format:check && typecheck (incl. @cognitia/web) && vitest) —
**515/515 tests, 78 files** green. Change is additive UI only:
`git diff --stat main HEAD` touches `apps/web/...` + this doc, with no
deletions under `apps/api`, `packages/`, or any `*.guard.test.ts`.

## Follow-ups (out of scope, intentionally narrow)

The richer COG-011 "full story" aggregate (lead's actions, outcomes, related
proofs, reputation links, audit refs in one payload) described in the stale
PR #44/#45 is **not** in `main` — `getLeadDetail` currently returns the
decrypted lead only. Enriching the endpoint + page to that full aggregate is a
separate ticket (server change), deliberately not bundled here.
