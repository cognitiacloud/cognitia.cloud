# Cognitia v1.1 — Demo Script (7–10 minutes)

Audience: founder, investor, future engineer, strategic partner, internal audit.
Setup (once): `pnpm install`; terminal A `pnpm --filter @cognitia/api... dev`
or `node apps/api/src/server.ts` equivalent with `SESSION_SECRET` set; terminal
B `pnpm --filter @cognitia/web dev`; issue an operator token via
`apps/api/scripts/issue-session.mjs`. Demo data: press "Import Core 20" on
/skills and "Create demo lead" on /moveros/front-desk (all synthetic).

Standing disclaimers — say these up front:

- **No real SMS exists.** Every send is a simulation; real SMS is
  deny-by-default and owner-gated, with no provider integration.
- **No real payments.** Credits are internal bookkeeping units only.
- **No public token.** The crypto layer is designed-for-later and legal-gated.
- **Verification scope:** everything shown is test/PGlite-verified; live
  database state is unknown until migrations are applied to a real instance.

Opening framing (say first — Architecture Lock A1): "Cognitia is building
the trust and economy layer for AI agents. Cognitia GTM Control Plane is its
first production application. MoverOS is the first tenant proving the loop
with real lead and revenue outcomes. Moving isn't the company — it's Tenant
Zero, picked because lead response and booking outcomes are measurable."

## Walkthrough (route order + speaking notes)

1. **`/cognitia` — Command Dashboard.**
   "This is the whole trust layer on one screen. Notice the design choice:
   only `verified_fact` evidence counts as verified, simulations are labeled,
   and the blockers panel tells you what is deliberately switched off."
2. **`/agents` — ATC-backed agent.**
   "Every agent carries an Agent Trust Credential — issuer, scope, expiry,
   status. The shape is W3C-VC-compatible so standards integration later is a
   mapping, not a migration."
3. **`/agents/[id]` — credential + permission state.**
   "Real SMS is denied by default for every agent; only the owner role can
   ever flip it, and revoking a credential is terminal — enforced in the
   database, not just the UI. The reputation panel here only moves on
   verified facts."
4. **`/skills` — SkillProof Core 20.**
   "An internal certified-skill registry — explicitly not a marketplace.
   Tier 2 requires a verified_fact proof; tiers 3–4 are locked until real
   production and security evidence processes exist. One skill has a real
   hashed source; nineteen are honest seeds and say so."
5. **`/proofs` — Proof Registry.**
   "Append-only evidence. Corrections supersede, never edit. Nothing becomes
   public without passing a PII redaction scan — watch the check block a
   summary containing a phone number."
6. **`/moveros/front-desk` — AI Front Desk simulation.**
   "A mover's lead arrives by simulated SMS. PII is encrypted at rest and
   masked here — you see •••42, not a phone number."
7. **Propose `propose_sms_reply`, then `/approvals`.**
   "The AI drafts; a human approves with a structured reason. Nothing
   customer-facing executes without that approval."
8. **Execute the simulated send; record a `booked_job` outcome with a CRM
   evidence source.**
   "The send produces a proof with the response time. The booking is a
   revenue receipt — and because it cites real evidence, it's verified_fact.
   Record one WITHOUT evidence and the dashboard keeps it out of the
   verified column."
9. **Back to `/agents/[id]` — reputation updated.**
   "Reputation moved only because that outcome was a verified fact. Inference
   and unknown outcomes are structurally unable to add reputation — database
   trigger, service rule, and tests all enforce it."
10. **`/credits` — internal credits + wallet placeholders.**
    "Append-only double-entry accounting for agent work. The wallet rows are
    inert placeholders — no keys, no chain activity."
11. **`/cognitia/crypto-readiness` — the legal-gated board.**
    "This is the honest answer to 'what about crypto': designed-for-later,
    every gate closed, and it says exactly what reopening them requires —
    legal review, real usage, founder approval."
12. **Close.**
    "What's real: the trust machinery — credentials, proofs, redaction,
    approval gating, evidence-tagged outcomes, reputation — all tested,
    397+ tests green. What's simulated: the SMS sends. What's gated: real
    messaging, payments, and anything token-shaped. The next step is a
    paying Tenant Zero pilot, because the platform's moat is a verified
    vertical track record, not claims — and the same Core + GTM Control
    Plane then onboards the next vertical without rebuilding anything."
