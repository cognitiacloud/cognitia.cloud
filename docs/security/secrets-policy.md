# Secrets Policy

> **STATUS: MOCK / SANDBOX.** Formalizes control **SC-1**. No production secret
> lives in this repo or in this document. The encryption primitive is real and
> tested; the production key (KMS) and rotation cadence are deploy-time concerns.

Source / ties:

- AES-256-GCM secret store: `packages/db/src/credentialStore.ts`,
  `packages/db/migrations/0008_credential_ciphertexts.sql`.
- Rotation procedure: `docs/runbooks/secret-rotation.md`.
- Redaction: API redaction scanner (`apps/api/src/redaction/scanner.ts`),
  core logging redaction (`packages/core/src/logging.ts`).
- Control row: `docs/security/control-matrix.md` SC-1, CR-2.

## Policy

1. **No secrets in the repo.** No production keys, tokens, or credentials in
   source, tests, fixtures, CI logs, or docs. `.env.example` holds names only.
2. **Encrypted at rest.** Tenant credentials are stored as ciphertext
   (AES-256-GCM) referenced by a per-tenant `credential_ref`; plaintext secrets
   are never persisted.
3. **KMS-sourced key.** The AES data key is sourced from a KMS in production —
   never hard-coded, never committed.
4. **Rotation < 90 days**, and immediately on suspected compromise. Follow
   `docs/runbooks/secret-rotation.md`.
5. **Never logged.** Secrets must never reach logs; the redaction filters scrub
   token/key/PII-shaped strings. A secret-in-log occurrence is a SEV-1
   (`docs/runbooks/incident-response.md`).
6. **Least exposure.** Secrets are read only by the component that needs them;
   no broad fan-out of decrypted material.
7. **Fail closed.** Missing required secret config (e.g. `SESSION_SECRET`) ⇒
   deny / refuse to start, never run in an unauthenticated mode.

## Lifecycle

| Stage  | Requirement                                                        |
| ------ | ------------------------------------------------------------------ |
| Issue  | Generated/stored via the secret store; `credential_ref` recorded.  |
| Use    | Decrypted in-memory only at point of use; never logged.            |
| Rotate | < 90d cadence or on compromise; per `secret-rotation.md`.          |
| Revoke | Immediate on incident; invalidate dependent sessions.              |
| Audit  | Rotation events recorded; no-token-in-log test as evidence (SC-1). |

## Pre-go-live checklist

- [ ] Production AES key held in KMS with rotation policy enabled.
- [ ] No-token-in-log test green; redaction scanner covers new secret shapes.
- [ ] Rotation runbook rehearsed; revocation path verified.
- [ ] `.env.example` lists every required var by name (no values).
