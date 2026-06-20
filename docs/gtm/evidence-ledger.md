# Evidence Ledger

> Rule: separate **VERIFIED** (directly observed this session) from **INFERENCE** (analysis from names/patterns) from **NEEDS-VERIFICATION** (external/market claims to confirm before relying on them).

## A. Verified facts (observed this session, 2026-06-20)

| #   | Claim                                                                                                                                                        | Source                                                                                    | Date       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ---------- |
| A1  | Repo has 111 remote refs incl. `main` (110 work branches)                                                                                                    | `git branch -r \| grep -v HEAD \| wc -l` → 111                                            | 2026-06-20 |
| A2  | All work branches are `claude/*` agent lanes (+ one `feat/*`)                                                                                                | `git for-each-ref refs/remotes/origin`                                                    | 2026-06-20 |
| A3  | Branch commit dates span 2026-05-28 → 2026-06-20                                                                                                             | `git for-each-ref --sort=-committerdate`                                                  | 2026-06-20 |
| A4  | `main`'s substantive content is the Hermes Vision Skill (Python OCR + multi-provider vision QC)                                                              | Repo exploration: `hermes/skills/vision-skill/README.md`, `vision_skill.py`, `skill.yaml` | 2026-06-20 |
| A5  | No GTM/competitor/strategy/pricing docs existed in repo before this pack                                                                                     | Repo exploration (no `docs/`, no README at root)                                          | 2026-06-20 |
| A6  | Duplicate branch lanes exist: 2× `hubspot-pilot-readiness-*`, 3× `cog-011-lead-detail*`, 2× `pilot-001-*-proof-harness`, 2× `agent-economy-004-marketplace*` | `git for-each-ref` listing                                                                | 2026-06-20 |
| A7  | Sales Closer, Demandara, compliance, HubSpot, pilot, operator-UI branch names all present                                                                    | `git for-each-ref` listing                                                                | 2026-06-20 |

## B. Inference (analysis — not audited)

| #   | Claim                                                                 | Basis                                                                                                     | Confidence |
| --- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------- |
| B1  | The work describes a GTM/AI-sales platform, not a video company       | Branch-name clustering (Sales Closer, Demandara, CRM, compliance, lead console)                           | High       |
| B2  | 12-workstream mapping (WS1–WS12)                                      | Branch names + dates only; no code read                                                                   | Medium     |
| B3  | WS1/WS6/WS7/WS4/WS3 are the Client-Zero critical path                 | Product logic: callable+textable closer needs engine+schema+compliance+CRM+pilot                          | High       |
| B4  | `cog-002-schema-foundation` is a merge-blocker for WS3/4/5            | Schema typically underlies lead/CRM/UI lanes                                                              | Medium     |
| B5  | Compliance (TCPA/consent) is a hard gate before dealership outbound   | US telemarketing law applies to auto BDC calling/texting (see C-section, NEEDS-VERIFICATION on specifics) | High       |
| B6  | WS12 (agent economy + crypto visibility) is a separate strategic line | Names unrelated to dealership Sales Closer thesis                                                         | High       |
| B7  | Recommended canonical branches per duplicate set                      | Recency + naming; **pending deep-dive + manager review**                                                  | Low        |
| B8  | Branch-per-workstream counts (±)                                      | Name inference; some branches straddle workstreams                                                        | Medium     |

## C. Market context — NEEDS-VERIFICATION

> The competitor/market claims in `competitor-teardown.md` and `parity-vs-superiority.md` are drawn from general knowledge (assistant cutoff Jan 2026) and were **not** all re-confirmed against live vendor pages in this session. Two background web-research agents were dispatched for Alta/Clay/Apollo/SalesCloser.ai and Lindy/Vapi/Retell/n8n/auto-lead-gen/dealer-CRM; their citations should be folded in and each pricing/feature claim stamped with a source URL + observation date before these are used in external materials.

| #   | Claim to verify                                                                     | Where to verify                     | Status                 |
| --- | ----------------------------------------------------------------------------------- | ----------------------------------- | ---------------------- |
| C1  | Vapi / Retell per-minute voice pricing & latency                                    | vapi.ai, retellai.com pricing pages | Pending                |
| C2  | Apollo / Clay tier pricing and AI-SDR feature sets                                  | apollo.io, clay.com pricing         | Pending                |
| C3  | SalesCloser.ai voice+video demo/close capability, languages                         | salescloser.ai                      | Pending                |
| C4  | Alta product scope (AI revenue/sales agent)                                         | altahq.com                          | Pending                |
| C5  | Automotive lead-gen incumbents (Podium, Impel, CarNow, Gubagoo) AI/voice features   | vendor sites                        | Pending                |
| C6  | Dealer CRM landscape (VinSolutions, DealerSocket, Elead, Tekion, CDK) automation/AI | vendor sites                        | Pending                |
| C7  | TCPA / consent / quiet-hours specifics for auto BDC outbound                        | FCC/FTC + counsel                   | Pending — legal review |

## D. Method notes

- Branch list is the authoritative artifact (verified). Everything downstream of it is inference until a branch is deep-dived.
- No branch in this pack is described as production-ready.
- Pricing figures elsewhere change frequently → always attach "observed on <date>".
