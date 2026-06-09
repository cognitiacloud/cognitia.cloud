import { sql, type Kysely } from 'kysely';
import type { Database } from './schema.js';

/**
 * Persistent backing for the credential SecretStore. Structurally implements the
 * `CiphertextStore` interface from @cognitia/integrations (get/set by ref) without
 * importing it (avoids a dependency cycle). Rows hold AES-256-GCM ciphertext only;
 * the data key lives in KMS (see migration 0008 for the security model).
 */
export class CredentialCiphertextStore {
  constructor(private readonly db: Kysely<Database>) {}

  async get(ref: string): Promise<string | null> {
    const row = await this.db
      .selectFrom('credential_ciphertexts')
      .select('ciphertext')
      .where('ref', '=', ref)
      .executeTakeFirst();
    return row?.ciphertext ?? null;
  }

  async set(ref: string, ciphertext: string): Promise<void> {
    await sql`
      insert into credential_ciphertexts (ref, ciphertext)
      values (${ref}, ${ciphertext})
      on conflict (ref) do update set ciphertext = ${ciphertext}, updated_at = now()
    `.execute(this.db);
  }
}
