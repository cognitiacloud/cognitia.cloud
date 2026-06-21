# Client Zero Enterprise Build Plan

**Purpose:** Govern the Client Zero build wave so it absorbs the lessons from
Alta (a broad GTM platform) and Kite (a controls/governance framework) **without
scope explosion**.

**Status:** Active ruling — supersedes prior Client Zero wave scoping.
**Date:** 2026-06-21
**Owner:** Cognitia build controller
**Substrate:** Cloudflare Workers (TypeScript). Spine ships as `workers/gtm-spine/`.

---

## Hard rules (non-negotiable)

These bound every session in this wave. A change that breaches any of them is
rejected at review regardless of how complete it is.

1. **Client Zero dealership spine remains first.** No work reorders ahead of it.
2. **No live channels.** Email / SMS / voice are dry-run only.
3. **No public token.** Secrets live in Worker bindings; no token on a public route.
4. **No real CRM/vendor calls.** Mock / sandbox connectors only.
5. **No broad Alta clone.** The persona fleet and platform breadth are deferred.

## Ruling

> **Build the proof-first GTM action spine first. Katie/Alex/Luna equivalents
> come later** — only after the dry-run happy path passes end-to-end and the
> enterprise hardening checklist (§6) is green.

The spine exists to *prove* a GTM motion can be decided, drafted, gated, and
recorded with auditable evidence — before any named persona agent or live
surface is built on top of it.

---

## 1. Current build target

Client Zero is the first dealership customer. The target for this wave is the
**proof-first GTM action spine**: a single Worker, `gtm-spine`, that runs one
seeded dealership record through the full action lifecycle in dry-run and emits
verifiable proof.

**The happy path** (the one motion that must work before anything else proceeds):

```
ingest → decide → draft → approve (gate) → record
```

- **ingest** — accept one seeded Client Zero dealership signal (validated schema).
- **decide** — select a GTM action from the allow-list and attach a rationale.
- **draft** — render the action artifact (e.g. an outreach draft) — not sent.
- **approve** — block all state change behind an explicit human approval gate.
- **record** — write one immutable proof entry to the ledger.

Done state: the seeded record completes this path **in dry-run**, emits exactly
one immutable proof artifact, and a test asserts the whole motion. No live
channel, CRM, or public token is touched at any step.

## 2. Alta parity features deferred

Explicitly **not** built in this wave. Each is tagged with the rationale **"no
broad Alta clone."** They return only after the happy path and hardening land.

| Deferred Alta capability | Rationale |
| --- | --- |
| Persona agent fleet (Katie / Alex / Luna equivalents) | no broad Alta clone — see Ruling |
| Live omnichannel outreach (email / SMS / voice send) | no broad Alta clone + breaches Rule 2 |
| Bi-directional CRM sync | no broad Alta clone + breaches Rule 4 |
| Autonomous send without human approval | no broad Alta clone — violates the approval gate |
| Large-scale campaign orchestration | no broad Alta clone — breadth before proof |
| Analytics / reporting dashboards | no broad Alta clone — no motion to measure yet |
| Multi-tenant onboarding & provisioning | no broad Alta clone — Client Zero is single-tenant |
| Integration marketplace breadth | no broad Alta clone — breaches Rule 4 |

## 3. Kite-like controls adopted now

The governance posture we **do** adopt immediately. These are cheap to build
into the spine from day one and are what make the proof trustworthy.

- **Scoped, non-public credentials.** Secrets via Worker bindings only; no
  public token (Rule 3).
- **Capability allow-list, deny-by-default.** An action runs only if it is on
  the list; everything else is refused.
- **Mandatory human approval gate.** No state-changing or outbound action
  proceeds without explicit approval.
- **Dry-run by default.** Live connectors sit behind a single flag that ships
  **off** (Rules 2 & 4).
- **Immutable proof / audit ledger.** Append-only; entries are never edited.
- **Per-action rate / spend caps.** Enforced per action and per dealership, even
  while mocked.
- **Idempotency keys.** Every state-changing action carries one.
- **Input-hash provenance.** Each proof entry records a hash of its inputs.

## 4. Worker file ownership

"Worker" here means a **build session** (an agent like this one). Each session
owns a disjoint set of files so parallel sessions never collide. Exactly one
session owns each file; cross-session needs go through the shared
`connectors/types.ts` interface stubs — never by editing another session's files.

Proposed Cloudflare Workers (TS) layout for `workers/gtm-spine/`:

```
workers/gtm-spine/
  src/
    index.ts                 # router / entry
    spine/
      ingest.ts
      decide.ts
      draft.ts
      approve.ts
      record.ts
    connectors/
      types.ts               # shared interface stubs (the contract)
      dryrun.ts              # mock channel / CRM connectors
    controls/
      capabilities.ts        # allow-list, caps, idempotency
    ledger/
      proof.ts               # append-only proof ledger
    model/
      dealership.ts          # Client Zero data model + seed
  test/
    happy-path.test.ts
  wrangler.toml
docs/execution/
  client-zero-enterprise-build-plan.md   # this doc
```

| Session | Owns | Responsibility |
| --- | --- | --- |
| **S0 Controller** | `docs/execution/*` | This ruling; publishes interface stubs |
| **S1 Spine core** | `src/index.ts`, `src/spine/*` | The ingest→record lifecycle |
| **S2 Data model & seed** | `src/model/dealership.ts` | Client Zero record + seed |
| **S3 Controls & ledger** | `src/controls/*`, `src/ledger/proof.ts` | Allow-list, caps, proof ledger |
| **S4 Dry-run connectors** | `src/connectors/*` | Mock channel/CRM, dry-run guarantee |
| **S5 Acceptance harness** | `test/*`, `wrangler.toml` | Tests + Worker config |

## 5. Acceptance criteria

The happy path is **done** when all of the following hold:

- A seeded Client Zero dealership record exists and validates against the ingest schema.
- A dry-run run produces: a **decision** (with rationale), a **drafted action
  artifact**, an **approval-gated** state, and exactly one **recorded proof entry**.
- The proof entry is **immutable** and carries the decision rationale + an input hash.
- **No outbound call reaches a live channel or CRM** — the connector asserts dry-run.
- **No token appears on any public route** (verified against `wrangler.toml` bindings).
- The **approval gate blocks** state change until approval is granted.
- `happy-path.test.ts` and the control-gate tests pass.

## 6. Enterprise hardening checklist

- [ ] Secrets via Worker bindings only — none in code or on public routes
- [ ] All outbound connectors dry-run by default; live behind an off-by-default flag
- [ ] Capability allow-list enforced, deny-by-default
- [ ] Idempotency keys on every state-changing action
- [ ] Append-only proof ledger with input hashing
- [ ] Human approval gate on every outbound / state-changing action
- [ ] Rate / spend caps per action and per dealership
- [ ] Structured audit logging (who / what / when / why)
- [ ] Ingest schema validation on all inbound signals
- [ ] Fail-closed error handling (errors deny, never auto-proceed)
- [ ] No PII crosses the Worker boundary in dry-run
- [ ] CI green on happy-path + control-gate tests

## 7. Sessions that can run in parallel

Once **S0** publishes the interface stubs (`connectors/types.ts` and the
proof/ledger shape), the following run **concurrently** because they own disjoint
files and depend only on the shared contract — not on each other:

- **S2** — Data model & seed
- **S3** — Controls & ledger
- **S4** — Dry-run connectors
- **S5** — Acceptance harness (writes tests against the interfaces)
- **S0** — Docs (this ruling)

**S1 (spine core)** integrates these into the lifecycle and is the convergence
point; it lands the happy path once S2–S5 contracts are met.

## 8. Sessions blocked until happy path exists

Blocked until the dry-run happy path passes end-to-end **and** §6 is green. Each
is blocked because it depends on the proven motion and/or would breach a hard
rule if built now:

- **Persona agents** (Katie / Alex / Luna equivalents) — deferred per Ruling.
- **Live channel adapters** (email / SMS / voice) — Rule 2.
- **Real CRM / vendor connectors** — Rule 4.
- **Any public / token-exposed API surface** — Rule 3.
- **Multi-dealership / multi-tenant expansion** — single-tenant until proof holds.
- **Analytics / dashboard layer** — nothing to measure until the motion runs.
