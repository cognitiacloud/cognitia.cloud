# Client Zero Proof Harness

Acceptance-proof harness for the Client Zero happy path:

```
lead in → consent gate → compliance gate → human approval
        → appointment booking (mock) → CRM writeback (mock) → proof report
```

It produces a **tamper-evident proof artifact** (machine-readable JSON) and a
**human-readable Markdown report** that show *what happened* in the pipeline. It
**never promises an outcome**.

## Hard rules (enforced, not just documented)

- **No live APIs** — the calendar and CRM are deterministic in-process mocks
  (`provider: "mock-calendar"`, `system: "mock-crm"`).
- **No real PII** — fixtures use synthetic data (`@example.test`, `+1-555-01xx`).
  Identities are reduced to salted, irreversible references (`leadRef`). The
  finished artifact is scanned **fail-closed**: if any PII-shaped value is found,
  the harness throws and emits nothing.
- **No outcome claims** — every artifact carries an explicit disclaimer that it
  makes no claim or guarantee of sales, revenue, ROI, search ranking,
  finance/credit approval, or lead volume.

## Run it (zero dependencies)

Requires **Node ≥ 22.6** (native TypeScript type stripping — no build step, no
`npm install`).

```bash
# run all tests
npm test
# equivalently:
node --experimental-strip-types --test proof/tests/pii.test.ts proof/tests/harness.test.ts

# generate a proof from a fixture (prints JSON, or writes to a dir with --out)
node --experimental-strip-types proof/src/cli.ts run proof/fixtures/lead-approved.json --out proof/out

# verify an existing proof artifact (recomputes the hash chain + re-runs PII scan)
node --experimental-strip-types proof/src/cli.ts verify proof/artifacts/lead-approved.proof.json

# regenerate the committed sample artifacts
node --experimental-strip-types proof/src/cli.ts regen   # or: npm run proof:regen
```

Optional static typecheck (the only thing that needs dependencies):

```bash
npm install        # pulls dev-only typescript + @types/node
npm run typecheck
```

## What's here

| Path | Purpose |
| --- | --- |
| `../packages/core/src/schemas.ts` | Closer-pipeline domain schemas + validators (source of truth) |
| `../packages/core/src/pii.ts` | PII scan / redact / salted `hashRef` |
| `../packages/core/src/proof.ts` | Proof artifact shape, event hashing, `verifyChain`, `isSuccessProof` |
| `src/harness.ts` | `runScenario()` — the pipeline |
| `src/report.ts` | `renderReport()` — Markdown report |
| `src/cli.ts` | `run` / `verify` / `regen` / `list` |
| `fixtures/` | One approved + three blocked scenarios |
| `artifacts/` | Committed sample proof JSON + report Markdown |
| `tests/` | The four required proofs + tamper evidence + sample-sync |
| `INTEGRATION_CONTRACT.md` | Interfaces the workflow / compliance / CRM workers implement |

## The four proofs the tests establish

1. **A blocked lead cannot produce a success proof.** Any gate that blocks stops
   the pipeline; booking and writeback are recorded as `skipped`, never `ok`, and
   `isSuccessProof()` is structurally false.
2. **An approved lead can produce a proof.** The approved fixture yields a
   `completed` artifact with a booked appointment and a written CRM record, with a
   verified hash chain.
3. **The proof contains no raw PII.** No fixture name / email / phone appears in
   the serialized artifact; an independent re-scan finds nothing.
4. **The proof references the consent / compliance / approval / writeback events.**
   `eventIndex` points at the exact hash of each gate's event in the chain.

## How the proof is tamper-evident

Each pipeline step appends an event to a hash chain: every event hashes its own
content plus the previous event's hash (genesis = 64 zeros). `auditChainRoot` is
the final hash. `verifyChain()` recomputes the whole chain; editing any recorded
field anywhere breaks it.
