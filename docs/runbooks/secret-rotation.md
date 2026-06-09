# Runbook — Secret rotation

> Supports SOC 2 secret-management (rotation <90d) + incident response (compromise).
> Three secrets matter in V1. All are injected from the secret manager — never committed.

## Inventory

| Secret                          | Env var                                         | Used by                                                 | Rotation cadence                                       | Blast radius                    |
| ------------------------------- | ----------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------ | ------------------------------- |
| Credential AES data key         | `CREDENTIAL_SECRET_KEY_BASE64` (32-byte base64) | `AesGcmSecretStore` (decrypts per-tenant HubSpot creds) | ≤90d, or immediately on compromise                     | all tenants' stored credentials |
| Operator session HMAC           | `SESSION_SECRET`                                | `HmacSessionVerifier` (operator auth)                   | ≤90d, or on compromise                                 | all active operator sessions    |
| HubSpot webhook secret          | `HUBSPOT_WEBHOOK_SECRET`                        | webhook v3 verify                                       | ≤90d, or on compromise                                 | webhook ingest auth             |
| HubSpot OAuth/private-app token | stored in `SecretStore` (per tenant)            | `HttpHubspotClient`                                     | provider rotation; refresh-token grant handled in code | one tenant                      |

## Rotate the AES data key (most sensitive)

The store encrypts each credential under the current key. Rotating the key requires
**re-encrypting** every credential. Procedure (zero-downtime, dual-key window):

1. Generate a new 32-byte key in KMS; keep the OLD key available.
2. For each `integration_connections` row with a `credential_ref`:
   - decrypt with OLD key (`SecretStore.get` using old key),
   - `SecretStore.put` (re-encrypt with NEW key).
3. Cut `CREDENTIAL_SECRET_KEY_BASE64` over to the NEW key; redeploy.
4. Run `deploy-verification.md` (esp. a live approve→execute on a test tenant).
5. Destroy/retire the OLD key after confirming all rows re-encrypted.

> Implementation note: a one-shot re-encryption job is the natural place for this
> (reads each connection, re-puts the credential). Until that job exists, rotation
> is a maintenance window with the dual-key steps above. **(Codex: candidate task —
> a `rotate-credentials` worker job; non-fence, post-alpha.)**

## Rotate `SESSION_SECRET`

- Rotating invalidates all existing sessions (users must re-login). Acceptable.
- Set new value, redeploy. Optionally support an old+new verifier window to avoid mass logout.

## Rotate `HUBSPOT_WEBHOOK_SECRET`

- Update the secret in the HubSpot app config AND the env together; brief webhook
  rejections are expected in the gap (HubSpot retries). Verify with a signed test event.

## Compromise response (any secret)

- Treat as SEV-1 if the AES key or session secret leaks (see `incident-response.md`).
- Rotate immediately; for the AES key, pause all connections first
  (`integration_connections.status='paused'`) to stop execution during re-encryption.

## Evidence to capture (SOC 2)

- Rotation date + operator, per secret.
- KMS key version history showing ≤90d rotation.
- Confirmation re-encryption completed (row count re-encrypted == credential rows).
