# Event taxonomy

> Events are immutable. They are the audit and learning substrate. Every event
> conforms to the schema in `packages/core/src/events`.

## 1. Naming convention

```
domain.entity.action.vN
```

- `domain` — bounded context: `crm`, `outbound`, `agent`, `signal`, `eval`,
  `integration`, `system`.
- `entity` — the subject: `account`, `contact`, `lead`, `email`, `run`,
  `action`, `sequence`, etc.
- `action` — past-tense verb: `created`, `updated`, `proposed`, `approved`,
  `rejected`, `executed`, `replied`, `failed`.
- `vN` — schema version, starting at `v1`. Bump on any breaking payload change;
  never mutate an existing version's shape.

Examples: `crm.contact.created.v1`, `agent.action.proposed.v1`,
`outbound.email.replied.v1`.

## 2. Required event fields

Every event row/object carries:

| Field         | Type        | Notes                                                 |
| ------------- | ----------- | ----------------------------------------------------- |
| `id`          | uuid        | Event identity.                                       |
| `tenant_id`   | uuid        | Tenant isolation.                                     |
| `event_name`  | string      | `domain.entity.action.vN`.                            |
| `entity_type` | string      | Subject type, e.g. `account`.                         |
| `entity_id`   | uuid        | Subject id.                                           |
| `source`      | string      | Producer: `api`, `worker`, `agent:mira`, `hubspot`.   |
| `occurred_at` | timestamptz | When it happened (source clock).                      |
| `ingested_at` | timestamptz | When we recorded it (our clock).                      |
| `payload`     | jsonb       | Versioned payload; **no raw PII** (refs/hashes only). |
| `trace_id`    | string      | Correlates work across services.                      |

Payloads must validate against the Zod schema registered for that
`event_name`. Unknown event names are rejected at the boundary.

## 3. Internal event list (v1)

| Event name                         | Emitted by | When                                     |
| ---------------------------------- | ---------- | ---------------------------------------- |
| `agent.run.created.v1`             | agents     | Agent run created.                       |
| `agent.run.completed.v1`           | agents     | Run finished successfully.               |
| `agent.run.failed.v1`              | agents     | Run failed.                              |
| `agent.action.proposed.v1`         | agents     | Side-effect action proposed.             |
| `agent.action.approved.v1`         | api        | Human approved an action.                |
| `agent.action.rejected.v1`         | api        | Human rejected an action.                |
| `agent.action.executed.v1`         | worker/api | Action executed via adapter.             |
| `agent.action.failed.v1`           | worker/api | Execution failed.                        |
| `agent.recommendation.created.v1`  | agents     | Non-side-effect recommendation produced. |
| `agent.feedback.recorded.v1`       | agents     | Human edit/approval/outcome captured.    |
| `outbound.sequence.drafted.v1`     | agents     | Email sequence draft created.            |
| `outbound.touchpoint.scheduled.v1` | worker     | Touchpoint scheduled.                    |
| `signal.detected.v1`               | worker     | Buying/timing signal detected.           |
| `eval.run.completed.v1`            | evals      | Eval run finished.                       |

## 4. External event list (v1)

Ingested from outside; normalized into `events` after validation.

| Event name                    | Source       | When                        |
| ----------------------------- | ------------ | --------------------------- |
| `crm.account.created.v1`      | hubspot/sfdc | Company created/synced.     |
| `crm.account.updated.v1`      | hubspot/sfdc | Company updated.            |
| `crm.contact.created.v1`      | hubspot/sfdc | Contact created/synced.     |
| `crm.contact.updated.v1`      | hubspot/sfdc | Contact updated.            |
| `crm.opportunity.updated.v1`  | hubspot/sfdc | Deal stage/amount changed.  |
| `inbound.lead.received.v1`    | web/form     | Inbound lead submitted.     |
| `outbound.email.delivered.v1` | email        | Provider delivery callback. |
| `outbound.email.opened.v1`    | email        | Open tracked.               |
| `outbound.email.replied.v1`   | email        | Reply received.             |
| `outbound.email.bounced.v1`   | email        | Bounce/complaint.           |
| `calendar.meeting.booked.v1`  | calendar     | Meeting booked.             |

## 5. Rules

1. **Immutable:** events are insert-only. Corrections are new events, never
   edits.
2. **Versioned:** add `v2` rather than changing `v1`. Old consumers keep
   working.
3. **PII-safe:** payloads reference entities (`account:uuid`) and store hashes,
   not raw emails/phones/transcripts/message bodies.
4. **Traceable:** `trace_id` flows from the originating request/job through
   every derived event.
5. **Validated:** an event that fails its registered schema is rejected; it is
   never silently stored.
