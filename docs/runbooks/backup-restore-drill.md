# Runbook — Backup & restore drill

> Supports SOC 2 availability (A1.2) + Go-Live Gate 0 ("backups + PITR + tested restore").
> Postgres is the source of truth; events/agent_actions/audit_events are the audit trail
> and MUST survive a restore. Run the drill before first customer data and quarterly.

## Expectations (configure at deploy)

- Automated daily backups + **point-in-time recovery (PITR)** enabled on the managed Postgres (Supabase/RDS).
- Retention: ≥ the SOC 2 window need (≥35d recommended).
- Backups encrypted at rest; access to restore is least-privilege + logged.

## Drill procedure (in a non-prod copy)

1. Note a recovery target time `T` and record current row counts for: `tenants`, `accounts`,
   `agent_actions`, `audit_events`, `events`, `integration_connections`.
2. Trigger a restore to a fresh instance at time `T` (managed-DB console or CLI).
3. Apply the app's migrations check (schema-version gate) — restored schema must match HEAD.
4. **Verify integrity:**
   - row counts match (± expected drift);
   - the audit trail is intact: pick a contact with a completed propose→approve→execute chain and confirm all `agent_actions` + `audit_events` rows exist;
   - RLS still enforced (run the isolation probe under `app_user`);
   - no secret material is in the DB (credentials remain in the SecretStore, not Postgres).
5. Point a throwaway API instance at the restored DB; `GET /health` → 200; one read works.
6. Record duration (RTO) and the recovery point (RPO) achieved.

## Pass criteria

- Restore completes within target RTO; data loss within target RPO.
- Audit trail + RLS intact on the restored copy.

## Rollback / safety

- Drill runs on a COPY; never restore over prod without an incident declaration.
- If restoring prod (incident), pause connections first (kill switch) to prevent
  concurrent execution against partially-restored state.

## Evidence to capture (SOC 2)

- Backup configuration screenshot (schedule, PITR on, retention).
- Drill record: date, target T, RTO/RPO achieved, integrity check results, operator.
