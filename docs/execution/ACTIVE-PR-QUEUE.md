# ACTIVE PR QUEUE — open work, triaged

**Compiled:** 2026-06-21 · companion to `BOARD.md`. Covers the **24 open PRs in the verified snapshot through #110** (23 draft + 1 non-draft). State `[VERIFIED]` via `merged_at`/`state` read this session. Classification `[INFERRED]` from PR bodies/branch names. **No PR is acted on this session** (no merge/undraft/close/retarget). Post-#110 review-artifact PRs (#112/#113/#114/#116) are listed in §G as **review docs / watch-only**, separate from this snapshot.

## A. Open non-draft (1) — needs a manager decision first

| PR | Title (abridged) | Base | Call |
| --- | --- | --- | --- |
| **#89** | Investor-grade audit + wedge recommendation | `ep002`(?) | **Triage as docs/GTM strategy.** Only open non-draft. Read-and-route; no merge. Confirm it makes no parked-lane (token/economy) commitments before any action. |

## B. Critical-path-adjacent drafts (review-gate — see BOARD §8)

| PR | Item | Base | First-wave action |
| --- | --- | --- | --- |
| **#99** | Sales Closer Phase-2 Apify scaffold | merged `c3quih` ⚠ | **Review + retarget *recommendation* only.** Base branch already merged → must retarget→`main`, rebase, re-CI. Controller does **not** execute. |
| **#106** | Client Zero / Auto Growth OS package | `ep002`(?) | Guardrail review as proof artifact. Keep draft. |
| **#105** | Goal-loop harness (`harness/hctl.py`) | `ep002`(?) | Review sandbox boundary (`goals/` only). Keep draft. |
| **#107** | GTM consolidation index (`docs/gtm/`) | `ep002`(?) | Input to canonical-pick reconciliation (T3). |
| **#110** | Master consolidation (`docs/consolidation/`) | `ep002`(?) | Reconcile against this board (T3). Prior truth-check pass. |

## C. Watch-only docs/strategy drafts (no action unless asked)

| PR | Item | Note |
| --- | --- | --- |
| #100 | Goal Loop Sprint research/specs | strategy input |
| #101 | Sales-closer doc-sync | low-risk docs |
| #102 | 36-hour loop report | strategy doc |
| #103 | GTM execution report | strategy doc |
| #104 | ep002 / Hermes Vision QC checkpoint | docs-only |
| #108 | Sales-closer doc-sync (2nd) | possible dup of #101 — flag |
| #88 | Cross-session audit `SESSION_AUDIT.md` | triage Day-6 |
| #86 | Meeting-notes surface | triage Day-6 |
| #78 | Operator UI | triage Day-6 |

## D. Duplicate / overlapping lanes — manager picks ONE canonical each (T3/T4)

| Cluster | PRs | Theme | Recommended resolution `[RECOMMENDED]` |
| --- | --- | --- | --- |
| Lead-Detail UI | **#44 / #45 / #79 / #46** | COG-011/012/014 lead-detail surface | Pick exactly one canonical lead-detail lane; mark others "superseded pending manager review". |
| Vendor porting | **#95 vs #98** | vendor integration memo | #98 merged & names #93 canonical → **#98 canonical**; confirm #95 closed/superseded (#95 was closed-unmerged per ledger). |
| Agent-economy actions | **#54 vs #52** | economy action surface | Parked lane — **no pick, no build** (see DECISIONS.md). Freeze both. |
| Dealership GTM demo | **#90 vs #106** | Auto Growth OS surface | #106 is the proof-artifact lane; treat #90 as superseded-adjacent pending review. |
| Doc-sync | **#101 vs #108** | sales-closer doc sync | Fold into one; close the later duplicate after manager review. |

## E. Closed-unmerged (abandoned/superseded) — `[VERIFIED]` no `merged_at`

`#18, #31, #71, #72, #73, #74, #82, #94` — **do not reopen.** #94 = greenfield Sales-Closer prototype explicitly superseded by #93 (reference-only). Others are abandoned spikes.

## F. Queue hygiene rules (this session enforces by *recording only*)

1. No open PR is merged, undrafted, closed, retargeted, or branch-updated by the controller.
2. #99's broken base is **documented**, not fixed here. Any retarget/rebase is a **manager-approved recommendation only** — no execution in this session.
3. Duplicate clusters get a **recommended** canonical pick; the manager ratifies.
4. Parked-lane PRs (economy/crypto) stay frozen regardless of CI state.

## G. Post-snapshot review artifacts (after #110) — review docs / watch-only

Landed after the verified-through-#110 snapshot. **Review/retrospective documentation, not product-build lanes.** Tracked here so the queue is not mistaken for the current all-PR state. No action unless review demands.

| PR | Item | Type | Routes to |
| --- | --- | --- | --- |
| **#112** | PR #99 review artifact | review doc | #99 retarget/rebase **recommendation** (no execution) |
| **#113** | #107 / #110 reconciliation artifact | review doc | canonical-pick reconciliation (§D / T3) |
| **#114** | PR #105 review artifact | review doc | goal-loop harness sandbox review |
| **#116** | PR #96 retrospective review artifact | review doc | landed compliance-layer retrospective |
