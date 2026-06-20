# Cognitia — 36-Hour GTM Improvement Report

**Date:** 2026-06-20
**Prepared for:** Cognitia / Demandara (founder)
**Scope:** Final report for the 36-hour GTM improvement loop
**Branch:** `claude/cognitia-36h-gtm-report-trwx36`

---

## Reading Contract (read this first)

> **The only reachable shipped artifact from this loop is the Hermes Vision
> Skill. Therefore, this report can verify only that artifact directly. Broader
> GTM, Sales Closer, Client Zero, Agent Economy, token sandbox, ads/media, and
> harness sections are forward-looking recommendations grounded in project
> context and uploaded playbooks, not verified shipped artifacts.**

> **Based only on reachable git artifacts, Hermes currently contains a
> vision-QC capability for publish-safe media. This is a useful support
> capability, but it is not sufficient evidence to redefine Cognitia's overall
> positioning.**

**Source-verification status of this report:**

| Source | Reachable this session? | How it is used |
|---|---|---|
| Git repo (`hermes/skills/vision-skill/`) | ✅ Yes | Verified directly. Cited as fact. |
| Notion workspace | ⚠️ Only default "Welcome" page | Treated as empty. |
| Google Drive / Gamma | ❌ Access not approved | Not used. No contents cited. |
| Uploaded playbooks / strategy PDFs | ❌ Not reachable in environment | Strategic context labeled **user-provided / unverified**. No citations fabricated. |

Nothing in this report invents an artifact. Where a thing was claimed by the
loop but cannot be reached, it is listed as **NOT VERIFIED — not centralized**,
not as "nonexistent."

---

## Brutal Verdict (up front, not buried)

**Are we aligned, overbuilding, underbuilding, or drifting? All three of the
last ones — precisely:**

- **Drifting — in artifact centralization.** The loop's outputs are not in one
  reachable place. The repo holds exactly one artifact; the strategy lives in
  the founder's head and in playbooks this environment can't see. That is the
  single biggest problem this report surfaces.
- **Overbuilding — internal tooling relative to customer proof.** We hardened a
  publish-safety guardrail (multi-provider routing, OCR fallback, PII scanning,
  MCP server, 13 tests) before there is one verified customer proof attached to
  it.
- **Underbuilding — GTM distribution and the Client Zero close path.** There is
  no reachable offer, booking link, sales sequence, proof workflow, or ad.
- **Not enough verified shipped artifacts for a claimed 36-hour loop.** One
  microservice is not 36 hours of GTM output. Either more was built and not
  committed/centralized, or the loop spent its hours on the wrong surface.

**But — and this matters — the strategy is not wrong.** The direction remains
**Cognitia (agent trust/control plane) + Demandara (growth/operator layer) +
Client Zero (dealership growth proof)**. One reachable Hermes artifact does
**not** redefine Cognitia as a video/avatar company. The problem is execution
centralization and proof, not vision.

**What to do first tomorrow:** (1) Centralize the loop's scattered outputs into
one reachable place (this repo / a proof registry), and (2) put a Client Zero
offer + booking link in front of real dealership prospects — *before* building
any more internal tooling.

---

## 1. Verified Artifact Inventory

The only directly verifiable output of this loop:

### Hermes Vision Skill — `hermes/skills/vision-skill/`
- **Status:** Shipped, tested, single commit `0dfb0ad`.
- **What it is:** A read-only vision quality-control capability for
  publish-safe media. A *support capability*, not a product and not the company.
- **Four tools** (`vision_skill.py`, 677 lines):
  1. `vision_analyze_image` — image QC + summary, quality/brand scores, PII risk.
  2. `vision_compare_portraits` — identity / naturalness / fake-AI-risk scoring.
  3. `vision_privacy_scan` — OCR + regex PII detection; runs offline; returns
     `publish_safe`.
  4. `vision_video_frame_qc` — 9:16 safe-zone + secrets-visible frame check.
- **Provider routing:** OpenAI → Anthropic → Gemini → OpenRouter → Ollama →
  OCR-only fallback (env-driven).
- **Safety posture:** `read_only`, `no_delete`, `no_post`, `redact_logs`;
  forces `publish_safe=false` if secrets are visible.
- **Tests:** 13 unit tests, pass without cloud keys (degrades to OCR-only).
- **Interfaces:** CLI + MCP server; `README.md`, `skill.yaml`, `.mcp.json`.

**That is the entire verified inventory.** One skill.

---

## 2. Unverified / Missing Artifact Inventory

Claimed or expected from the loop but **not reachable** (not centralized — not
proof of nonexistence):

| Workstream | Status | Note |
|---|---|---|
| Client Zero Auto Growth OS (dealership proof workflow) | NOT VERIFIED | No reachable workflow, runbook, or proof log. |
| Sales Closer v1 | NOT VERIFIED | No reachable sequence, script, or agent. |
| Agent Economy proof-layer / proof registry | NOT VERIFIED | Concept only; no reachable registry. |
| Token / credit sandbox | NOT VERIFIED | No reachable metering code. |
| Ads / media assets | NOT VERIFIED | No reachable creative, landing page, or pixel. |
| Goal-loop harness | NOT VERIFIED | "Hermes" pipeline implied; no reachable orchestrator. |
| Demandara growth layer | NOT VERIFIED | Referenced as strategy; no reachable artifact. |
| Positioning / pricing / ICP docs | NOT VERIFIED | Live in playbooks this env can't read. |

**Root cause:** lack of a single centralization target for loop outputs. Fixing
that (Section 10) is higher leverage than any one feature.

---

## 3. Strategic Context (user-provided playbooks — unverified)

> Source note: the following reflects founder-provided strategic direction and
> uploaded playbooks that are **not reachable** in this environment. It is
> recorded as context, **not verified**, and carries no fabricated citations.

- **Cognitia** — the agent trust / control plane: proof registry, compliance
  layer, Sales Closer / GTM OS, agent-economy infrastructure.
- **Demandara** — the GTM / growth / operator layer that runs motions on top of
  Cognitia.
- **Hermes Vision Skill** — one content/media/publish-safety capability that can
  support a future media house or the Client Zero content pipeline.
- **Client Zero Auto Growth OS** — a dealership growth proof workflow; the first
  concrete proof case that the platform produces real outcomes.

**Best GTM insights distilled:**
1. The platform's wedge is **trust + proof**, not media generation. Hermes'
   publish-safety report is the first tangible instance of "verifiable agent
   output" — use it as a proof artifact, not as the headline product.
2. **Client Zero is the whole game right now.** One dealership outcome, proven
   and documented, unlocks positioning, pricing, and the proof registry
   narrative simultaneously.
3. **Sell the outcome, deliver concierge.** Don't productize before one manual
   close validates the offer.

---

## 4. Corrected Cognitia / Demandara Positioning

- **Cognitia is the control plane for trustworthy agents** — proof, compliance,
  closing/GTM OS, and agent-economy infrastructure. It is *not* a video company.
- **Demandara is the operator/growth layer** — it runs the go-to-market on top
  of Cognitia's primitives.
- **Hermes is one capability inside this** — publish-safe media QC. It feeds the
  content pipeline and demonstrates the trust-layer idea, but does not define
  the company.

> Restated for the record: "Based only on reachable git artifacts, Hermes
> currently contains a vision-QC capability for publish-safe media. This is a
> useful support capability, but it is not sufficient evidence to redefine
> Cognitia's overall positioning."

---

## 5. Client Zero Auto Growth OS — Next Steps

The dealership growth proof workflow is the priority forward build.

1. **Name one dealership ICP** (single dealership / dealer group, defined
   region, defined pain — e.g. inbound lead follow-up speed).
2. **Define one proof metric** the OS moves (e.g. leads worked within N minutes,
   appointments booked, no-show reduction). Pick one; instrument it.
3. **Ship v1 concierge** — run the workflow manually / semi-automated for one
   dealership. Document every step so it becomes the runbook (and the first
   entry in the proof registry).
4. **Define the close path** — how the documented proof converts to a paid logo
   (offer, price, term). The proof artifact *is* the sales asset.

**Exit criterion:** one dealership with a documented before/after outcome.

---

## 6. Sales Closer — Next Steps

- **v1 is not an autonomous agent.** It is a **defined, templatized sequence**:
  qualify → book → demo (against their real data) → offer → follow-up.
- Stand up the booking surface (Calendly link) and a one-page offer first.
- Capture every manual close as a template; only then wire it into the Cognitia
  GTM OS so the agent automates a motion that already converts.
- Tie Sales Closer directly to the Client Zero Auto Growth OS proof — the closer
  sells the proof, not abstract capability.

---

## 7. Agent Economy Proof-Layer — Next Steps

- Keep this as **core Cognitia infrastructure**, not a discarded idea — but
  **sequence it after Client Zero proof.**
- **Near-term, concrete move:** treat the Hermes `vision_privacy_scan` /
  `publish_safe` output as the **first proof artifact** in the registry. It is a
  real, signable "this output was verified" record — the seed of the proof
  layer.
- Defer marketplace / multi-party verification mechanics until there is at least
  one customer whose outputs need proving.

---

## 8. Token / Credit Sandbox — PARKED

- **Parked.** There is no metering need before paid usage exists.
- Track unit economics (provider spend per workflow / per video) in a simple
  spreadsheet.
- Revisit only once Client Zero generates recurring usage that needs internal
  accounting.

---

## 9. Ads / Media Launch Readiness

- **Not launch-ready.** Missing: offer/landing page, creative, tracking pixel,
  attribution.
- **Prerequisites before spending a dollar on paid:**
  1. One Client Zero proof outcome.
  2. A one-page offer + booking link.
  3. 2–3 organic proof clips (Hermes can QC them for publish-safety).
- Sequence: organic proof → one manual close → *then* a small paid test. Paid
  before proof would amplify an unvalidated offer.

---

## 10. Goal-Loop Harness Recommendation

- **Keep the loop cadence; change the goal function.** Optimize for "advance one
  Client Zero deal + centralize artifacts," not "ship internal tooling."
- **Add an artifact-centralization step to every loop:** each loop must land its
  outputs in one reachable place (this repo and/or the proof registry). This
  directly fixes the drift root cause identified in the verdict.
- **Do not generalize the harness into a platform yet.** A self-improving
  orchestrator is premature pre-revenue; keep it as a thin runner with a
  customer-proof objective.

---

## 11. Security / Compliance Gaps

| # | Gap | Trigger milestone |
|---|---|---|
| 1 | Hermes sends images to external LLM providers — confirm no PII egress | Before any real customer content runs through it |
| 2 | No avatar/likeness **consent tracking** (skill flags fake-AI risk but stores no consent record) | Before producing any avatar/likeness media commercially |
| 3 | No privacy policy / ToS for a commercial offer | Before first paid Client Zero engagement |
| 4 | Provider API-key / secrets handling not formalized | Before multi-environment deploy |
| 5 | No proof-registry integrity / audit trail (undercuts the trust-layer claim) | Before marketing the Agent Economy proof layer |

The publish-safety/PII posture inside Hermes is genuinely good — these gaps are
about the *commercial and platform* envelope around it, not the skill itself.

---

## 12. Next 7-Day Execution Plan

**Guardrail for the whole week: stop building net-new internal tooling until
there is one verified customer proof.**

- **Day 1 (tomorrow):**
  - Centralize all existing loop outputs into this repo / a proof-registry stub.
  - Define the Client Zero dealership ICP + write a one-page offer.
  - Stand up a Calendly booking link.
- **Day 2–3:**
  - Run discovery with 5 dealership prospects.
  - Stand up the Auto Growth OS proof workflow manually (concierge) for one.
- **Day 4–5:**
  - Deliver the first concierge proof; document the before/after outcome as the
    first proof-registry entry.
- **Day 6–7:**
  - Convert the documented proof into a concrete offer + price.
  - Prepare (do not yet launch) ad creative + landing page; QC any media via
    Hermes.

---

## Kill / Park / Build Queue

- **KILL:** any net-new internal tooling with no direct line to Client Zero
  proof; multi-provider expansion of the vision skill beyond what one customer
  needs.
- **PARK:** token/credit sandbox; goal-loop harness generalization; paid ads;
  full Agent Economy build (keep the proof-registry *concept* warm via the
  Hermes proof artifact).
- **BUILD:** artifact centralization; Client Zero Auto Growth OS proof workflow;
  Sales Closer v1 sequence + booking page; 2–3 proof clips; concierge delivery
  to one dealership.

---

## One-Line Answer

We are **not aligned yet** — overbuilding tooling, underbuilding GTM, and
drifting on artifact centralization — but the **Cognitia / Demandara / Client
Zero** strategy is intact. **First thing tomorrow: centralize the loop's
outputs and get a Client Zero offer in front of real dealerships, before
writing another line of infrastructure.**

---

*This report verifies only the Hermes Vision Skill directly. All other sections
are forward-looking recommendations grounded in user-provided context, not
verified shipped artifacts. No artifacts or citations were fabricated.*
