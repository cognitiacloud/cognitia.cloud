# Cognitia Loop — Artifact Index

_Every artifact produced by the loop. Updated each checkpoint._

## Control plane (`cognitia/loop/`)

| File | Purpose |
|------|---------|
| `GUARDRAILS.md` | Hard-stop boundaries, classification legend, PII policy |
| `ROADMAP.md` | Living roadmap (now / next / parked / killed) |
| `DECISIONS.md` | Centralized founder decisions log (Checkpoint 0 answers) |
| `ARTIFACT_INDEX.md` | This index |
| `checkpoints/checkpoint-00-hour0.md` | Hour-0 checkpoint report |
| `prompts/next-loop-prompts.md` | Claude prompts for the next loop |

## Worker A — GTM / Competitor Research

| File | Purpose |
|------|---------|
| `workers/A-gtm-competitor-research/competitor-map.md` | 3-lane competitor teardown (agent-trust infra, dealer growth OS, AI-SDR) |
| `workers/A-gtm-competitor-research/positioning-brief.md` | Wedge positioning, ICP, value props, objections |
| `workers/A-gtm-competitor-research/gtm-channels.md` | Ranked channel hypotheses + cheap test designs (no live outreach) |

## Worker B — Client Zero Auto Growth OS

| File | Purpose |
|------|---------|
| `workers/B-client-zero-auto-growth-os/auto-growth-os-spec.md` | Dealership growth loop, agents, data model (synthetic) |
| `workers/B-client-zero-auto-growth-os/mock-workflows.md` | 3 end-to-end MOCK workflows (all sends labeled NOT SENT) |
| `workers/B-client-zero-auto-growth-os/kpis-and-proof.md` | KPI tree + what proof layer can/cannot attest |
| `workers/B-client-zero-auto-growth-os/sales-closer-prompts.md` | Sales Closer prompt drafts + claims blocklist |

## Worker C — Ads + Media House

| File | Purpose |
|------|---------|
| `workers/C-ads-media-house/ads-media-engine-spec.md` | Agentic ads engine architecture + human gates |
| `workers/C-ads-media-house/creative-test-plan.md` | Creative testing framework (test designs only) |
| `workers/C-ads-media-house/creative-briefs.md` | 3 sample briefs + compliant reframes |
| `workers/C-ads-media-house/compliance-guardrails.md` | Auto-ad compliance checklist (TILA/FTC, cited) |

## Worker D — Agent Economy + Token Sandbox

| File | Purpose |
|------|---------|
| `workers/D-agent-economy-token-sandbox/token-credit-sandbox-design.md` | Internal NO-CASH-VALUE credit system design |
| `workers/D-agent-economy-token-sandbox/ledger-schema.md` | Double-entry action-ledger + credit-account data model |
| `workers/D-agent-economy-token-sandbox/proof-layer-spec.md` | Attestation model: what it can/cannot assert |
| `workers/D-agent-economy-token-sandbox/sandbox-test-plan.md` | Conservation / double-spend / replay test designs |

## Worker E — Harness Builder (runnable MVP)

| File | Purpose |
|------|---------|
| `workers/E-harness-builder/harness-spec.md` | File-based goal-loop harness spec |
| `workers/E-harness-builder/harness_mvp.py` | Stdlib-only runnable MVP (mock executors, guardrail chokepoint) |
| `workers/E-harness-builder/goals.example.json` | Sample goals incl. actions the guardrail blocks |
| `workers/E-harness-builder/test_harness.py` | 12 unittest cases (VERIFIED passing) |
| `workers/E-harness-builder/README.md` | Run instructions + scope limits |
| `workers/E-harness-builder/run_output/*` | Generated ledger + checkpoint sample |
