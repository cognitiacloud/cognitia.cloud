import { randomUUID } from 'node:crypto';
import type { ActionLedger } from './actionLedger.js';
import type { ApprovalEvent } from './approvalGate.js';
import { blockedReason } from './types.js';
import type { BlockedReason, Clock, DataMode, IdFactory, VerticalId } from './types.js';

/**
 * Connector registry (12_CONNECTOR_REGISTRY_CONTEXT.md).
 *
 * Describes external-system connectors WITHOUT enabling live action. Deny
 * rule: if a connector's state is not explicitly `mock_only`, any action is
 * blocked and a proof event is recorded. Egress is never allowed in this
 * build — registering a connector with `egressAllowed: true` throws.
 */

export type ConnectorState =
  | 'disabled'
  | 'mock_only'
  | 'read_only_future'
  | 'write_future_requires_approval'
  | 'live_blocked';

export interface ConnectorEntry {
  connectorId: string;
  vertical: VerticalId | 'all';
  capability: string;
  state: ConnectorState;
  read: boolean;
  write: boolean;
  allowedDataMode: DataMode;
  approvalRequired: boolean;
  /** Must be false in this build; true is rejected at registration. */
  egressAllowed: boolean;
  mockFixturePath: string | null;
  proofEventType: string;
  blockedReasonNote: string | null;
}

/** A mock writeback intent — a record of what WOULD be written, nothing more. */
export interface WritebackIntent {
  intentId: string;
  connectorId: string;
  leadId: string;
  vertical: VerticalId;
  approvalId: string;
  target: string;
  payloadSummary: Record<string, unknown>;
  recordedAt: string;
  mockOnly: true;
  egressPerformed: false;
}

export type WritebackResult =
  | { status: 'recorded_mock_intent'; intent: WritebackIntent }
  | { status: 'blocked'; reason: BlockedReason };

export interface ConnectorRegistryOptions {
  clock?: Clock;
  idFactory?: IdFactory;
}

export class ConnectorRegistry {
  private readonly entries = new Map<string, ConnectorEntry>();
  private readonly intents: WritebackIntent[] = [];
  private readonly clock: Clock;
  private readonly idFactory: IdFactory;

  constructor(options: ConnectorRegistryOptions = {}) {
    this.clock = options.clock ?? (() => new Date());
    this.idFactory = options.idFactory ?? randomUUID;
  }

  register(entry: ConnectorEntry): void {
    if (entry.egressAllowed) {
      throw new Error(
        `Connector '${entry.connectorId}' declares egressAllowed=true; egress is not permitted in this build.`,
      );
    }
    this.entries.set(entry.connectorId, entry);
  }

  get(connectorId: string): ConnectorEntry | undefined {
    return this.entries.get(connectorId);
  }

  list(): readonly ConnectorEntry[] {
    return [...this.entries.values()];
  }

  recordedIntents(): readonly WritebackIntent[] {
    return [...this.intents];
  }

  /**
   * Record a mock writeback intent. Deny by default:
   *   - unknown connector -> blocked;
   *   - state !== mock_only -> blocked (live/disabled/future states);
   *   - missing verified human approval -> blocked.
   * Every blocked attempt is appended to the ledger as a proof event.
   */
  recordWritebackIntent(
    input: {
      connectorId: string;
      leadId: string;
      vertical: VerticalId;
      target: string;
      payloadSummary: Record<string, unknown>;
      approval: ApprovalEvent | null;
    },
    ledger: ActionLedger,
  ): WritebackResult {
    const entry = this.entries.get(input.connectorId);
    const block = (reason: BlockedReason): WritebackResult => {
      ledger.append('connector_blocked', {
        connectorId: input.connectorId,
        leadId: input.leadId,
        state: entry?.state ?? 'unregistered',
        reasonCode: reason.code,
        detail: reason.detail,
      });
      return { status: 'blocked', reason };
    };

    if (!entry) {
      return block(blockedReason('CONNECTOR_NOT_REGISTERED', `Connector: ${input.connectorId}.`));
    }
    if (entry.state !== 'mock_only') {
      return block(
        blockedReason(
          'CONNECTOR_LIVE_BLOCKED',
          `Connector: ${entry.connectorId}, state: ${entry.state}.`,
        ),
      );
    }
    if (entry.approvalRequired && !input.approval) {
      return block(
        blockedReason('CONNECTOR_APPROVAL_REQUIRED', `Connector: ${entry.connectorId}.`),
      );
    }

    const intent: WritebackIntent = Object.freeze({
      intentId: this.idFactory(),
      connectorId: entry.connectorId,
      leadId: input.leadId,
      vertical: input.vertical,
      approvalId: input.approval?.approvalId ?? 'not_required',
      target: input.target,
      payloadSummary: input.payloadSummary,
      recordedAt: this.clock().toISOString(),
      mockOnly: true as const,
      egressPerformed: false as const,
    });
    this.intents.push(intent);
    ledger.append('connector_writeback_recorded', {
      intentId: intent.intentId,
      connectorId: intent.connectorId,
      leadId: intent.leadId,
      approvalId: intent.approvalId,
      mockOnly: true,
      egressPerformed: false,
    });
    return { status: 'recorded_mock_intent', intent };
  }
}

/**
 * Default connector families (12_CONNECTOR_REGISTRY_CONTEXT.md). Live-leaning
 * families (email/SMS, model provider) default to blocked/disabled states.
 */
export function createDefaultConnectorRegistry(
  options: ConnectorRegistryOptions = {},
): ConnectorRegistry {
  const registry = new ConnectorRegistry(options);
  const base = {
    vertical: 'all' as const,
    allowedDataMode: 'fake_fixture' as const,
    approvalRequired: true,
    egressAllowed: false,
    blockedReasonNote: null,
  };
  registry.register({
    ...base,
    connectorId: 'crm_mock',
    capability: 'mock CRM writeback and future customer records',
    state: 'mock_only',
    read: true,
    write: true,
    mockFixturePath: 'fixtures/budgetWheels.demo.json',
    proofEventType: 'demandara.connector.crm_mock.intent.v1',
  });
  registry.register({
    ...base,
    connectorId: 'calendar_mock',
    capability: 'mock appointment intent',
    state: 'mock_only',
    read: true,
    write: true,
    mockFixturePath: 'fixtures/budgetWheels.demo.json',
    proofEventType: 'demandara.connector.calendar_mock.intent.v1',
  });
  registry.register({
    ...base,
    connectorId: 'email_sms',
    capability: 'future follow-up channel',
    state: 'live_blocked',
    read: false,
    write: false,
    mockFixturePath: null,
    proofEventType: 'demandara.connector.email_sms.blocked.v1',
    blockedReasonNote: 'LIVE_DISABLED: outreach channels are blocked in this build.',
  });
  registry.register({
    ...base,
    connectorId: 'inventory_website',
    capability: 'future dealer vehicle context',
    state: 'mock_only',
    read: true,
    write: false,
    mockFixturePath: 'fixtures/budgetWheels.demo.json',
    proofEventType: 'demandara.connector.inventory_website.intent.v1',
  });
  registry.register({
    ...base,
    connectorId: 'analytics',
    capability: 'report metrics',
    state: 'mock_only',
    read: true,
    write: true,
    mockFixturePath: null,
    proofEventType: 'demandara.connector.analytics.intent.v1',
  });
  registry.register({
    ...base,
    connectorId: 'model_provider',
    capability: 'model route',
    state: 'disabled',
    read: false,
    write: false,
    mockFixturePath: null,
    proofEventType: 'demandara.connector.model_provider.blocked.v1',
    blockedReasonNote:
      'LIVE_DISABLED: model provider connectors stay disabled; use the mock/replay router harness.',
  });
  registry.register({
    ...base,
    connectorId: 'proof_store',
    capability: 'local proof receipt output',
    state: 'mock_only',
    read: true,
    write: true,
    mockFixturePath: null,
    proofEventType: 'demandara.connector.proof_store.intent.v1',
  });
  return registry;
}
