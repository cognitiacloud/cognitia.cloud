import type { Repository } from '@cognitia/db';
import type { AdapterRegistry } from '@cognitia/integrations';

/** Injectable runtime dependencies. Clock and id generator are injectable so
 *  agent runs are deterministic under test. */
export interface AgentDeps {
  repo: Repository;
  adapters: AdapterRegistry;
  now: () => Date;
  newId: () => string;
}

/** A per-tenant suppression set used by guardrails / policy gate. */
export interface SuppressionSet {
  emails?: Set<string>;
  contactRefs?: Set<string>;
}

/** Resolves the suppression set for a tenant. Default impl can read a table. */
export interface SuppressionProvider {
  get(tenantId: string): Promise<SuppressionSet>;
}

/** A no-op suppression provider (per-contact `is_suppressed` still applies). */
export const emptySuppressionProvider: SuppressionProvider = {
  async get() {
    return {};
  },
};
