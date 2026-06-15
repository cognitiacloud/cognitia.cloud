# BOOKLET EXPORT PLAN — AUDIT-BOOKLET-001

No PDF is generated here (the repo has no vetted markdown→PDF tooling; adding a
heavy dependency is out of scope for an audit). This is the plan for later.

## How to turn the booklet into a PDF (later, manual)

- Source: `COGNITIA_SYSTEM_BOOKLET_V1.md`.
- Options: a markdown→PDF tool (e.g. pandoc, or a docs site export) run **outside**
  CI; or paste into a doc editor. Do not add a build-time PDF dependency to the repo
  without founder sign-off.

## Review BEFORE any public sharing

1. **Comms/legal review** of the whole booklet against
   `public/CLAIMS_WE_DO_NOT_MAKE.md` + `research/12H_.../UNSAFE_LANGUAGE_BLACKLIST.md`.
2. Re-run the term scan (PROMISE_VS_REALITY_LEDGER) on the exact export.
3. Confirm no internal-only content leaked (see split below).
4. Confirm every claim is still true at export time (test count, commit, gaps).

## Public-safe vs internal-only sections

- **Public-safe** (after review): §1–4, 6–11, 14 (posture), 15–21, and the
  diligence pack it references. These mirror already-published `public/` docs.
- **Internal-only** (do NOT publish without founder decision): token architecture
  detail (`crypto/TOKEN_LAB_*`), cross-tenant settlement internals, the exact
  founder-decision list, any pilot/tenant specifics, the distributed-fabric
  containment internals.
- **Never publish**: secrets, tenant/customer data, private proof bodies — none
  are in the booklet by construction.

## Legal/comms checklist (pre-publication)

No production-ready/SOC2/audited/decentralized/unstoppable claim · no token
launch/sale/price/return/yield · no fabricated metrics · token framing stays
"optional, gated, may never launch" · resilience framed as continuity, not evasion.
