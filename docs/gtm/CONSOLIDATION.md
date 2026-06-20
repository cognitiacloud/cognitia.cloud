# Cognitia / Demandara — Branch-Level Consolidation Index

> **Mode:** Fast branch-level index. Each branch is **EXISTS BUT UNMERGED / UNCENTRALIZED** unless directly audited. Workstream mapping is inferred from **branch names + commit dates only** — NOT a content audit, and does NOT certify any branch production-ready.
> **Date observed:** 2026-06-20 · **Source:** `git for-each-ref refs/remotes/origin` → 111 remote refs incl. `main` (110 work branches).

## 0. Correction (supersedes the earlier read)

- **Cognitia is not a video/avatar company.** The **Hermes Vision Skill** (on `main`) is **one verified artifact**, not the company thesis.
- The real body of work is a **36-hour, multi-agent build** across **~110 unmerged `claude/*` branches** describing a **GTM / AI-sales platform**: **Demandara** (GTM/sales brand) shipping **Sales Closer** (AI voice+text sales agent), **auto dealership = Client Zero**, plus CRM, compliance, data-schema, operator-UI, and pilot-proof lanes.
- Treat everything below `main` as **claimed, not verified**. Existence ≠ merged ≠ working.

## 1. Brutal verdict

1. **The work exists.** ~110 branches of real, recent, on-thesis effort.
2. **The work is not centralized.** Almost none of it is on `main`.
3. **The repo is carrying too many parallel unmerged lanes** — with visible duplicates (two `hubspot-pilot-readiness-*`, three `cog-011-lead-detail*`, two `pilot-001-*-proof-harness`, two `agent-economy-004-marketplace*`).
4. **The immediate priority is consolidation, not more net-new build.**
5. **Review the few critical-path branches first** (Client Zero / Sales Closer / compliance). Ignore the long tail for now.

## 2. The 12 GTM workstreams (counts approximate, name-inferred)

| #    | Workstream                                                   | ~Count | Tier     |
| ---- | ------------------------------------------------------------ | ------ | -------- |
| WS1  | Sales Closer Engine (product core)                           | 6      | **T1**   |
| WS2  | Demandara GTM & Positioning                                  | 9      | T2       |
| WS3  | Client Zero / Pilot Enablement                               | 6      | **T1**   |
| WS4  | CRM Integration (HubSpot)                                    | 7      | **T1**   |
| WS5  | Lead & Operator Console UI                                   | 8      | T2       |
| WS6  | Data Foundation & Schema                                     | 6      | **T1**   |
| WS7  | Compliance & Governance                                      | 7      | **T1**   |
| WS8  | Security & Trust / SOC Readiness                             | 9      | T2       |
| WS9  | Eval / QA / Decision Quality                                 | 11     | T3       |
| WS10 | Orchestration & Multi-Agent Loop (meta)                      | 12     | T3       |
| WS11 | Hermes Runtime & Vision (verified lineage)                   | 6      | T3       |
| WS12 | **Parked Strategic R&D — Agent Economy + Crypto Visibility** | ~22    | **PARK** |

Full per-branch assignment: see [`branch-inventory.md`](./branch-inventory.md). Scope notes: see [`workstream-map.md`](./workstream-map.md).

## 3. Consolidation priority (review order)

- **Tier 1 — Critical path to Client Zero (review FIRST):** WS1 Sales Closer Engine · WS6 Data Schema · WS7 Compliance · WS4 CRM/HubSpot · WS3 Pilot. The spine of a callable+textable dealership appointment-setter that writes to CRM with consent/TCPA cover.
- **Tier 2 — Needed for a usable pilot:** WS5 Operator Console · WS2 Demandara GTM/offer · WS8 Security/SOC.
- **Tier 3 — Keep the best, park or mark superseded candidates for review:** WS9 Eval, WS10 Orchestration, WS11 Hermes.
- **Park:** WS12 — strategically relevant, execution-paused.

## 4. Park / Build / Reconcile queue

- **BUILD / MERGE (this week):** WS1, WS6, WS7, WS4, WS3 — plus one operator-UI lead-detail branch (WS5) and the dealership proposal (`auto-growth-dealership-proposal-22ntav`).
- **PARK — whole WS12 cluster (decided):** crypto-visibility + trust-proof-feed + agent-economy lineage is a **parked second product line**, not killed — tag + freeze, **keep branches in place** (no archive namespace, no deletion). Revisit after Client Zero pilot ships.
- **RECONCILE DUPLICATES — Worker A recommends, manager reviews (decided):** during the deep-dive I select the canonical branch in each set by **scope fit to current roadmap, build/test health, commit depth/completeness, recency, least architecture drift, least security/compliance risk, easiest path to merge/rebase**, mark loser branches as **superseded candidates** with a pointer to the recommended canonical branch; **wait for manager review before closing anything**, and surface my picks for review (I do **not** auto-pick by date alone). Sets: `hubspot-pilot-readiness-t7thv5` vs `…-71gwhd`; `cog-011-lead-detail` vs `…-console` vs `…-012-tenant-provisioning`; `pilot-001-proof-harness-a7aofs` vs `pilot-001-mainline-proof-harness`; `agent-economy-004-marketplace` vs `…-matching`.

## 5. Top branches to deep-dive next

See [`deep-dive-queue.md`](./deep-dive-queue.md). Shortlist:

1. `sales-closer-architecture-989w7r` + `sales-closer-engine-plan-c3quih` — design of record.
2. `sales-closer-vendor-readiness-u847qr` + `sales-closer-vendor-integration-porting` — voice/text vendor posture (build-vs-buy).
3. `feat/cognitia-compliance-layer-scaffold` + `cognitia-compliance-design-xpzaj3` — TCPA/consent/recording foundation (non-negotiable before dealership outbound).
4. `cog-002-schema-foundation` — data spine; merge-blocker for WS3/4/5.
5. `hubspot-pilot-readiness-t7thv5` + `meeting-notes-hubspot-writeback` — CRM round-trip = Client Zero proof.
6. `pilot-001-proof-harness-a7aofs` — end-to-end pilot proof.
7. `auto-growth-dealership-proposal-22ntav` — Client Zero offer/wedge.

## 6. Next 7-day merge / review plan

See [`7-day-merge-plan.md`](./7-day-merge-plan.md). Summary:

- **Day 1:** Freeze net-new branch creation; land this index; confirm `main` build; tag WS12 for park/freeze.
- **Day 2:** Audit the §5 shortlist; pick canonical winners; mark losers superseded pending review.
- **Day 3:** Merge the spine — `cog-002-schema-foundation` → compliance scaffold → canonical Sales Closer architecture. Green trunk each step.
- **Day 4:** CRM round-trip — chosen HubSpot readiness + `meeting-notes-hubspot-writeback`; reconcile lead-detail into one.
- **Day 5:** Pilot proof — chosen `pilot-001-*-proof-harness`; wire dealership proposal to a concrete Client Zero pilot.
- **Day 6:** Tag/freeze WS12 in place; merge operator-UI shell + canonical lead-detail console.
- **Day 7:** Demonstrable v1 skeleton on `main` — voice+text dealership appointment-setter, end-to-end happy path with consent logging. Publish status + updated ledger.

**Definition of done for the week:** `main` carries the Client-Zero spine green; ≤ ~15 active branches remain (rest merged, parked/frozen, or marked superseded pending manager review); duplicates reconciled; a written deep-dive on each §5 branch.
