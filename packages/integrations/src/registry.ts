import type { ActionProvenance, ApprovedAgentAction } from '@cognitia/core';
import type { AdapterResult, IntegrationAdapter } from './types.js';

/**
 * Dispatches an approved action to the adapter that handles its action_type.
 * The action ledger owns approval/idempotency; this only routes execution.
 */
export class AdapterRegistry {
  private readonly adapters: IntegrationAdapter[] = [];

  register(adapter: IntegrationAdapter): this {
    this.adapters.push(adapter);
    return this;
  }

  find(actionType: string): IntegrationAdapter | undefined {
    return this.adapters.find((a) => a.handles(actionType));
  }

  async execute(
    action: ApprovedAgentAction,
    provenance?: ActionProvenance,
  ): Promise<AdapterResult> {
    const adapter = this.find(action.action_type);
    if (!adapter) {
      return { ok: false, detail: `no adapter for action_type ${action.action_type}` };
    }
    return adapter.execute(action, provenance);
  }
}
