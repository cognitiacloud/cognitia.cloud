# PR #106 Review — Client Zero: Auto Growth OS

**PR:** [#106](https://github.com/cognitiacloud/cognitia.cloud/pull/106) — "Client Zero: Auto Growth OS proposal + discovery system"
**State:** open · **draft** · not merged
**Head:** `claude/auto-growth-dealership-proposal-22ntav` → **Base:** `main`
**Size:** 18 files, +2,913 lines, all under `clients/client-zero-auto-growth/`
**Review type:** read-only assessment. This review changes nothing in PR #106.
**Reviewer scope guardrails honored:** no merge / undraft / close / retarget / rebase,
no comments on PR #106, no source edits, no live outreach, ads, WhatsApp, SMS,
calls, vendor calls, or real prospect data. The only artifact produced is this file.

> **Read this first — the gating finding.** PR #106 is a strong, low-risk
> **documentation + discovery package**. It does **not itself wire into the merged
> Sales Closer / control-plane spine**. Technical enforcement of its guardrails is
> **not proven by this package alone** — the package asserts that agents "run under
> Cognitia's control plane" and write to a "proof registry," but those are
> references in prose, not integrations shipped in this PR. Treat the guardrails
> here as **policy/doctrine the operator must enforce**, not as code-enforced
> controls delivered by #106.

---

## 1. Verdict

**Pilot-ready as collateral, discovery, guardrails, and scoping material. Not
live-agent-ready until wired into the compliance / proof / operator spine.**

The package is internally coherent (one field vocabulary flows questionnaire →
console → pricing → proof), its claim-safety discipline is thorough, and its human
approval gates are explicit at every layer. Nothing in it should go live as an
autonomous agent or outreach surface until it is connected to — and enforced by —
the merged platform spine (see §6).

---

## 2. Required verification — results

| Check                                                 | Result              | Evidence                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Proposal present                                      | ✅ Pass             | `proposal/00,03,10,11,12` — outline, Auto Growth OS offer, 30/60/90 roadmap, pricing, proof plan                                                                                                                                                                                                                                       |
| Discovery console present                             | ✅ Pass             | `console/discovery-console-spec.md` + self-contained `console/discovery-console.html`; deterministic engine matches spec (incl. `under_1k`→cap Launch, `7k_plus`→floor Growth)                                                                                                                                                         |
| Internal plan present                                 | ✅ Pass             | `internal/implementation-plan.md` — phased sequencing, role owners, dependencies, risks, definition of done                                                                                                                                                                                                                            |
| Guardrails present                                    | ✅ Pass             | `internal/guardrails.md` — canonical; every other doc declares it inherits it                                                                                                                                                                                                                                                          |
| No guaranteed sales / rankings / ROI / lead counts    | ✅ Pass             | Risky-term scan across all 18 files: every hit is a **negation** or a "don't-say" example (e.g. guardrail rules 1–3; meeting-script objection table; "we never promise a ranking")                                                                                                                                                     |
| No unsafe finance / APR / approval / financing claims | ✅ Pass             | No live APR/payment/"approved" copy. Finance is collection-and-handoff; all finance copy is placeholder tagged `[REQUIRES HUMAN APPROVAL]` (guardrail rule 4; website `04`; closer `08` HARD-STOP)                                                                                                                                     |
| Human approval gates exist                            | ✅ Pass             | Named client approver (questionnaire Q35–37, plan owners); plan calls approver sign-off a "hard blocker, by design"; console approval flags "cannot be dismissed in the UI"; closer HARD-STOP card stops on finance/payment/APR/approval/trade-in/price and "policy wins" over any turn-level instruction                              |
| Supports Client Zero dealership pilot                 | ✅ Pass             | Single-dealership 30/60/90 with a fast first win, baseline→proof loop, reusable template structure                                                                                                                                                                                                                                     |
| Can connect to Sales Closer spine later               | ⚠️ Pass with caveat | **Architecturally yes** — the console emits a clean JSON config object (the integration seam), the closer doc explicitly _consumes_ central policy and defers to it ("if this script and control-plane policy disagree, policy wins"). **But** #106 ships no `apps/`/`packages/` code and does not itself connect to the spine; see §6 |

---

## 3. What is usable now

These can be put to work immediately as **collateral / discovery / scoping** (not
as live automation):

- **`internal/guardrails.md`** — the canonical claim-safety doctrine. Usable now as
  the standing rulebook for any Client Zero conversation or copy.
- **`discovery/01-discovery-questionnaire.md`** — structured intake; every answer
  carries a field tag that the console and proof plan reuse.
- **`discovery/02-meeting-script.md`** — discovery/sales call script + objection
  handling, already written to the guardrail phrasing card.
- **`console/discovery-console.html` + spec** — a working, offline, dependency-free
  scoping tool. Deterministic and transparent (shows the score). Usable now to scope
  a real dealership in a meeting and export a config object.
- **`proposal/03,10,11,12` + `00`** — the offer narrative, roadmap, pricing
  template, and proof plan, usable as **sales + scoping collateral** with the
  pricing caveat in §5.

## 4. What is spec-only (build phase provisions; nothing live here)

- **`playbooks/04-website-blueprint.md`** — site/IA spec; finance & trade-in pages
  are approval-gated placeholders.
- **`playbooks/05-inventory-automation.md`** — ingest→publish workflow spec. The
  **one concrete, real integration** is the privacy/quality gate: it routes photos
  through `vision_privacy_scan` + `vision_analyze_image`, which exist in
  `hermes/skills/vision-skill/vision_skill.py` (verified). The rest of the pipeline
  is unwired.
- **`playbooks/06-whatsapp-telegram-intake.md`** — intake templates only; consent-
  first, opt-out, quiet-hours, rate-aware. Explicitly "draft to wire later; nothing
  here is live." _(No live outreach exists or is created by this review.)_
- **`playbooks/07-crm-lite-pipeline.md`** — pipeline stages/spec.
- **`playbooks/08-ai-sales-closer-script.md`** — a conversation **build spec**, not
  a runtime. Describes governed behavior; does not implement it.
- **`playbooks/09-seo-aeo-geo-page-map.md`** — page map; best-practice work, no
  ranking promises.
- **`proposal/12` dashboard** — depends on CRM-lite + closer logs that are not built.

## 5. What is risky / watch

1. **Enforcement is asserted, not proven by this package.** The closer's disclosure,
   handoff, and HARD-STOP rules — and the "proof registry" — are described as
   control-plane-enforced, but #106 contains no wiring to that control plane. Until
   the spine actually enforces them (§6), they are operator discipline. **Do not run
   the closer as a live agent on #106 alone.**
2. **Finance / trade-in is the highest-regulatory surface.** The gating design is
   good (collect-only, page-hiding by `finance_handling`/`tradein_handling`,
   non-dismissible approval flags), but it depends entirely on (a) a real named
   approver existing and (b) the page-hiding/approval logic being correctly
   implemented at build. Verify both before any finance/trade-in surface ships.
3. **Pricing must not be presented as a firm quote.** The USD figures in
   `11-pricing-packages.md` are **template anchors — pending human approval,
   currency TBD**. Treat as `[REQUIRES HUMAN APPROVAL]`; if the manager confirms a
   **Canadian dealership**, switch to **CAD** and re-confirm every number. The doc
   already marks "any final figure" as approval-gated — keep it that way in any
   client-facing use.
4. **"First win in ≤30 days" and the ad-management add-on (15% of spend)** must stay
   framed as **targets/work delivered, not guarantees of outcome**. The docs already
   do this; preserve it in conversation.
5. **Bilingual (es) guardrails are flagged but untested.** The Spanish path claims
   "same guardrails, translated, not loosened" — this needs an actual review of the
   translated HARD-STOP/disclosure copy before any bilingual go-live.

## 6. What should be merged later (and what must come first)

**Not now.** PR #106 stays a **draft**; this review does not change its state.

Verified via GitHub PR metadata, the merged foundation that a future Client Zero
build would wire into already exists in parts:

- **#93 (merged)** — canonical platform-native Sales Closer **data layer**:
  migrations `0020`/`0021` (`closer_sources`, `closer_scrape_runs`,
  `closer_raw_records`, `closer_account_profiles`, `closer_briefs`), per-table RLS,
  PII-hashed-only doctrine, evidence-tagged claims, approval/handoff through existing
  `agent_actions` + `/approvals`, append-only `events`.
- **#97 (merged)** — `@cognitia/core` GTM types + pure compliance helpers
  (`canUseSourceForProspecting`, `canContactProspect`, `requiresHumanReviewForOutreach`,
  `GTM_OUTREACH_REQUIRES_HUMAN_APPROVAL`).
- **#96 (merged)** — compliance/channel scaffold (demo-only / web-local) consuming
  the #97 primitives.

Together #93/#97/#96 provide **parts** of the merged Sales Closer / GTM / compliance
foundation. **The full Client Zero happy path is still missing**, end to end:

> **lead in → consent / compliance gate → human approval → appointment / CRM
> writeback → proof report.**

**Merge-later sequence (recommendation):**

1. Graduate the **safe layer first** — console + discovery + guardrails as the
   reusable scoping artifact. It carries no live automation and no regulatory
   surface.
2. Land the **happy-path wiring** that connects discovery output → the #93 closer
   data layer + #97/#96 compliance helpers → an approval gate → CRM/appointment
   writeback → a proof-report record. Only after that path exists and is enforced
   should the live-wiring playbooks (`05` publish, `06` intake, `08` closer runtime)
   graduate from spec to build.
3. Keep finance/trade-in surfaces last and approver-gated.

> **Checkout-limited note (UNVERIFIED).** The local checkout used for this review
> contained only the PR-106 branch tree (`clients/` + `hermes/`) and did not include
> the `apps/`/`packages/` monorepo. Any impression that the spine "isn't in the repo"
> is **checkout-limited, not a repo-wide fact** — the merged #93/#97/#96 work above
> is confirmed present via GitHub PR metadata. The point that stands is narrower and
> verified: **PR #106 itself adds no `apps/`/`packages/` code and does not connect to
> that spine.**

## 7. Recommended pilot offer + success metric

**Recommended pilot offer (approved):**

- **Tier:** Launch
- **Single goal:** `faster_response`
- **Finance / trade-in:** `none` for the pilot (keeps the pilot off the
  finance/trade-in regulatory surface entirely)
- **Scope:** after-hours AI intake + one-inbox capture + CRM-lite pipeline — the
  smallest end-to-end loop that proves the "stop the leak" thesis.

**Success metrics:**

- **Median first-response time** to a new inquiry (baseline → day-30), and
- **After-hours capture rate** (share of leads caught outside staffed hours).

One honest headline pair, recorded against baseline. Per guardrails: report real
numbers including flat/down weeks; do not pre-promise a target value.

---

### Appendix — verification method

- Read all 18 artifacts from the PR ref (read-only).
- Ran a case-insensitive risky-term scan (`guarantee|APR|approved|ranking|ROI|
finance|trade-in|#1|financing|credit|interest rate`) across the package; every hit
  resolved to a negation or an approval gate.
- Confirmed the console HTML recommendation engine implements its spec
  (`computeScore`/`adjustBudget`/`modules`/`approvalFlags`), including the budget
  cap/floor edges.
- Confirmed the inventory playbook's claimed reuse targets
  (`vision_privacy_scan`, `vision_analyze_image`) exist in
  `hermes/skills/vision-skill/`.
- Confirmed #93/#97/#96 are merged via GitHub PR metadata.
