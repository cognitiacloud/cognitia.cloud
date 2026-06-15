# CRM-2 — Push rules + write-back depth (stage update, approval-gated)

**Status:** implemented (GTM lane). **Backlog ref:** operating-plan §5 #6.
**Acceptance:** Signal → proposed stage-update (approval required) → one
idempotent write; `crm.*` events; `crm.push.failed.v1` on error.

## The loop

1. **Signal** — a `calendar.meeting.booked.v1` event on the immutable stream
   whose entity is an opportunity. `POST /agent-runs/stage-review` (operator+)
   scans for it (`apps/api/src/stageReview.ts`).
2. **Proposal** — for a signaled opportunity still in the entry stage, Mira
   proposes ONE `crm.stage.update` advancing it per the documented rule
   (`STAGE_ADVANCE_RULE`: booked meeting ⇒ `qualified` → `meeting_scheduled`).
   - **Medium risk** (`classifyRisk`): pipeline state is forecast-bearing, and
     medium can NEVER ride the low-risk auto-approve setting — every stage
     write is human-approved.
   - The typed plan (`stage:<externalDealId>:<from>:<to>`) is resolved from
     synced CRM facts at proposal time (the opportunity's own
     `crm.opportunity.*.v1` events carry the external id) and rides
     `payload_ref` — preview==write (GOV-1). No synced external id ⇒ the
     proposal is **refused** with `external_id_unresolved` (never guessed).
   - Grounded: the signal event id is the action's evidence ref.
   - Replayed reviews collapse to the same proposal (deterministic fingerprint).
3. **Execution** — the existing governed path, unchanged: passport + live grant
   for (`crm.stage.update`, hubspot) required (PASS-1), approval required
   (409 otherwise), ledger dual-guard + client idempotency ⇒ exactly one
   `PATCH dealstage` (`HubspotClient.updateDealStage`, Fake + HTTP impls).
4. **Events** — success emits `crm.opportunity.stage_updated.v1`
   (external_id, from_stage, to_stage). Any failed CRM write-back now also
   emits **`crm.push.failed.v1`** (action_type, reason) alongside
   `agent.action.failed.v1` — directly visible on the OBS-1 ops overview.
5. **Rollback (UNDO-1)** — the execution's `external_ref`
   (`hubspot:deal_stage:<id>:<priorStage>`) records the prior stage; rollback
   restores it (reversible write, structured reason, audited).

## Governance surface

`crm.stage.update` joins the code-derived governance matrix and trust packet
(4 action types). The PII posture is unchanged: stage names and external ids
only — no raw PII in events, payload refs, or logs.

## Tests

`apps/api/src/crmStage.test.ts` (8): signal→proposal shape (medium/gated/
grounded/typed plan), no-signal/wrong-stage/unresolved-id skips with reasons,
idempotent review replay, viewer 403, execute-before-approve 409, one-write +
replay-collapse + `stage_updated` event, adapter failure ⇒ `crm.push.failed.v1`

- failed status, rollback restores prior stage. Plus governance matrix count
  updated (now asserts the new type by name).
