# Branch Inventory — 110 unmerged `claude/*` branches (+ `main`)

> **Source (verified):** `git for-each-ref --sort=-committerdate refs/remotes/origin`, observed 2026-06-20.
> **Workstream / tier / disposition (inference):** assigned from branch name + commit date only. NOT a content audit. No branch is certified production-ready.
> **Disposition legend:** `Build` = on critical/usable path, merge candidate · `Ref` = reference/keep, low merge priority · `Park` = parked strategic R&D (WS12), keep in place, frozen · `Superseded?` = duplicate-set loser candidate, **pending manager review before any close**.

## Tier-1 — Critical path to Client Zero

| Branch                                    | Date       | WS  | Disposition | Notes                                      |
| ----------------------------------------- | ---------- | --- | ----------- | ------------------------------------------ |
| `sales-closer-architecture-989w7r`        | 2026-06-20 | WS1 | Build       | Design of record (canonical candidate)     |
| `sales-closer-engine-plan-c3quih`         | 2026-06-20 | WS1 | Build       | Engine plan (canonical candidate)          |
| `sales-closer-vendor-readiness-u847qr`    | 2026-06-20 | WS1 | Build       | Voice/text vendor posture                  |
| `sales-closer-vendor-integration-porting` | 2026-06-20 | WS1 | Build       | Vendor integration porting                 |
| `sales-closer-phase2-apify`               | 2026-06-20 | WS1 | Build       | Data sourcing (Apify)                      |
| `sales-closer-datasource-strategy-ory6db` | 2026-06-19 | WS1 | Build       | Data source strategy                       |
| `cog-002-schema-foundation`               | 2026-06-11 | WS6 | Build       | **Data spine** — merge-blocker for WS3/4/5 |
| `cog-003-proof-registry`                  | 2026-06-11 | WS6 | Build       | Proof registry                             |
| `cog-004-atc`                             | 2026-06-11 | WS6 | Build       | ATC                                        |
| `cog-016-field-provenance`                | 2026-06-12 | WS6 | Build       | Field provenance                           |
| `v6-managed-postgres-rls-edx5vo`          | 2026-06-15 | WS6 | Build       | Managed Postgres + RLS (multi-tenant)      |
| `v6a-docs-reconcile`                      | 2026-06-16 | WS6 | Ref         | Docs reconcile                             |
| `feat/cognitia-compliance-layer-scaffold` | 2026-06-20 | WS7 | Build       | **TCPA/consent foundation**                |
| `cognitia-compliance-design-xpzaj3`       | 2026-06-19 | WS7 | Build       | Compliance design                          |
| `ai-drafting-governance-9jdhkd`           | 2026-06-15 | WS7 | Build       | AI drafting governance                     |
| `enf-1-enforced-governance`               | 2026-06-10 | WS7 | Build       | Enforced governance                        |
| `gov-1-typed-write-preview`               | 2026-06-10 | WS7 | Build       | Typed write preview (human-in-loop)        |
| `scope-guardrail-no-thesis-pivots`        | 2026-06-10 | WS7 | Ref         | Scope guardrail                            |
| `visibility-005-threat-governance`        | 2026-06-15 | WS7 | Ref         | Threat governance                          |
| `hubspot-pilot-readiness-t7thv5`          | 2026-06-15 | WS4 | Build       | HubSpot readiness (canonical candidate)    |
| `hubspot-pilot-readiness-71gwhd`          | 2026-06-15 | WS4 | Superseded? | Duplicate of `…-t7thv5`                    |
| `meeting-notes-hubspot-writeback`         | 2026-06-15 | WS4 | Build       | CRM write-back (round-trip proof)          |
| `lane-e-meeting-workflow-gkpnz9`          | 2026-06-15 | WS4 | Build       | Meeting workflow                           |
| `prov-1-hubspot-provenance`               | 2026-06-10 | WS4 | Build       | HubSpot provenance                         |
| `crm-note-1-grounded-context-note`        | 2026-06-10 | WS4 | Build       | Grounded CRM note                          |
| `evid-1-sync-and-opportunities`           | 2026-06-11 | WS4 | Build       | Sync + opportunities                       |
| `pilot-001-proof-harness-a7aofs`          | 2026-06-15 | WS3 | Build       | Pilot proof harness (canonical candidate)  |
| `pilot-001-mainline-proof-harness`        | 2026-06-15 | WS3 | Superseded? | Duplicate proof harness                    |
| `pilot-001-lane-status-update`            | 2026-06-15 | WS3 | Ref         | Pilot lane status                          |
| `cog-005-006-skillproof-ai-front-desk`    | 2026-06-11 | WS3 | Build       | AI front desk (receptionist)               |
| `rdy-1-connection-readiness`              | 2026-06-10 | WS3 | Ref         | Connection readiness                       |
| `alpha-1-live-readiness`                  | 2026-06-10 | WS3 | Ref         | Live readiness checklist                   |

## Tier-2 — Needed for a usable pilot

| Branch                                        | Date       | WS  | Disposition | Notes                                       |
| --------------------------------------------- | ---------- | --- | ----------- | ------------------------------------------- |
| `cog-011-lead-detail-console`                 | 2026-06-15 | WS5 | Build       | Lead-detail console (canonical candidate)   |
| `cog-011-lead-detail`                         | 2026-06-12 | WS5 | Superseded? | Duplicate lead-detail                       |
| `cog-011-012-lead-detail-tenant-provisioning` | 2026-06-12 | WS5 | Superseded? | Duplicate lead-detail + tenant provisioning |
| `operator-ui-shell-yzuotn`                    | 2026-06-15 | WS5 | Build       | Operator UI shell                           |
| `approval-workflow-operator-ui-a2fh6h`        | 2026-06-15 | WS5 | Build       | Approval workflow UI                        |
| `ux-2-batch-and-history`                      | 2026-06-10 | WS5 | Build       | Batch + history UX                          |
| `a11y-1-route-accessibility`                  | 2026-06-11 | WS5 | Ref         | Route accessibility                         |
| `a11y-2-authenticated-queue`                  | 2026-06-11 | WS5 | Ref         | Authenticated queue a11y                    |
| `auto-growth-dealership-proposal-22ntav`      | 2026-06-20 | WS2 | Build       | **Client Zero offer/wedge**                 |
| `demandara-gtm-scaffold`                      | 2026-06-20 | WS2 | Build       | Demandara GTM scaffold                      |
| `cognitia-36h-gtm-report-trwx36`              | 2026-06-20 | WS2 | Build       | 36h GTM report                              |
| `gtm-platform-mvp-setup-vYLBG`                | 2026-06-15 | WS2 | Build       | GTM platform MVP setup                      |
| `cog-014-demandara-onboarding`                | 2026-06-12 | WS2 | Build       | Demandara onboarding                        |
| `business-plan-audit-rz5k5d`                  | 2026-06-18 | WS2 | Ref         | Business plan audit                         |
| `next-phase-strategy`                         | 2026-06-10 | WS2 | Ref         | Next-phase strategy                         |
| `next-phase-summary`                          | 2026-06-10 | WS2 | Ref         | Next-phase summary                          |
| `cognitia-gtm-competitor-research-fpxg4o`     | 2026-05-28 | WS2 | Build       | **This branch** (consolidation pack)        |
| `sec-1-hardening-audit`                       | 2026-06-12 | WS8 | Ref         | Hardening audit                             |
| `hard-1-hardening-package`                    | 2026-06-10 | WS8 | Ref         | Hardening package                           |
| `hard-4-reanchor-security-docs`               | 2026-06-10 | WS8 | Ref         | Security docs reanchor                      |
| `soc-1-readiness-package`                     | 2026-06-11 | WS8 | Ref         | SOC readiness                               |
| `cog-007-010-command-audit-proof-pack`        | 2026-06-11 | WS8 | Ref         | Command audit proof pack                    |
| `cog-008-reputation-v0`                       | 2026-06-11 | WS8 | Ref         | Reputation v0                               |
| `cog-009-credits-wallet-placeholder`          | 2026-06-11 | WS8 | Park        | Credits wallet placeholder                  |
| `trust-2-packet`                              | 2026-06-10 | WS8 | Ref         | Trust packet                                |
| `truth-1-machine-readable-report`             | 2026-06-11 | WS8 | Ref         | Machine-readable report                     |

## Tier-3 — Keep the best, park or mark superseded candidates for review

| Branch                                 | Date       | WS   | Disposition | Notes                                             |
| -------------------------------------- | ---------- | ---- | ----------- | ------------------------------------------------- |
| `eval-1-golden-gate`                   | 2026-06-10 | WS9  | Ref         | Golden-gate eval                                  |
| `sim-1-preflight`                      | 2026-06-10 | WS9  | Ref         | Preflight sim                                     |
| `met-1-trust-metrics`                  | 2026-06-10 | WS9  | Ref         | Trust metrics                                     |
| `learn-1-scorecards`                   | 2026-06-10 | WS9  | Ref         | Scorecards                                        |
| `regr-1-rejection-flywheel`            | 2026-06-10 | WS9  | Ref         | Rejection flywheel                                |
| `fly-1-decision-reasons`               | 2026-06-10 | WS9  | Ref         | Decision reasons                                  |
| `why-1-decision-rationale`             | 2026-06-10 | WS9  | Ref         | Decision rationale                                |
| `undo-1-rollback`                      | 2026-06-10 | WS9  | Ref         | Rollback                                          |
| `run-1-run-plans`                      | 2026-06-10 | WS9  | Ref         | Run plans                                         |
| `run-2-run-detail-timeline`            | 2026-06-11 | WS9  | Ref         | Run detail timeline                               |
| `run-3-run-lineage`                    | 2026-06-12 | WS9  | Ref         | Run lineage                                       |
| `alpha-1-checklist-fix`                | 2026-06-10 | WS9  | Ref         | Checklist fix                                     |
| `cognitia-36hr-loop-blh9oe`            | 2026-06-20 | WS10 | Ref         | 36hr loop harness                                 |
| `cognitia-goal-loop-harness-xd6laa`    | 2026-06-20 | WS10 | Ref         | Goal-loop harness                                 |
| `cognitia-goal-loop-sprint-0dl803`     | 2026-06-20 | WS10 | Ref         | Goal-loop sprint                                  |
| `6-hour-checkpoint-3m29tz`             | 2026-06-20 | WS10 | Ref         | 6h checkpoint                                     |
| `pr-execution-order-oce1w6`            | 2026-06-20 | WS10 | Ref         | **Useful for consolidation** — PR execution order |
| `parallel-build-merge-ob37sg`          | 2026-06-15 | WS10 | Ref         | **Useful for consolidation** — merge helper       |
| `code-28-50-integrator-qo4x4b`         | 2026-06-15 | WS10 | Ref         | **Useful for consolidation** — integrator         |
| `overnight-orchestrator-status-huta9u` | 2026-06-15 | WS10 | Ref         | Orchestrator status                               |
| `mainline-runtime-status`              | 2026-06-13 | WS10 | Ref         | Mainline runtime status                           |
| `audit-booklet-001-system-booklet`     | 2026-06-15 | WS10 | Ref         | System booklet                                    |
| `rdm-1-readme-coherence`               | 2026-06-10 | WS10 | Ref         | README coherence                                  |
| `wave-2-summary`                       | 2026-06-10 | WS10 | Ref         | Wave 2 summary                                    |
| `exciting-shannon-tzei5l`              | 2026-06-20 | WS10 | Ref         | Unclear name — review to classify                 |
| `fix-hermes-bridge-stdio-loop`         | 2026-06-18 | WS11 | Ref         | Hermes bridge stdio fix                           |
| `windows-hermes-mesh-bridge-tjTQ5`     | 2026-06-14 | WS11 | Ref         | Windows Hermes mesh bridge                        |
| `plot-sessions-audit-g5skwx`           | 2026-06-16 | WS11 | Ref         | Plot sessions audit                               |
| `cognitia-v1-1-discovery-g6ryrg`       | 2026-06-11 | WS11 | Ref         | v1.1 discovery                                    |
| `cognitia-episode-002-rebuild-5ffai`   | 2026-05-30 | WS11 | Ref         | Episode 002 rebuild                               |
| `ep002-mission-run-pPoba`              | 2026-05-28 | WS11 | Ref         | Episode 002 mission run                           |

## PARK — Parked Strategic R&D (WS12): strategically relevant, execution-paused

> Keep branches in place. Freeze. No archive, no delete. Revisit after Client Zero pilot ships.

| Branch                                      | Date       | Notes                               |
| ------------------------------------------- | ---------- | ----------------------------------- |
| `agent-economy-001-lab`                     | 2026-06-12 | Agent economy lab                   |
| `agent-economy-002-dispute-resolution`      | 2026-06-12 | Dispute resolution                  |
| `agent-economy-003-agent-actions`           | 2026-06-12 | Agent actions                       |
| `agent-economy-004-marketplace`             | 2026-06-12 | Marketplace (dup with `…-matching`) |
| `agent-economy-004-marketplace-matching`    | 2026-06-12 | Marketplace matching (dup)          |
| `agent-economy-005-settlement-design`       | 2026-06-12 | Settlement design                   |
| `agent-economy-2week-spec`                  | 2026-06-10 | 2-week spec                         |
| `token-lab-002-architecture`                | 2026-06-12 | Token lab architecture              |
| `pass-1-agent-passports`                    | 2026-06-12 | Agent passports                     |
| `economy-smoke-001`                         | 2026-06-13 | Economy smoke test                  |
| `legend-001-agent-fabric-lab`               | 2026-06-15 | Agent fabric lab                    |
| `audit-booklet-001b-agent-fabric-reconcile` | 2026-06-15 | Agent fabric reconcile              |
| `crypto-visibility-001`                     | 2026-06-14 | Crypto visibility                   |
| `12h-crypto-visibility-agent-fabric`        | 2026-06-14 | 12h crypto visibility               |
| `visibility-002-researcher-pack`            | 2026-06-14 | Researcher pack                     |
| `visibility-003-diligence-discoverability`  | 2026-06-14 | Diligence discoverability           |
| `visibility-004-api-surface-reference`      | 2026-06-14 | API surface reference               |
| `v4-trust-proof-explorer`                   | 2026-06-14 | Trust-proof explorer                |
| `v4b-public-proof-feed`                     | 2026-06-14 | Public proof feed                   |
| `v4c-curated-trust-proofs`                  | 2026-06-14 | Curated trust proofs                |
| `v5-public-trust-feed-hardening`            | 2026-06-14 | Public trust feed hardening         |

## Reconciliation note (duplicate sets → manager review)

| Set                        | Branches                                                        | Recommended canonical (pending review) |
| -------------------------- | --------------------------------------------------------------- | -------------------------------------- |
| HubSpot readiness          | `…-t7thv5`, `…-71gwhd`                                          | `…-t7thv5` (TBD by deep-dive)          |
| Lead detail                | `…-console`, `cog-011-lead-detail`, `…-012-tenant-provisioning` | `…-console` (TBD)                      |
| Pilot proof harness        | `…-a7aofs`, `pilot-001-mainline-proof-harness`                  | `…-a7aofs` (TBD)                       |
| Agent marketplace (parked) | `agent-economy-004-marketplace`, `…-matching`                   | reconcile only if WS12 unparked        |

**Totals:** 110 work branches + `main` = 111 remote refs (reconciles with `git branch -r | grep -v HEAD | wc -l`).
