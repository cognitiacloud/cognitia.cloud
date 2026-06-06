import { randomUUID } from 'node:crypto';
import type { Repository } from '@cognitia/db';
import { AdapterRegistry, StubEmailAdapter, StubHubspotAdapter } from '@cognitia/integrations';
import type { TenantApprovalSettings } from '@cognitia/core';
import type { AgentDeps, SuppressionProvider } from './deps.js';
import { ActionLedger } from './ledger/actionLedger.js';
import { AgentRunService } from './runtime/agentRunService.js';
import { FeedbackRecorder } from './feedback/feedbackRecorder.js';
import { MiraAgent } from './mira/mira.js';
import type { DraftStore } from './mira/draftStore.js';

export interface GtmServicesOptions {
  repo: Repository;
  adapters?: AdapterRegistry;
  now?: () => Date;
  newId?: () => string;
  settings?: TenantApprovalSettings;
  suppression?: SuppressionProvider;
}

export interface GtmServices {
  deps: AgentDeps;
  ledger: ActionLedger;
  runService: AgentRunService;
  feedback: FeedbackRecorder;
  mira: MiraAgent;
  draftStore: DraftStore;
}

/**
 * Assemble the agent runtime over a Repository. Defaults wire the stub adapters
 * (email + HubSpot) so the approval→execute path works end-to-end without real
 * APIs. Clock/id are injectable for deterministic tests.
 */
export function createGtmServices(opts: GtmServicesOptions): GtmServices {
  const adapters =
    opts.adapters ??
    new AdapterRegistry().register(new StubEmailAdapter()).register(new StubHubspotAdapter());

  const deps: AgentDeps = {
    repo: opts.repo,
    adapters,
    now: opts.now ?? (() => new Date()),
    newId: opts.newId ?? (() => randomUUID()),
  };

  const mira = new MiraAgent({
    deps,
    settings: opts.settings,
    suppression: opts.suppression,
  });

  return {
    deps,
    ledger: new ActionLedger(deps),
    runService: new AgentRunService(deps),
    feedback: new FeedbackRecorder(deps),
    mira,
    draftStore: mira.draftStore,
  };
}
