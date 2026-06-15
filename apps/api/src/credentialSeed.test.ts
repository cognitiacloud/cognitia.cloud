import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createCipheriv, createHmac, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Kysely } from 'kysely';
import { PGlite } from '@electric-sql/pglite';
import { KyselyPGlite } from 'kysely-pglite';
import { CredentialCiphertextStore, KyselyRepository, type Database } from '@cognitia/db';
import { AesGcmSecretStore, ConnectionTokenProvider } from '@cognitia/integrations';
import { HmacSessionVerifier } from './auth.js';

/**
 * Live-rollout blocker regression (found during launch verification):
 * 1. credential_ciphertexts (migration 0008) persists SecretStore blobs — an
 *    operator-seeded credential must survive and decrypt via the SAME path the
 *    production composition uses (CredentialCiphertextStore + AesGcmSecretStore
 *    + ConnectionTokenProvider).
 * 2. The operator scripts' formats match the server (seed blob + session token).
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const migrationsDir = join(repoRoot, 'packages', 'db', 'migrations');
const TENANT = '11111111-1111-1111-1111-111111111111';
const KEY = Buffer.alloc(32, 7);

let pglite: PGlite;
let db: Kysely<Database>;

beforeAll(async () => {
  pglite = new PGlite();
  for (const f of [
    '0001_tenants_users.sql',
    '0002_integrations_external_maps.sql',
    '0008_credential_ciphertexts.sql',
  ]) {
    await pglite.exec(
      readFileSync(join(migrationsDir, f), 'utf8').replace(/create extension[^;]*;/gi, ''),
    );
  }
  const { dialect } = new KyselyPGlite(pglite);
  db = new Kysely<Database>({ dialect });
});
afterAll(async () => {
  await db.destroy();
});

/** Encrypt exactly as apps/api/scripts/seed-hubspot-credential.mjs does. */
function seedScriptBlob(credential: object): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(credential), 'utf8'), cipher.final()]);
  return `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${data.toString('base64')}`;
}

describe('credential persistence (rollout blocker fix)', () => {
  it('an operator-seeded blob persists in Postgres and resolves to a usable token', async () => {
    // Seed exactly like the operator script: tenant + connection + ciphertext.
    await pglite.query(`insert into tenants (id, name, slug) values ($1::uuid, $2, $3)`, [
      TENANT,
      'Acme',
      'acme',
    ]);
    const ref = `cred-hubspot-${TENANT}`;
    await pglite.query(
      `insert into integration_connections (tenant_id, external_system, status, credential_ref)
       values ($1::uuid, 'hubspot', 'active', $2)`,
      [TENANT, ref],
    );
    const blob = seedScriptBlob({
      accessToken: 'live-hubspot-token',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    });
    const backing = new CredentialCiphertextStore(db);
    await backing.set(ref, blob);

    // Production composition path: Pg-backed store -> ConnectionTokenProvider.
    const repo = new KyselyRepository(db);
    const secrets = new AesGcmSecretStore(KEY, backing);
    const provider = new ConnectionTokenProvider({ repo, secrets });
    expect(await provider.getAccessToken(TENANT)).toBe('live-hubspot-token');
  });

  it('upsert replaces an existing ciphertext (credential rotation path)', async () => {
    const backing = new CredentialCiphertextStore(db);
    await backing.set('ref-rot', 'old');
    await backing.set('ref-rot', 'new');
    expect(await backing.get('ref-rot')).toBe('new');
    expect(await backing.get('ref-missing')).toBeNull();
  });
});

describe('operator scripts match server formats', () => {
  it('issue-session.mjs emits a token the HmacSessionVerifier accepts', async () => {
    const token = execFileSync(
      'node',
      [
        join(repoRoot, 'apps', 'api', 'scripts', 'issue-session.mjs'),
        '--tenant',
        TENANT,
        '--role',
        'operator',
      ],
      { env: { ...process.env, SESSION_SECRET: 'test-secret' }, encoding: 'utf8' },
    ).trim();
    const principal = await new HmacSessionVerifier('test-secret').verify(token);
    expect(principal).toMatchObject({ tenantId: TENANT, role: 'operator' });
    // sanity: same payload signed with another secret is rejected
    const forged = createHmac('sha256', 'wrong').update(token.split('.')[0]!).digest('base64url');
    expect(
      await new HmacSessionVerifier('test-secret').verify(`${token.split('.')[0]}.${forged}`),
    ).toBeNull();
  });
});
