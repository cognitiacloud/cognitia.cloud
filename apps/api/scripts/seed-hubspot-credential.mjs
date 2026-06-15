#!/usr/bin/env node
/**
 * Seed a tenant + encrypted HubSpot credential (operator-handoff steps 5–6).
 *
 * - Inserts the tenant row (no-op if it exists).
 * - Encrypts the HubSpot token with AES-256-GCM (same `iv.tag.data` base64 format
 *   as AesGcmSecretStore) and upserts it into credential_ciphertexts.
 * - Upserts the integration_connections row (hubspot, active, credential_ref).
 *
 * Secrets come from ENV ONLY (never argv, never logged):
 *   DATABASE_URL                   Postgres (app role with insert grants)
 *   CREDENTIAL_SECRET_KEY_BASE64   32-byte base64 AES data key (KMS-sourced)
 *   HUBSPOT_PRIVATE_APP_TOKEN      the HubSpot token to store
 *
 * Usage:
 *   node apps/api/scripts/seed-hubspot-credential.mjs \
 *     --tenant <tenant-uuid> [--tenant-name "Acme"] [--tenant-slug acme] \
 *     [--credential-ref cred-hubspot-<tenant-uuid>]
 */
import { createCipheriv, randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';

const args = process.argv.slice(2);
const get = (flag, dflt) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};

const databaseUrl = process.env.DATABASE_URL;
const keyB64 = process.env.CREDENTIAL_SECRET_KEY_BASE64;
const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
const tenantId = get('--tenant');

for (const [name, v] of [
  ['DATABASE_URL', databaseUrl],
  ['CREDENTIAL_SECRET_KEY_BASE64', keyB64],
  ['HUBSPOT_PRIVATE_APP_TOKEN', token],
  ['--tenant', tenantId],
]) {
  if (!v) {
    console.error(`${name} is required`);
    process.exit(1);
  }
}
const key = Buffer.from(keyB64, 'base64');
if (key.length !== 32) {
  console.error('CREDENTIAL_SECRET_KEY_BASE64 must decode to exactly 32 bytes');
  process.exit(1);
}

const tenantName = get('--tenant-name', `Tenant ${tenantId.slice(0, 8)}`);
const tenantSlug = get('--tenant-slug', `tenant-${tenantId.slice(0, 8)}`);
const credentialRef = get('--credential-ref', `cred-hubspot-${tenantId}`);

// Private-app tokens do not expire/refresh; far-future expiry, no refresh token.
const credential = {
  accessToken: token,
  expiresAt: new Date(Date.now() + 10 * 365 * 24 * 3600_000).toISOString(),
};

// AES-256-GCM, identical format to AesGcmSecretStore: base64(iv).base64(tag).base64(data)
const iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', key, iv);
const data = Buffer.concat([cipher.update(JSON.stringify(credential), 'utf8'), cipher.final()]);
const tag = cipher.getAuthTag();
const blob = `${iv.toString('base64')}.${tag.toString('base64')}.${data.toString('base64')}`;

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
try {
  await client.query('begin');
  await client.query(
    `insert into tenants (id, name, slug) values ($1::uuid, $2, $3)
     on conflict (id) do nothing`,
    [tenantId, tenantName, tenantSlug],
  );
  await client.query(
    `insert into credential_ciphertexts (ref, ciphertext) values ($1, $2)
     on conflict (ref) do update set ciphertext = excluded.ciphertext, updated_at = now()`,
    [credentialRef, blob],
  );
  await client.query(
    `insert into integration_connections (id, tenant_id, external_system, status, credential_ref)
     values ($1::uuid, $2::uuid, 'hubspot', 'active', $3)
     on conflict (tenant_id, external_system)
       do update set credential_ref = excluded.credential_ref, status = 'active', updated_at = now()`,
    [randomUUID(), tenantId, credentialRef],
  );
  await client.query('commit');
  // PII/secret-safe output: refs only, never the token or ciphertext.
  console.log(
    JSON.stringify({
      ok: true,
      tenant_id: tenantId,
      credential_ref: credentialRef,
      system: 'hubspot',
      status: 'active',
    }),
  );
} catch (err) {
  await client.query('rollback');
  console.error(`seed failed: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
} finally {
  await client.end();
}
