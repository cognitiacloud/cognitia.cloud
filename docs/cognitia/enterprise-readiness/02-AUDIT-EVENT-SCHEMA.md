# 02 — Audit Event Schema

**Model:** `packages/enterprise-readiness/src/audit.ts`
**Tests:** `src/audit.test.ts`

## Goal

A tamper-evident, PII-free audit trail for every security- and
governance-relevant action. Mirrors the canonical event envelope
(`packages/core/src/schemas/event.ts`): `domain.entity.action.vN`, tenant-scoped,
trace-correlated.

## Envelope (`AuditEvent`)

| Field | Rule |
|-------|------|
| `id` | uuid |
| `tenant_id` | uuid, mandatory (no global fallback) |
| `event_name` | `domain.entity.action.vN`, must be a **registered** name |
| `entity_type` / `entity_id` | non-empty / uuid |
| `actor_ref` | `user:<uuid>` \| `agent:<id>` \| `system` — **never a name/email** |
| `source` | emitting component |
| `occurred_at` | ISO-8601 with offset |
| `trace_id` | correlation id |
| `payload` | refs/hashes only — **no raw PII** |

## Registered events (`AUDIT_EVENT_NAMES`)

`authz.access.denied.v1`, `authz.access.granted.v1`, `authz.role.changed.v1`,
`connector.darkmode.enforced.v1`, `connector.config.changed.v1`,
`release.gate.evaluated.v1`, `release.gate.overridden.v1`,
`action.dryrun.recorded.v1`, `action.live.blocked.v1`, `incident.declared.v1`,
`incident.resolved.v1`, `rollback.executed.v1`, `approval.founder.recorded.v1`,
`approval.legal.recorded.v1`.

## PII protection (`assertNoRawPii`)

Recursively rejects:
- forbidden keys: `email`, `phone`, `first_name`, `last_name`, `full_name`,
  `address`, `ssn`;
- any string value that looks like an email or phone number.

Hashed/ref'd values (`sha256:…`, `hash:…`, `contact:<uuid>`) pass. This is the
runtime enforcement of the "payloads carry references and hashes, never raw PII"
doctrine.

## Validation (`validateAuditEvent`)

Returns `{ ok, errors[] }`. Fails on: non-uuid identifiers, malformed or
unregistered `event_name`, missing required fields, non-ISO timestamp,
non-object payload, or any raw-PII finding.

## Retention & integrity (operational guidance)

- Append-only store; events are immutable once written.
- Recommended retention: 1 year hot, 7 years cold for security events.
- Chain integrity (hash-linked or WORM storage) is a live-stage requirement
  tracked by the release gate (#03), not enabled in mock-safe.
