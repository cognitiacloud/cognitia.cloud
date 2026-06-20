# BLOCKERS

**Compiled:** 2026-06-20 · **Legend:** severity = impact on reaching one green Client Zero × Sales Closer spine on `main`. `[VERIFIED]` / `[INFERRED]` as elsewhere.

---

## B1 — #96 has no named merge sign-off owner

- **What:** #96 (compliance layer) is open, non-draft, mergeable-clean, **CI green** `[VERIFIED]`, and already converged onto #93/#97. It is ready for a decision but no human owns the merge call.
- **Owner / decision needed:** Muhammad/Feroz to name a reviewer + merge owner.
- **Severity:** Medium. (Work is done; only the decision is missing.)
- **Unblock action:** Day-1 review per NEXT-7-DAYS; confirm core has no duplicate compliance surface (already `[VERIFIED]` clean on `main`) and the 620/620 tests reproduce; then schedule merge (separate authorized session).

## B2 — #99 base branch has merged (stacked-on-merged)

- **What:** #99 (Apify Phase-2) base = `claude/sales-closer-engine-plan-c3quih`, which **merged at 10:31:30Z** `[VERIFIED]`. CI is green only against that now-merged base.
- **Owner / decision needed:** engineering — retarget + rebase.
- **Severity:** Medium. Mechanical but blocks review/merge of the Apify lane.
- **Unblock action:** retarget base → `main`, rebase, re-run CI, re-validate against #93's landed `closer_*` schema and #97 unions. Keep draft, fixture-first, network-off.

## B3 — Legal / compliance sign-off owner unnamed (gates go-live)

- **What:** #92 + #100 both flag that **any** real outreach/ads/vendor activity requires named legal/compliance sign-off (CASL/CRTC/PIPEDA). `[INFERRED]` Currently nobody is named.
- **Owner / decision needed:** Muhammad/Feroz to name a compliance sign-off owner.
- **Severity:** High **for go-live**, Low for current spec-only work (nothing live is happening).
- **Unblock action:** name the owner now so it is not on the critical path later. Until named, all outreach/ads/vendor stays simulated (hard rule — already honored).

## B4 — Canonical-branch selection among duplicate lanes

- **What:** Multiple parallel lanes target the same outcome — Sales Closer foundation (#93/#97 vs #94), vendor memo (#98 vs #95), dealership (#106 vs #90 vs #109), Lead-Detail (#44/#45/#79/#46), goal-loop (#105 vs #100). `[INFERRED]`
- **Owner / decision needed:** manager to ratify canonical picks (recommendations in WORKSTREAM-MAP).
- **Severity:** Medium. Ambiguity slows convergence and risks duplicate merges.
- **Unblock action:** Day-3 — use #107 inventory + this folder to record picks; mark losers "superseded pending manager review" (no closing/deleting).

## B5 — Client Zero consent status unknown

- **What:** Is there a **real consenting dealership** for Client Zero, or is #106 spec-only? `[INFERRED]` Unconfirmed. (#100 lists this as an explicit founder decision.)
- **Owner / decision needed:** Muhammad/Feroz.
- **Severity:** High for execution (baseline/discovery cannot start without it), None for artifact readiness (#106 is ready either way).
- **Unblock action:** confirm yes/no. If no, keep #106 spec-only; do not simulate outreach as if live.

## B6 — Local consolidation branch lacks the monorepo (verification friction)

- **What:** `[VERIFIED]` The working branch `claude/cognitia-master-consolidation-p8y421` was cut from the ep002 branch and contains only `hermes/` — not `main`'s `apps/`/`packages/`. Deep code verification must go through the GitHub API, not the local tree.
- **Owner / decision needed:** none (process note).
- **Severity:** Low. Did not block this report (PR + file reads done via API).
- **Unblock action:** for code-level audits, read via `get_file_contents` on `main`/branch refs, or check out `main` in a separate worktree. Not required for the docs deliverable.

---

## Not blockers (explicitly)

- The 76 closed PRs (`merge-UNVERIFIED`) are **not** blockers — they are history/parked R&D. Resolve their merge status per-PR only if a specific lane is revived.
- Agent-economy / crypto-visibility lanes are **parked by decision**, not blocked. See PARKED-AND-KILLED.md.
