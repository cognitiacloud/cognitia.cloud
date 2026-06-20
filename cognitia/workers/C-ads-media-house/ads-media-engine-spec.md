# Ads + Media Engine Spec (Demandara)

**Worker C — Ads + Media House**
**Status:** DESIGN ONLY. Nothing in this document launches. No paid spend, no platform API writes.
**Date:** 2026-06-20

> HARD-STOP REMINDER (GUARDRAILS.md): No paid ad launch, no real ad spend, no real outreach,
> no guaranteed ROI/lead volume, no real PII. Every output here is a PLAN / SPEC / TEST DESIGN.

---

## 1. Purpose

Demandara is the ads/media engine for Cognitia and for Client Zero (the dealership). This spec
defines an **agentic** pipeline that takes a creative brief and walks it through generation,
compliance review, sandbox assembly, measurement, and a learning loop — with **human approval
gates** and a **proof/provenance ledger** at every state transition.

The engine is designed so that the *unsafe* steps (anything that touches money, live platforms,
or real audiences) are walled behind a `SANDBOX` boundary that this loop never crosses.

---

## 2. Pipeline (end-to-end states)

```
[Brief Intake] -> [Creative Generation] -> [Compliance/Guardrail Review]
      -> (GATE 1: Human Creative Approval)
      -> [SANDBOX Campaign Assembly] -> (GATE 2: Human Launch Authorization — NOT EXERCISED THIS LOOP)
      -> [Measurement (SANDBOX/synthetic)] -> [Learning Loop] -> back to Brief Intake
```

Every arrow writes a record to the **Action Ledger** (see §5).

### State definitions

| State | Owner agent | Input | Output | Safety |
|-------|-------------|-------|--------|--------|
| Brief Intake | Intake Agent | Offer + constraints | Normalized brief object | SAFE |
| Creative Generation | Creative Agent(s) | Brief | Draft concepts/scripts/copy | SAFE (drafts only) |
| Compliance Review | Compliance Agent | Draft creatives | Pass/flag/block + reframes | SAFE |
| Creative Approval (GATE 1) | **Human** | Reviewed creatives | Approved creative set | SAFE |
| Campaign Assembly | Assembly Agent | Approved set | SANDBOX campaign object (no API calls) | SANDBOX/MOCK |
| Launch Authorization (GATE 2) | **Human** | Sandbox campaign | (would authorize go-live) | **UNSAFE — DO NOT DO YET** |
| Measurement | Measurement Agent | Synthetic/sandbox metrics | Performance summary | SANDBOX |
| Learning Loop | Strategy Agent | Performance + ledger | Updated hypotheses/priors | SAFE |

---

## 3. Agents / Roles (RECOMMENDED)

- **Intake Agent** — Parses a raw offer ("certified pre-owned event") into a structured brief:
  objective, audience hypotheses, offer terms, mandatory disclosures, prohibited claims, channel
  list, budget envelope (sandbox figure only). Rejects briefs missing disclosure inputs.
- **Creative Agent(s)** — Generate hooks, scripts, copy variants, storyboards per format
  (short-form video, static, carousel). Run as parallel specialists (Video / Static / Copy).
- **Compliance Agent** — Deterministic + LLM hybrid. Runs the `compliance-guardrails.md` checklist
  against every asset. Classifies each claim VERIFIED-CLAIM / NEEDS-SUBSTANTIATION / UNSAFE and
  emits compliant reframes. **Has block authority** — a BLOCK cannot be overridden by an agent,
  only by a human at GATE 1.
- **Assembly Agent** — Builds a campaign *object* (targeting spec, budget split, schedule, asset
  map) entirely in a **mock/sandbox** representation. **Writes nothing to Meta/Google/TikTok.**
- **Measurement Agent** — Consumes synthetic or post-launch (future) metrics, computes
  per-variant lift vs. control, flags fatigue. This loop: synthetic data only.
- **Strategy Agent** — Owns the learning loop: updates the hypothesis matrix priors, retires
  losers, promotes winners into the next brief. Never auto-launches.
- **Ledger Writer** (infra, not an LLM agent) — Appends an immutable provenance record at every
  transition (see §5).

INFERRED: Splitting Compliance from Creative (separate agent with block authority) is the single
highest-leverage design choice — it prevents the generator from grading its own homework, which is
the common failure mode in agentic ad systems.

---

## 4. Human Approval Gates

- **GATE 1 — Creative Approval (REQUIRED, exercised in this loop only on synthetic assets).**
  Human reviews each asset + the Compliance Agent's report. Approve / edit / reject. Approval is
  recorded with reviewer identity, timestamp, and the exact asset hash approved.
- **GATE 2 — Launch Authorization (UNSAFE / DO NOT DO YET).**
  This is the gate that would move a campaign from sandbox to a live platform with real spend.
  **It is intentionally NOT exercised in this loop.** Even with a human present, launch is a
  hard-stop boundary until: (a) founder sign-off, (b) legal review of all claims, (c) real
  platform credentials provisioned outside this loop.
- **GATE 3 — Spend Threshold Re-approval (RECOMMENDED, future).** Any budget change above a set
  delta re-triggers human review.

Gate principle: agents may *propose and assemble*; only a human may *authorize external action*.

---

## 5. Action Ledger / Proof Layer

Every state transition appends an immutable record. Ties into Cognitia's proof registry / action
ledger (per glossary). Suggested record shape (RECOMMENDED):

```json
{
  "ledger_id": "ulid",
  "campaign_ref": "sandbox-cpo-event-001",
  "state_from": "creative_generation",
  "state_to": "compliance_review",
  "actor": {"type": "agent", "id": "creative-agent-video"},
  "asset_hash": "sha256:...",            // provenance of the exact creative
  "model_provenance": {"model": "...", "prompt_hash": "sha256:..."},
  "compliance_verdict": "PASS|FLAG|BLOCK",
  "human_gate": {"gate": "GATE_1", "reviewer": "human:founder", "decision": "approve"},
  "synthetic": true,                      // true for everything in this loop
  "ts": "2026-06-20T00:00:00Z"
}
```

What the ledger guarantees:
- **Creative provenance** — which agent/model/prompt produced each asset (asset_hash + model_provenance).
- **Approval provenance** — who approved what, exactly, and when (human_gate).
- **Compliance provenance** — the verdict and which checklist version was applied.
- **Non-repudiation** — append-only; assembly/launch records carry `synthetic: true` this loop.

RECOMMENDED: Compliance Agent verdicts and GATE 1 approvals should be the two record types that are
cryptographically signed first, since they are the audit-critical events for advertising liability.

---

## 6. Platform / Vendor Integration

**UNSAFE / DO NOT DO YET — DESIGN ONLY.**

| Integration | Status | Note |
|-------------|--------|------|
| Meta Marketing API (write/launch/spend) | **UNSAFE — DO NOT DO YET** | Design the adapter interface as a mock only. |
| Google Ads API (write/launch/spend) | **UNSAFE — DO NOT DO YET** | Same. |
| TikTok Marketing API (write/launch/spend) | **UNSAFE — DO NOT DO YET** | Same. |
| Pixel/CAPI server events (real) | **UNSAFE — DO NOT DO YET** | Touches real PII; not in this loop. |
| Sandbox/mock adapter (no network) | RECOMMENDED | Implements the same interface, returns fake IDs. |

The Assembly Agent must target a **mock adapter** that implements the platform interface but
performs no network calls and emits only sandbox IDs. The real adapter is left as an unimplemented
stub per GUARDRAILS.md boundary #7 (no vendor adapter unless SANDBOX/MOCK).

---

## 7. Failure / Kill Switches (RECOMMENDED)

- Compliance BLOCK halts the asset; no agent override.
- Any attempt by an agent to call a real platform adapter is a hard error (the real adapter is a
  stub that raises).
- Budget envelope is a sandbox integer; a real currency value is rejected at intake this loop.
- No outbound message tool (WhatsApp/SMS/email) is wired to this engine — boundary #6.

---

## 8. Open items routed to founder

- GATE 2 launch criteria, legal claim review process, and real credential custody — **founder + legal.**
- Whether the action ledger lives in Cognitia's existing proof registry or a dedicated ads ledger.
