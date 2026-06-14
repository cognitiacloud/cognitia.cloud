# 12h hardening session plan (GTM lane only)

Continues the prior queue (Items 1-2 done: security regression suite + inert
rate-limit fix; untrusted-input flow review). This session: deliver ONE bounded
item end-to-end given context budget, then handoff.

SELECTED (in-order): Item 3 — Authorization surface audit (Items 1-2 already done).

- apps/api/src/preflightReadiness.ts: pure checkDeployReadiness(env/secrets/role/
  config) -> structured READY/NOT-READY report; fail-closed (required checks).
- thin CLI + package script; tests; doc. Reuses secrets.ts + rlsGuard seams.
- Strengthens fail-closed deploy readiness; NO deploy performed; infra not claimed.

Remaining (not this session): Item 3 authz enumeration doc, Item 4 shadow-mode
scaffolding, Item 5 evidence pack, Item 6 anchor-sink hardening.
