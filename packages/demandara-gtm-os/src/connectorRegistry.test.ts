import { describe, expect, it } from 'vitest';
import { ActionLedger } from './actionLedger.js';
import { HumanApprovalRegistry } from './approvalGate.js';
import { ConnectorRegistry, createDefaultConnectorRegistry } from './connectorRegistry.js';
import { fixedClock, sequentialIds } from './testSupport.test.js';

const LEAD_ID = 'bw-fake-lead-0001';

function setup() {
  const clock = fixedClock();
  const ledger = new ActionLedger({ clock, idFactory: sequentialIds('led') });
  const registry = createDefaultConnectorRegistry({ clock, idFactory: sequentialIds('int') });
  const approvals = new HumanApprovalRegistry({ clock, idFactory: sequentialIds('appr') });
  const approval = approvals.issue({
    leadId: LEAD_ID,
    decision: 'approved',
    approvedBy: 'operator_fixture_01',
  });
  return { ledger, registry, approval };
}

const intentInput = (
  connectorId: string,
  approval: ReturnType<typeof setup>['approval'] | null,
) => ({
  connectorId,
  leadId: LEAD_ID,
  vertical: 'budget_wheels_dealeros' as const,
  target: 'mock CRM lead record',
  payloadSummary: { scenarioId: 'bw_happy_path_mock_only' },
  approval,
});

describe('connector registry (deny by default)', () => {
  it('defaults live-leaning connectors to blocked/disabled states', () => {
    const { registry } = setup();
    expect(registry.get('email_sms')?.state).toBe('live_blocked');
    expect(registry.get('model_provider')?.state).toBe('disabled');
    expect(registry.get('crm_mock')?.state).toBe('mock_only');
    for (const entry of registry.list()) {
      expect(entry.egressAllowed).toBe(false);
    }
  });

  it('rejects registration of any connector that allows egress', () => {
    const registry = new ConnectorRegistry();
    expect(() =>
      registry.register({
        connectorId: 'rogue',
        vertical: 'all',
        capability: 'anything',
        state: 'mock_only',
        read: true,
        write: true,
        allowedDataMode: 'fake_fixture',
        approvalRequired: true,
        egressAllowed: true,
        mockFixturePath: null,
        proofEventType: 'x',
        blockedReasonNote: null,
      }),
    ).toThrow(/egress is not permitted/);
  });

  it('records a mock writeback intent for a mock_only connector with approval', () => {
    const { ledger, registry, approval } = setup();
    const result = registry.recordWritebackIntent(intentInput('crm_mock', approval), ledger);
    expect(result.status).toBe('recorded_mock_intent');
    if (result.status === 'recorded_mock_intent') {
      expect(result.intent.mockOnly).toBe(true);
      expect(result.intent.egressPerformed).toBe(false);
      expect(result.intent.approvalId).toBe(approval.approvalId);
    }
    expect(ledger.eventsOfType('connector_writeback_recorded')).toHaveLength(1);
    expect(registry.recordedIntents()).toHaveLength(1);
  });

  it('blocks a live_blocked connector and records a proof event', () => {
    const { ledger, registry, approval } = setup();
    const result = registry.recordWritebackIntent(intentInput('email_sms', approval), ledger);
    expect(result.status).toBe('blocked');
    if (result.status === 'blocked') expect(result.reason.code).toBe('CONNECTOR_LIVE_BLOCKED');
    const blockedEvents = ledger.eventsOfType('connector_blocked');
    expect(blockedEvents).toHaveLength(1);
    expect(blockedEvents[0]?.payload['reasonCode']).toBe('CONNECTOR_LIVE_BLOCKED');
  });

  it('blocks a disabled connector', () => {
    const { ledger, registry, approval } = setup();
    const result = registry.recordWritebackIntent(intentInput('model_provider', approval), ledger);
    expect(result.status).toBe('blocked');
    if (result.status === 'blocked') expect(result.reason.code).toBe('CONNECTOR_LIVE_BLOCKED');
  });

  it('blocks an unregistered connector', () => {
    const { ledger, registry, approval } = setup();
    const result = registry.recordWritebackIntent(intentInput('shadow_crm', approval), ledger);
    expect(result.status).toBe('blocked');
    if (result.status === 'blocked') expect(result.reason.code).toBe('CONNECTOR_NOT_REGISTERED');
  });

  it('blocks a mock_only writeback without a verified approval event', () => {
    const { ledger, registry } = setup();
    const result = registry.recordWritebackIntent(intentInput('crm_mock', null), ledger);
    expect(result.status).toBe('blocked');
    if (result.status === 'blocked') expect(result.reason.code).toBe('CONNECTOR_APPROVAL_REQUIRED');
    expect(registry.recordedIntents()).toHaveLength(0);
  });
});
