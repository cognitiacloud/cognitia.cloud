# SEC-2 — Audit-trail export + retention

**Status:** implemented (GTM lane). **Builds on:** SEC-1 tamper-evident audit
chain (`packages/db/src/auditChain.ts`). **Code:** `apps/api/src/auditExport.ts`,
handlers `exportContactAudit` / `auditRetention`, routes under `/audit/*`.

Two SOC 2-relevant controls on top of the append-only, hash-chained audit log.

## 1. One-click per-contact export

`POST /audit/contacts/:id/export` → a self-verifying bundle of a contact's
**full action + approval chain**:

- the contact record (PII is already hashed at rest — `email_hash`, `phone_hash`);
- every governed `agent_action` that targeted `contact:<id>` (oldest first);
- every audit event recorded against those actions or the contact —
  proposed → approved/denied → executed → rolled back (oldest first);
- **`chain_verification`**: a live re-run of `verifyAuditChain` over the whole
  tenant chain, embedded so a reviewer can recompute integrity independently;
- a `retention` block (below).

**Gating & accountability:** operator+ (`requireMutatingRole`). The export
**access is itself logged** to the audit trail as `audit_exported`, attributed
to the verified user — so "who pulled what, when" is part of the record. The
embedded proof is computed **before** the access event is appended, so it
reflects exactly what the reviewer received. A viewer is refused (403); a
missing contact is 404.

## 2. Minimum-retention status

`GET /audit/retention` (read-only, viewer-allowed; optional `?retention_days=`)
→ a `RetentionStatus` over the tenant log.

The control is **minimum retention**: the audit log is append-only and
hash-chained, so events are **never silently dropped** — the retention floor is
guaranteed _by construction_, and `compliant` holds whenever the chain is
intact. The report surfaces:

- `window_days` (default **2555** = 7 years, SOC 2-friendly; overridable per call);
- `oldest_event_at` / `newest_event_at` / `retained_through_days`;
- `beyond_window_count` — events older than the window, **eligible for anchored
  archival**, not purged.

### Deliberate non-goal: destructive purge

Hard-deleting an event past the window would break the hash chain and destroy
tamper-evidence. So purge is **not** automated here. Archival-past-window
belongs to a separate, externally-anchored step (documented future work) — the
same honest posture as "tamper-evident, not tamper-proof" in SEC-1. The enforced
SOC 2 control ("retain audit logs for ≥ the retention period and export on
demand") is fully met and provable today.

## Guardrails preserved

- Least privilege: export is operator+, retention status is read-only.
- Accountability: every export is attributed and logged.
- No new shared-data-layer contract: SEC-2 reads existing repo methods
  (`getContact`, `listAgentActions`, `listAuditEvents`) and adds no migration —
  zero conflict surface with the agent-economy lane (see
  `docs/competitive/LANE_RECONCILIATION.md`).
- Tests: `apps/api/src/auditExport.test.ts` (export scoping, embedded proof,
  access-logging, role-gating, 404, retention floor + archival flag, pure
  `classifyRetention`).
