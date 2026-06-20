# EXECUTION BOARD

**Compiled:** 2026-06-20 · Owners: **Mgr** = Muhammad/Feroz decision · **Eng** = engineering session (authorized) · **Watch** = monitor only. Status: `[VERIFIED]` facts as of compile time. This session takes no merge/undraft/close actions.

---

## Critical path

| #   | Task                                                       | Owner     | Status                                                                        | Acceptance criteria                                                                                                                    | Next action                                                 |
| --- | ---------------------------------------------------------- | --------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| T1  | Review & merge #96 (compliance layer)                      | Mgr + Eng | ✅ **DONE** — merged to `main` 2026-06-20T23:42:20Z (`d3d198e7`) `[VERIFIED]` | Landed UI/helper/demo-only: `apps/web/**` + docs, zero `packages/core` diff, no DB/API/worker/vendor/outreach; CI green pre-merge      | None — complete                                             |
| T2  | Retarget + rebase #99 (Apify Phase-2) onto `main`          | Eng       | Blocked-mechanical — base branch merged `[VERIFIED]`                          | Base = `main`; rebased cleanly; CI re-run green; validated vs landed `closer_*` schema + #97 unions; still fixture-first/network-off   | Retarget base → `main`, rebase, re-run CI                   |
| T3  | Ratify canonical branch picks (collapse duplicates)        | Mgr       | Pending                                                                       | Each duplicate cluster has one canonical pick; losers marked "superseded pending manager review" (not closed)                          | Day-3: use #107 inventory + WORKSTREAM-MAP §Duplicate table |
| T4  | Resolve Lead-Detail duplicate lanes (#44/#45/#79/#46)      | Mgr + Eng | Pending                                                                       | Exactly one COG-011/012/014 lead-detail lane chosen as canonical                                                                       | Compare the four; pick one                                  |
| T5  | Review Client Zero package #106 as proof artifact          | Mgr       | Ready — draft, guardrails built-in `[VERIFIED state]`                         | Guardrails verified (no guaranteed sales/ROI; finance/trade-in = handoff + approval marker); Hermes Vision gate referenced not rebuilt | Day-4 review; keep ready                                    |
| T6  | Reach one green Client Zero × Sales Closer spine on `main` | Eng       | Not started                                                                   | End-to-end contract trace passes: #97 → #91 → #93 → #92/#96 → #99 → #106 with no gap                                                   | Day-5 read-through; produce spine gap list (append here)    |

## Decisions (Mgr only)

| #   | Decision                                         | Owner | Status                   | Acceptance criteria                     | Next action |
| --- | ------------------------------------------------ | ----- | ------------------------ | --------------------------------------- | ----------- |
| D1  | Automotive dealership = sole near-term beachhead | Mgr   | Open                     | Yes/No on record                        | Confirm     |
| D2  | Flat pilot fee; park performance-share           | Mgr   | Open                     | Pricing posture on record               | Confirm     |
| D3  | Public token stays killed                        | Mgr   | Open (recommend: kill)   | Kill confirmed on record                | Confirm     |
| D4  | Name legal/compliance sign-off owner             | Mgr   | Open — **gates go-live** | A named person owns compliance sign-off | Name owner  |
| D5  | Consenting Client Zero dealership exists?        | Mgr   | Open                     | Yes/No; if No, keep spec-only           | Confirm     |

## Watch-only (no action unless CI/review demands)

| #   | Item                                                  | Owner | Status             | Acceptance criteria                   | Next action     |
| --- | ----------------------------------------------------- | ----- | ------------------ | ------------------------------------- | --------------- |
| W1  | #100 Goal Loop Sprint artifacts                       | Watch | Draft `[VERIFIED]` | Remains draft; informs strategy       | none            |
| W2  | #104 ep002 / Hermes Vision QC checkpoint              | Watch | Draft `[VERIFIED]` | Remains draft, docs-only              | none            |
| W3  | #105 goal-loop harness (`hctl.py`)                    | Watch | Draft `[VERIFIED]` | Remains draft; sandboxed to `goals/`  | none            |
| W4  | #107 GTM consolidation index                          | Watch | Draft `[VERIFIED]` | Use as branch-selection input (T3)    | reference in T3 |
| W5  | #89 investor audit / wedge (open non-draft)           | Mgr   | Open `[VERIFIED]`  | Triaged into a workstream             | Day-6 triage    |
| W6  | Misc open drafts #86/#78/#88/#101/#102/#103/#108/#109 | Watch | Draft              | Triaged watch-only vs close-candidate | Day-6 triage    |

## Parked (do not action — see PARKED-AND-KILLED.md)

| #   | Item                                              | Owner | Status | Reactivation criteria                                       |
| --- | ------------------------------------------------- | ----- | ------ | ----------------------------------------------------------- |
| K1  | Agent Economy (#48–#54, #69, #18)                 | —     | Parked | Spine green + explicit re-authorization                     |
| K2  | Internal token sandbox (#55)                      | —     | Parked | Concrete internal-accounting need + D4 named; internal-only |
| K3  | Crypto visibility / trust feed (#58–#68)          | —     | Parked | Separately re-authorized initiative                         |
| K4  | Multi-vertical / self-serve / mobile / paid-media | —     | Gated  | Client Zero proof demonstrated + gate opened                |

---

## Definition of done for this consolidation

- [x] Every decision-critical PR state verified via GitHub API (not memory).
- [x] Merged foundation (#91/#92/#93/#97/#98) confirmed with `merged_at` timestamps.
- [x] #96 convergence verified at the core-types level on `main`.
- [x] #96 compliance layer **merged** to `main` 2026-06-20T23:42:20Z (`d3d198e7`), UI/helper/demo-only — zero `packages/core` diff.
- [x] Duplicate lanes identified; canonical picks recommended.
- [x] Parked/killed list explicit with reactivation criteria.
- [ ] (Team) T1–T6 executed in authorized sessions; this folder updated at Day-7 checkpoint.
