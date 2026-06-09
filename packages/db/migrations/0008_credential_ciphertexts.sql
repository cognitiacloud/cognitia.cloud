-- 0008_credential_ciphertexts.sql
-- Persistent backing for the credential SecretStore (AES-256-GCM ciphertext only).
--
-- SECURITY MODEL / RLS EXCEPTION: this is a system key-value vault, not a tenant
-- data table. Rows contain ONLY ciphertext (iv.tag.data, base64) encrypted under
-- the KMS-held data key; refs are opaque identifiers. Tenant association lives in
-- integration_connections.credential_ref (which IS RLS-protected). Decryption is
-- impossible without the key, so cross-tenant exposure of these rows reveals
-- nothing. RLS is intentionally not enabled here; access is limited to app_user
-- via grants. Documented in docs/security/control-matrix.md (SC-1).

create table credential_ciphertexts (
  ref text primary key,
  ciphertext text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table credential_ciphertexts is
  'SecretStore backing: AES-256-GCM ciphertext only; key lives in KMS, never here.';

create trigger trg_credential_ciphertexts_updated before update on credential_ciphertexts
  for each row execute function set_updated_at();
