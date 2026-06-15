-- 0009: tamper-EVIDENT audit chain.
-- Every audit event is hash-linked to its predecessor within the tenant
-- (prev_hash = predecessor's hash; 'genesis' for the first event). The
-- repository computes both fields on insert (packages/db/src/auditChain.ts);
-- callers can never forge or skip a link. Verification walks the chain from
-- genesis and recomputes every hash (GET /audit/verify).
--
-- Note: this is tamper-EVIDENT, not tamper-proof — a superuser who can both
-- UPDATE rows and recompute hashes can rewrite history. Anchoring the chain
-- tip externally is documented future work. RLS already grants app_user
-- insert+select only (no update/delete policy, migration 0004), so history
-- cannot be rewritten through the application role.

alter table audit_events
  add column prev_hash text,
  add column hash text;

-- Linearity: within a tenant no two events may claim the same predecessor,
-- so a concurrent-insert race surfaces as a unique violation (retried by the
-- repository), never as a silent fork of the chain.
create unique index idx_audit_events_tenant_prev on audit_events (tenant_id, prev_hash);

comment on column audit_events.prev_hash is 'Hash of the tenant''s previous audit event (''genesis'' for the first). Repo-computed.';
comment on column audit_events.hash is 'sha256 over event content + prev_hash (tamper-evident chain). Repo-computed.';
