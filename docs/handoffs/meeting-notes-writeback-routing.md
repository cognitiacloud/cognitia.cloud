# Lane: meeting-notes writeback routing

Routes an **approved meeting writeback** (from the meeting skill) through the
**existing governed `crm.note.create` lifecycle** instead of a second CRM write
path — so a meeting note gets the same HubSpot adapter, approval gate, audit
trail, and idempotency as every other CRM write, and **one meeting yields exactly
one note (no duplicate engagements)**.

Additive only: no new action type, no new adapter, no migration, no route change,
no GTM PR. Fakes-only tests; no credentials/DB/network.

## What is built (real, tested)

- `apps/api/src/meetingWriteback.ts`
  - `meetingWritebackToNoteProposal(env, ctx)` — **pure** map from an approved
    meeting writeback envelope → the existing `crm.note.create` `ProposeInput`.
    Targets `contact:<id>`, grounds the note in `meeting:<id>`, and keys the
    content fingerprint on the **meeting id** (`meetingNoteFingerprint`).
  - `ingestMeetingWriteback(ledger, env, ctx)` — proposes that action via the
    existing `ActionLedger`. Idempotent: re-delivery of the same meeting returns
    the prior proposed action (ledger replay on the meeting-keyed idempotency
    key), so no duplicate note is ever created.
  - `MeetingWritebackError` — fail-closed: refuses any envelope that is not
    `kind === 'writeback.approved'` / `review_status === 'approved'`, or whose
    ids are malformed. A CRM write is never proposed for an unreviewed/rejected
    meeting.
- `apps/api/src/meetingWriteback.test.ts` — 7 tests (fakes only): pure mapping,
  fail-closed refusals, full governed lifecycle into **exactly one** HubSpot note
  write via the existing adapter, the approval gate (execute refused before
  approval, nothing written), idempotent re-delivery (no duplicate), and one
  note per distinct meeting.

## Trust posture (nothing weakened)

- **PII discipline preserved.** The raw meeting summary is **not** inlined into
  the CRM write. The HubSpot note body is the deterministic governance template
  (`packages/integrations/src/hubspot/writePlan.ts` `engagementContent`); the
  summary stays out-of-band (`payload_ref`), and the meeting is cited only as
  grounding evidence — the same rule the platform already applies to drafts.
- **Approval gate preserved.** This only _proposes_. The operator still approves
  the `crm.note.create` action before the ledger executes the HubSpot write — no
  side effect without human approval (covered by a test).
- **Idempotency / no duplicates.** Fingerprint keyed on the meeting id →
  `idempotencyKey({tenant, action_type, target_ref, content_fingerprint})` →
  one note per meeting; re-execution is an idempotent replay.
- RLS/RBAC/audit are inherited unchanged from the existing ledger + adapter path.

## What is a seam (not built here, honest)

- **Transport.** The meeting skill (`hermes/skills/meeting-skill`, Python) emits a
  `writeback.approved` `SyncEvent`; it never writes CRM (`no_autonomous_crm_write`).
  This lane is the **platform-side consumer contract** (`MeetingWritebackEnvelope`)
  plus the routing logic. Wiring the actual delivery of that event into the API
  (e.g. an operator-gated `POST /meetings/:id/writeback` route, or a worker that
  drains the skill's SyncEvent store) is a thin follow-up — deliberately not added
  here to avoid touching the high-conflict `server.ts`/`handlers.ts` and to keep
  this lane bounded. The envelope type is the stable contract for that wiring.
- **Live HubSpot.** Execution uses the injected HubSpot client; tests use
  `FakeHubspotClient`. A real write needs per-tenant OAuth credentials + the
  `cognitia_*` custom properties on Notes (see hubspot-onboarding) — infra/operator,
  not in this lane.

## How to verify

```
# narrowest:
npx vitest run apps/api/src/meetingWriteback.test.ts
# full gate:
pnpm check        # format:check + typecheck + vitest run  (83 files / 546 tests green)
```

## Next step

Wire transport: an operator-gated entry point that hands a `writeback.approved`
envelope to `ingestMeetingWriteback`, then the standard approval queue takes over
(approve → execute → HubSpot note). No new governance needed — it reuses the
existing `crm.note.create` path end to end.
