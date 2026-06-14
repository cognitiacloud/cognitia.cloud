# Visibility Gap Analysis (LOOP 4)

Where Cognitia's public-safe diligence surface is strong, weak, or missing, and
what to do — without any token marketing.

## Strong (keep)

- `/trust` static explorer + `/trust/live` feed (V-4/4b/4c/5), deny-by-default.
- Public diligence overview, evidence manifest spec, token gates, "what we do not
  claim" page.
- Repo with 490 tests + PR history.

## Weak (improve cheaply)

| Gap                               | Impact                      | Fix (this loop / near-term)           |
| --------------------------------- | --------------------------- | ------------------------------------- |
| No single researcher entry point  | researchers bounce          | PUBLIC_RESEARCHER_PACK_SPEC + index   |
| "Verify it yourself" not explicit | repro claim not actionable  | repro guide (clone→pnpm check→smoke)  |
| No canonical public narrative     | story scattered             | SAFE_PUBLIC_NARRATIVE                 |
| No public SECURITY page           | researcher/B2B expectation  | SECURITY.md design (LOOP 8)           |
| No compliance-posture page        | legal credibility           | compliance note (credits≠money/token) |
| Default branch not `main`         | researchers see stale       | founder one-click (D-7)               |
| Standards mapping not public      | misses agent-economy signal | publish LANE_Q-derived mapping        |

## Missing (founder-gated)

- Team page / identity (D-4).
- External audit (budget).
- Live (configured) public proof feed (D-8, after V-6 + edge).
- Pilot/traction evidence (D-?).

## Severity ranking

- P1: researcher entry point, SECURITY page, managed-RLS proof, team identity.
- P2: narrative, compliance note, standards mapping, default branch.
- P3: release tags, docs site.

## Principle

Every improvement converts _existing internal rigor_ into _externally legible,
verifiable_ evidence. No new claims, no token surface.
