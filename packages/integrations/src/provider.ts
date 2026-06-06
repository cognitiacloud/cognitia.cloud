import type { ProviderKind } from './types.js';

/**
 * Standard provider adapter interface (connect/sync/read/write) used by the
 * integration framework. Concrete providers (HubSpot, Salesforce, ...) implement
 * this; the MVP ships signature-only stubs for Codex/humans to fill in.
 */
export interface ProviderConnection {
  tenantId: string;
  connectionId: string;
  credentialRef: string; // reference to encrypted secret; never raw tokens
}

export interface SyncResult {
  upserted: number;
  cursor?: string;
}

export interface ProviderAdapter {
  readonly system: string;
  readonly kind: ProviderKind;
  connect(input: { tenantId: string; credentialRef: string }): Promise<ProviderConnection>;
  sync(conn: ProviderConnection, opts?: { since?: string }): Promise<SyncResult>;
  read(conn: ProviderConnection, query: Record<string, unknown>): Promise<unknown>;
  /** Writes must be idempotent (idempotency_key supplied by the action ledger). */
  write(
    conn: ProviderConnection,
    op: { type: string; idempotencyKey: string; payload: Record<string, unknown> },
  ): Promise<{ externalRef: string }>;
}
