# Guardrails — Auto Growth OS (Client Zero)

These constraints are canonical. Every other document in this package
(`proposal/`, `discovery/`, `console/`, `playbooks/`) inherits them. When any
deliverable touches claims, outreach, finance, or trade-in value, it must comply
with this file. When in doubt, route to a human.

## Approval marker

Anything that asserts a price, payment, financing term, trade-in value, or a
sensitive customer-facing promise is tagged inline as:

`[REQUIRES HUMAN APPROVAL]`

A tagged item is a **draft**. It does not ship to a customer until a named human
at the dealership signs off. The marker is plain text (no emoji) so it survives
copy/paste, exports, and diffs.

## Hard rules

1. **No guaranteed sales.** We never promise a number of cars sold, deals closed,
   or revenue. Approved language: "designed to increase", "built to improve",
   "structured to capture more of the demand you already have".
2. **No guaranteed rankings.** SEO/AEO/GEO is best-practice work toward
   visibility and answer-eligibility. We never promise position #1, a specific
   keyword rank, or inclusion in any AI answer.
3. **No guaranteed ROI or lead volume.** No "you will get X leads", no
   "guaranteed Y× return". We commit to _work delivered_ and _process_, and we
   _report_ outcomes honestly — we do not pre-promise them.
4. **No unsafe financing claims.** No APR figures, no "approved", no "everyone
   qualifies", no monthly-payment promises. All financing copy is placeholder and
   carries `[REQUIRES HUMAN APPROVAL]` until the dealer and/or lender approves it.
5. **No trade-in value claims.** Any trade-in estimate, range, or "we'll beat any
   offer" statement is `[REQUIRES HUMAN APPROVAL]`. The system collects trade-in
   info; a human produces the number.
6. **No spam.** WhatsApp/Telegram, SMS, and email are opt-in and consent-first.
   Every outbound template includes an opt-out path, respects quiet hours, and is
   rate-aware. No purchased lists, no scraping, no unsolicited blasts.
7. **No false identity or fake reviews.** The AI Sales Closer always discloses it
   is an assistant when asked, and hands off to a human on request. No fabricated
   testimonials, no invented inventory.
8. **Honest reporting.** The proof loop reports real numbers, including flat or
   down weeks. No inflated metrics, no vanity-only dashboards.

## Cognitia's role in enforcement

Cognitia is the **agent trust / control plane, proof registry, and compliance
layer** for this engagement. In this package that means:

- The AI Sales Closer and any agent action operate under Cognitia's control-plane
  policy — disclosure, handoff triggers, and the approval gates above are policy,
  not suggestions.
- Outcomes and deliverables are recorded in Cognitia's **proof registry** so the
  Client Zero results are verifiable and reusable as proof (see
  `proposal/12-proof-reporting-plan.md`).
- The Sales Closer / GTM OS behavior is governed centrally; this client artifact
  consumes that governance, it does not redefine or modify it.

Hermes Vision Skill (`hermes/skills/vision-skill/`) is referenced only as a
**supporting media / publish-safety artifact** — it screens vehicle media for
privacy leaks and quality before publish. It is not the platform and is not
modified by this engagement.

## Scope guardrails for this build

- This is a **Client Zero artifact / prototype lane**, not the canonical platform.
- **Do not touch** core Hermes / pipeline / Cognitia architecture.
- **No live wiring** of CRM, Zapier, Make, ad accounts, WhatsApp, Telegram, or any
  vendor. Everything here is specification, template, and a static prototype.
- All third-party tools named in playbooks are **options to evaluate**, not
  provisioned integrations.
