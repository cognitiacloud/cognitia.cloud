# Cognitia — Architecture Lock v1.1

Date: 2026-06-11
Status: LOCKED. Implementation prompts (COG-002+) must conform to this document or explicitly amend it with founder approval.
Scope: internal engineering doctrine. Not marketing copy. Not legal advice.

Evidence discipline: claims about the repo are `verified_fact` per the Discovery Report; product/market figures are business assumptions unless stated otherwise.

---

## 1. Public product language (LOCKED; see Amendment A1 for platform/tenant framing)

Framing (A1): **Cognitia Core** (the trust + economy primitives below) →
**Cognitia GTM Control Plane** (first production application of Core) →
**MoverOS** (Tenant Zero, the first vertical proof environment — not the
company focus).

These are the only approved public names:

| Approved public name                    | Abbrev  | Replaces / forbidden alternatives                                                 |
| --------------------------------------- | ------- | --------------------------------------------------------------------------------- |
| **Agent Trust Control Plane**           | —       | "agent OS", "agent passport platform"                                             |
| **Cognitia Agent Trust Credential**     | **ATC** | ~~Agent Passport~~ (Workday et al. use it; internal shorthand only, never public) |
| **SkillProof**                          | —       | ~~Skill Registry~~ (public registries exist; we certify, not catalog)             |
| **Proof Registry**                      | —       | —                                                                                 |
| **MoverOS AI Front Desk + Lead Rescue** | —       | —                                                                                 |

Naming rules:

- "Agent Passport" may appear only in internal docs as shorthand, never in code identifiers, public pages, marketing, or API names. Code uses `agent_trust_credential` / `atc`.
- No `did:cognitia` anywhere — not in docs, not in code, not as a placeholder string.

## 2. What we are building first

In priority order (Lanes defined in the Implementation Command Book):

1. **MoverOS AI Front Desk + Lead Rescue** (Lane A) — SMS-first lead intake, lead-rescue workflow, outcome logging. Simulation-first; no real SMS without human approval. This is the revenue wedge and produces the vertical economic evidence everything else depends on.
2. **Proof Registry with evidence tags** (Lane B) — append-only proof records tagged `verified_fact` / `likely_inference` / `unknown`, with privacy redaction gating.
3. **Cognitia Agent Trust Credential (ATC)** (Lane B) — per-agent credential: identity, scope, policy bindings, status lifecycle. W3C-VC-conceptually-compatible data shape; no public DID method.
4. **SkillProof Core 20** (Lane B) — private internal skill inventory of ~20 core skills with proof tiers and evidence-tagged certification.
5. **Reputation v0** (Lane B) — reputation events derived **only** from `verified_fact` proofs.
6. **Internal Credits + Wallet Binding Placeholder** (Lane C) — internal ledger, append-only; wallet binding as inert placeholder fields. No on-chain anything.

## 3. What we are explicitly NOT building now

- ❌ Public token landing page, liquidity page, staking/yield, "get in early", price talk, investment language, DEX launch docs, public token community. **Frozen lane.**
- ❌ `did:cognitia` or any custom public DID method.
- ❌ Generic public Skill Registry.
- ❌ Custom appchain / L1 / L2.
- ❌ On-chain contracts of any kind (ERC-8004 / EAS integration is a _later_ posture, design notes only).
- ❌ Real outbound SMS without explicit human approval and verified-safe credentials.
- ❌ Public marketplace, multi-tenant SaaS self-serve signup, billing automation (Stripe later).
- ❌ Public proofs containing raw PII.

## 4. Standards posture (LOCKED)

- **Integrate, don't fight.** Cognitia consumes/aligns with standards; it does not invent competing ones.
- **ERC-8004** (trustless agents): align identifiers and trust-model fields so future on-chain registration is a mapping exercise, not a migration. Integration itself is deferred.
- **W3C Verifiable Credentials**: ATC data model is VC-_style_ (issuer, subject, claims, issuance/expiry, status, proof section placeholder). We do not implement full VC cryptographic suites in v1.1; we keep the shape compatible.
- **EAS-style attestations**: proof records keep an `external_attestation_ref` nullable field so EAS anchoring can be added later without schema breakage.
- **MCP / A2A compatibility**: agent interfaces designed so skills/tools can later be exposed via MCP; the existing Hermes vision skill already speaks MCP (`verified_fact`) and serves as the in-house pattern.
- **Base/EVM optionality**: chain fields are enums/nullable refs, defaulting to `none`. No chain dependency in v1.1.
- **No did:cognitia.** Agent identifiers are internal UUIDs/ULIDs plus optional standards-compatible external identifier fields (e.g. future ERC-8004 agent ID, future DID of an _existing_ method).

## 5. Crypto posture (LOCKED)

Progression (each step gated, none skipped):

`internal credits → Stripe/card → stablecoin rails → Base/EVM optionality → ERC-8004/EAS/x402 integrations → token (legal-gated) → appchain (usage-gated, likely never)`

v1.1 implements **only**:

- **Internal credits**: `credits_accounts` + append-only `credits_ledger_entries`. Double-entry style; no balance mutation outside ledger inserts.
- **Wallet binding placeholder**: `wallet_bindings` table with `chain` enum (`none | base | evm_other`, default `none`), `address` nullable, `status = placeholder`. No signing, no key custody, no transactions.
- **Payment rail enum**: `payment_rail` enum (`internal_credits | stripe_card | stablecoin | other_future`) on relevant records; only `internal_credits` is active.
- **Token legal gates**: documented internally (Command Book §I kill gates). No token code, no token docs outside internal/legal-gated folders, no token UI.

All crypto-readiness artifacts live under `docs/cognitia/internal/` and are marked `INTERNAL — LEGAL-GATED`. CI test asserts no public token page exists (Command Book §E).

## 6. Privacy posture (LOCKED)

- **No raw PII in public proofs.** Names, phone numbers, emails, addresses, exact payloads of customer messages never appear in any record marked `public_safe = true`.
- **Redaction is mandatory and verified**, not assumed: a record can be `public_safe = true` only after passing an automated redaction check (regex/OCR PII scan — reuse the pattern already proven in `hermes/skills/vision-skill` privacy scanner, `verified_fact` that it exists).
- **Default-deny:** every proof/lead/action record defaults to `public_safe = false`.
- **Jurisdiction awareness:** founder operates in a PIPEDA / BC PIPA context (Canada/British Columbia). Engineering implications: consent capture on lead intake, data minimization, deletion capability for customer PII, no cross-border assumptions baked in. (Awareness, not legal advice.)
- Secrets: never logged, never committed, never echoed in proofs.

## 7. Proof integrity posture (LOCKED)

- Every proof, report claim, and reputation input carries an `evidence_tag ∈ {verified_fact, likely_inference, unknown}`.
- **Only `verified_fact` may positively update reputation.** `likely_inference` and `unknown` have zero positive reputation weight — enforced in code and by tests, not by convention.
- Proof records are **append-only**; corrections are new records referencing the superseded one (`supersedes_proof_id`), never destructive edits.
- A proof must reference its evidence (artifact URI, log excerpt hash, DB record id, or document ref). A proof with no evidence reference cannot be `verified_fact`.
- Agents/automation may _propose_ `verified_fact`; promotion to `verified_fact` requires a verifier identity recorded on the proof (human or whitelisted automated verifier with its own audit trail).

## 8. Revenue wedge (LOCKED)

- **SMS-first AI Front Desk** for moving companies: missed/slow leads get rescued via fast AI-drafted SMS responses, booked into the calendar, with outcomes logged as proofs.
- **No real SMS unless human-approved and credentials are safe.** v1.1 ships a simulation mode that exercises the full pipeline (intake → draft → approval gate → simulated send → outcome) without any external messages.
- **Inlet/warm network first**: first pilots come from the founder's warm network; no cold outbound product needed in v1.1.
- **$997/month managed service target is a business assumption**, not a verified current fact. No revenue exists yet in evidence (`verified_fact`: no payment code or records in repo). Reputation/proof records must never present projected revenue as realized.

## 9. Stack and base-branch ratification (carried from Discovery; to confirm at start of Prompt 2)

Discovery found that the repo's default branch is near-empty, but the lineage at `claude/soc-1-readiness-package` (tree-identical to `claude/gtm-platform-mvp-setup-vYLBG`) contains a 59-commit, production-shaped platform (`verified_fact`): pnpm + TypeScript monorepo, Fastify API, Next.js App Router operator console, worker, Kysely + raw-SQL Postgres migrations with tenant RLS, Vitest, CI — including approval-gated `agent_actions`, immutable `events`, `audit_events`, `leads`/CRM entities, governance, kill switch, rollback, trust metrics, and evals.

**Locked direction:** Cognitia v1.1 extends this existing platform; it does not start greenfield.

- Base branch for all v1.1 implementation: `claude/soc-1-readiness-package` (founder to confirm at COG-002 start and ideally promote it to the repo default branch).
- Stack: the platform's existing stack — pnpm, TypeScript, Fastify (`apps/api`), Next.js App Router (`apps/web`), Kysely + SQL migrations (`packages/db`, continuing from `0009_*`), zod schemas (`packages/core`), Vitest.
- Reuse before rebuild: `agent_actions` + approval queue + `audit_events` + `events` are the substrate for Lane A actions and Lane B proof emission; tenancy/RLS is the permission substrate; `contacts.email_hash`/`phone_hash` hashing pattern is the PII baseline.
- New v1.1 tables (proofs, ATC, skills/skill_proofs, reputation, lead_intakes for the SMS vertical, credits, wallet placeholders) are added via new migrations — never by editing migrations 0001–0008.
- Existing `hermes/` directory stays untouched.

If the founder rejects the base-branch recommendation at COG-002, this section must be amended before any code is written (§10).

## 10. Amendment process

Any deviation from this lock requires: (a) a dated amendment section appended below, (b) the reason, (c) founder approval noted. Silent drift is a defect.

---

## Amendment A1 — 2026-06-11 — Platform/Tenant framing correction (founder-directed)

Reason: docs drifted toward implying Cognitia is a moving-company product.
Corrected doctrine, binding on all future docs and sessions:

1. **Cognitia** is the agent trust + economy platform — not a moving-company
   product, and MoverOS is not the company.
2. **Cognitia Core** = Agent Trust Control Plane, ATC, Proof Registry,
   SkillProof, Reputation, Credits, Wallet placeholders.
3. **Cognitia GTM Control Plane** = the first production application of
   Cognitia Core. It runs agent-assisted revenue workflows with tenant
   safety, approvals, events, audits, proofs, and outcomes.
4. **MoverOS** = Tenant Zero / the first vertical proof environment for the
   Cognitia GTM Control Plane. Moving is used because lead response and
   booking outcomes are measurable — it is the proving ground, not the focus.
5. **Token** (internal framing only; legal gates in §5 unchanged): a future
   coordination/economic primitive for the broader Cognitia agent economy —
   not a payment gimmick for one GTM dashboard or one moving tenant.
6. **Public narrative**: "Cognitia is building the trust and economy layer
   for AI agents. Cognitia GTM Control Plane is its first production
   application. MoverOS is the first tenant proving the loop with real lead
   and revenue outcomes."

§8's "revenue wedge" language is to be read through this lens: the wedge is
Tenant Zero's measurable outcomes, proving the platform.

Founder approval: directed via doctrine-correction tasking, 2026-06-11.
