# Public Researcher Pack — Spec (LOOP 4)

A single, public-safe entry point that lets a skeptical researcher evaluate
Cognitia in ~15 minutes, end to end, from evidence — not marketing.

## Goal
One linkable index → everything a researcher needs → all claims reproducible or
explicitly caveated. No token surface, no price, no hype.

## Contents (each item links to an existing or planned artifact)
1. **What Cognitia is** (1 paragraph) — the LANE_L one-liner + the primitive list.
2. **Verify it yourself** — `git clone` → `pnpm install` → `pnpm check` (expect
   490/490) → run the economy smoke. Exact commands. (THIS is the strongest asset.)
3. **Evidence model** — link PUBLIC_EVIDENCE_MANIFEST_SPEC + `/trust` + `/trust/live`.
4. **Architecture** — link ARCHITECTURE_LOCK + key migrations (0009/0010/0016–0018).
5. **What is runtime-verified vs design-only vs blocked** — link runtime status.
6. **Token gates** — link TOKEN_GATES; state plainly: no token, optional, gated.
7. **Security posture** — link SECURITY.md (planned) + RLS verification plan +
   the honest gaps (no external audit yet, managed-RLS unverified).
8. **Standards alignment** — LANE_Q mapping (compatible-by-design, not compliant).
9. **What we do NOT claim** — link the page; restate the blacklist highlights.
10. **Hard-questions FAQ** — answers to LANE_M attacks 1–12, honestly.
11. **Contact / responsible disclosure** — intake email (no PII).

## Placement
- Could live as a new static route `/trust/researchers` (static, like `/trust`)
  OR as a docs page. **Design-only here** — implementation is a future build with
  the same V-4 static guards (no fetch, no client state, no token literals).

## Acceptance criteria
- Every "verify" step is runnable by an outsider and produces the stated result.
- Every claim is either reproducible or carries an explicit caveat.
- Doctrine guards stay green (no banned literals in any web file).
- No token/price/sale/return language anywhere.

## Explicitly out of scope
Team identity (founder decision), live feed data (gated), audit results (pending).
The pack should *name* these as open, not hide them.
