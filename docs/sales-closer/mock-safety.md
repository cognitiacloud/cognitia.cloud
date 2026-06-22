# Sales Closer — mock/live safety doctrine

The Sales Closer **workflow core** (`packages/agents/src/closer/`, the "mock
spine") is deliberately offline and mock-safe. It walks one lead through an
explicit state machine — compliance → human approval → appointment → CRM
writeback → proof — but it performs **no live IO of any kind**. Compliance,
approval, scheduling, CRM, and proof are _integration boundaries_ (`ports.ts`);
the spine depends only on those interfaces and ships in-memory mocks for them
(`mockPorts.ts`).

This document states what is prohibited in the spine and how each prohibition is
enforced. The enforcement is executable, not aspirational — see the test files
listed below.

## What is prohibited in the closer runtime

The runtime is every non-test, non-fixture source file under
`packages/agents/src/closer/` (`index.ts`, `ports.ts`, `mockPorts.ts`,
`salesCloserWorkflow.ts`, and any future runtime file). In that runtime:

1. **No live network or client SDKs.** No `fetch`, `XMLHttpRequest`,
   `WebSocket`, `node:net/http/https/tls/dgram`, `child_process`, `axios`,
   `undici`, `node-fetch`, `ApifyClient`, `Anthropic`/`OpenAI` clients,
   `googleapis`, `twilio`, `nodemailer`, `@sendgrid`, `Stripe`, or any CRM SDK
   (`@hubspot`, `salesforce`, `pipedrive`, …). The spine also imports neither
   `@cognitia/db` nor `@cognitia/integrations`.
2. **No outbound action surface.** No `send`, `dial`, `post`, `publish`,
   `deliver`, `transmit`, or `broadcast` action is declared or exported. The
   only boundaries are `compliance`, `approval`, `appointment`, `crm`, `proof`,
   and none of them is a send path. There is no autonomous outreach — outreach
   always requires a human approval gate.
3. **No raw PII.** Fixtures are business-only (company, website, region, role,
   lawful basis). No contact email or phone, no email-shaped or phone-shaped
   literals, no `contactEmail`/`contactPhone`/`fullName` fields in fixtures or
   runtime types. `normalizeGtmProspect` would drop/hash such fields anyway; the
   fixtures simply never carry them.
4. **Approval never implies a live send.** Approval advances the state machine to
   request a (mock) appointment and a (mock) CRM writeback — never an external
   message. A `pending` approval halts the run with zero downstream effects.
   After approval the _only_ effects are the injected mock `appointment`, `crm`,
   and `proof` boundaries.
5. **CRM writeback is mock only.** The shipped CRM boundary returns a mock
   record reference (`mock-…`) and writes nothing live. A completed run records
   that mock reference in its proof details.
6. **No OAuth / social posting.** The spine carries no OAuth flow and no
   social/publishing code. Such code is a live integration and belongs in a
   separate lane behind a port, never in the core spine.

## How it is enforced

| Prohibition                         | Enforced by                                                                                                                                                                                                                              |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No network / client SDKs in runtime | `packages/agents/src/closer/mockSafety.test.ts` — static scan of runtime files; reinforced by `salesCloserWorkflow.test.ts` ("doctrine invariants") and `packages/core/src/closer.guard.test.ts` ("Phase-1 containment", whole-dir scan) |
| No raw PII fixtures                 | `mockSafety.test.ts` — fixture + runtime PII scan; `salesCloserWorkflow.test.ts` — proof/prospect PII assertions; `closer.guard.test.ts` — migrations carry no PII columns                                                               |
| No send/dial/post/publish action    | `mockSafety.test.ts` — static callable scan + exported-symbol + port-surface assertions                                                                                                                                                  |
| Approval does not imply live send   | `mockSafety.test.ts` — instrumented run proving only mock boundaries fire; pending-approval halt                                                                                                                                         |
| CRM writeback stays mock only       | `mockSafety.test.ts` — mock record-ref assertions; runtime SDK scan                                                                                                                                                                      |

## Running the guards

```sh
pnpm vitest run packages/agents/src/closer        # spine tests incl. mockSafety
pnpm vitest run packages/core/src/closer.guard.test.ts   # core containment guard
```

## Adding a real integration later

When a real compliance service, approval queue, scheduler, CRM, or proof ledger
is wired up, implement it **behind the matching `ports.ts` interface in a
separate lane/package** (e.g. an integrations adapter). Inject it where the mock
ports are injected today. Never add live IO, a vendor SDK, or an outbound action
to the core spine — doing so will fail the guards above, which is the intended
behaviour.

> This spine is mock-only and is **not** a production-ready outreach system. The
> guards prove the absence of live paths; they do not certify any live
> integration.
