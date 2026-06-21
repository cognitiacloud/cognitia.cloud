# DECISIONS — standing register (what's locked, parked, killed)

**Compiled:** 2026-06-21 · companion to `BOARD.md`. This is the canonical "what we are / aren't building" register. The controller **enforces** these by recording and routing — it does not unilaterally reverse a parked/killed call.

## 1. Thesis (LOCKED)

**Cognitia** = agent **trust / control plane** (governance, kill-switch, audit, proofs, RLS) **+ compliance layer + Sales Closer / GTM operating system.**
**Demandara** = the GTM / growth / operator brand on top.
**Sales Closer** = voice + text **lead-qualification** product (qualify & hand off — *not* "replace your sales team").
**Client Zero** = a single auto-dealership proof loop (Auto Growth OS), used to prove the spine end-to-end.

**Hermes Vision Skill** = ONE supporting **publish-safety** artifact (content QC gate). **Cognitia is not a video/avatar/media company.** Do not let media tooling (HeyGen/Higgsfield/Canva/Gamma etc.) redefine positioning.

## 2. LOCKED build order (current thesis)

1. **Merged spine (done):** #97 (core GTM primitives) → #91 (data-source strategy) → #92 (compliance spec) → #98 (vendor porting memo) → #93 (canonical closer data layer) → #96 (compliance UI/demo). All `merged_at`-verified this session.
2. **Next (review-gate, no build yet):** #99 retarget *recommendation* → #107/#110 reconciliation → #106 + #105 guardrail review → spine read-through.
3. **Only after review-gate clears** does any new feature build start — and only on the canonical lanes the manager ratifies.

## 3. PARKED — execution-paused, code kept in place (NO forward build)

> "Parked" governs **future** work. Some of this is already merged on `main`; it is **frozen** — no extension, no new surface, no reactivation without explicit re-authorization.

| Lane | PRs | Why parked |
| --- | --- | --- |
| **Agent Economy** | #48, #49, #51, #52, #53, #54, #55, #69, #18 | Off current Sales-Closer thesis; revisit only post-spine. |
| **Internal token sandbox** | #55 / token-lab | **Internal-ledger-only.** No issuance, no external token. Sandbox stays sandboxed. |
| **Crypto-visibility / public trust feed** | #58, #59, #60, #62, #63, #64, #65, #66, #67, #68 | Not part of trust-plane GA; no public-token/crypto tie-in. |
| **Gated expansions** | — | Multi-vertical, self-serve onboarding, **mobile**, paid-media engine, performance-share pricing: all gated until Client Zero proof + legal sign-off. |

## 4. KILLED — do not build, do not message (hard rules)

- ❌ **Public token / coin / liquidity / listing**; any investor-token promise.
- ❌ **"Replace your sales team"** / full-autonomy sales messaging. (Closer **qualifies + hands off**.)
- ❌ **Guaranteed** sales, ROI, SEO/ranking, or lead-volume claims.
- ❌ **Voice / SMS / WhatsApp as launch wedge** — blocked at launch per #92 (consent/compliance). Simulated only until legal sign-off.
- ❌ **Paid ads / live ad spend** (incl. #109 media-house engine — spec/sim only, no live spend).
- ❌ **Real outreach, live vendor API calls, scraping at scale, credential testing** — all closer/apify paths stay containment-tested (no `fetch`/`child_process`/`ApifyClient`/network in prod paths, per #93 guard test).
- ❌ Reframing Cognitia as a **video/avatar/media** company.

## 5. Compliance doctrine (from merged #91/#92/#93/#96/#97 — enforced)

- **PII: hashed/masked/domain only.** No raw `email`/`phone`/`full_name` columns or serialized values (guard tests in #93/#96/#97).
- **Consent-gated outreach;** append-only `compliance_log`; per-channel rules; SMS/WhatsApp/AI-voice **blocked at launch**.
- **Source-risk gating:** a `disallowed` source can never be active (DB CHECK + zod + repo).
- **Evidence doctrine:** every brief claim evidence-tagged; `verified_fact` requires an `evidence_ref`.
- **Approvals/handoff** flow through existing `agent_actions` + `/approvals`; history via append-only `events`.
- **Client Zero guardrail:** no guaranteed sales/ROI; finance & trade-in are **handoff + human-approval marker**, never autonomous commitments.

## 6. Scope-change rule (#19)

No pivot to an agent-economy/token thesis — or any repositioning away from §1 — **without explicit founder re-authorization.** The controller surfaces such requests via `AskUserQuestion` rather than acting.

## 7. Open manager decisions (blocking, owner = founder/manager)

1. **Legal/compliance sign-off owner** — unnamed; gates all live outreach/ads/vendor. (BOARD B3)
2. **Client Zero consent** — is there a real dealership, or spec-only? (BOARD B5)
3. **Canonical-lane ratification** — lead-detail (#44/#45/#79/#46) and the other duplicate clusters. (QUEUE §D)
4. **#99 retarget go-ahead** — approve the documented retarget/rebase plan for an authorized eng session.
