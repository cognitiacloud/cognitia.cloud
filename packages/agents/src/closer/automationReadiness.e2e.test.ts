import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  canContactProspect,
  normalizeGtmProspect,
  type GtmProspect,
  type RawGtmProspectInput,
} from '@cognitia/core';

import { FIXTURE_LEAD } from './__fixtures__/lead.fixture.js';
import { createSalesCloserWorkflow } from './salesCloserWorkflow.js';
import { createMockCloserPorts, type MockPortOverrides } from './mockPorts.js';

import {
  CHANNEL_KINDS,
  evaluateChannelPolicy,
  type ChannelPolicyInput,
  type ReleaseGate,
} from '../channels/channelPolicy.js';
import {
  assertNoLiveSend,
  LiveSendBlockedError,
  planDryRunAction,
  sendLive,
  type DryRunChannelInput,
} from '../channels/dryRunChannels.js';

import {
  evaluateReleaseGate,
  type ReleaseConditions,
  type ReleaseStage,
} from '../security/releaseGate.js';

import { assembleGtmRunPacket } from '../gtm-os/assembly/index.js';
import { assertNoRawPii as assertPacketNoRawPii } from '../gtm-os/assembly/guards.js';

import { createMockCrmLite } from '../crm-lite/mockCrmLite.js';
import {
  assertNoRawPii as assertTimelineNoRawPii,
  createCrmTimeline,
} from '../crm-lite/timeline.js';

/**
 * Automation-readiness E2E matrix.
 *
 * This is the exhaustive "may automation proceed?" gate, exercised end-to-end
 * over the REAL lane modules — never re-implemented logic:
 *
 *   - contactability   → `canContactProspect`      (@cognitia/core)
 *   - human approval   → Sales Closer workflow      (closer lane, W1)
 *   - channel policy   → `evaluateChannelPolicy`    (channels lane, B2)
 *   - release gate     → `evaluateReleaseGate`      (security lane, B6)
 *   - dry-run / send   → `planDryRunAction`/`sendLive` (channels lane, B2)
 *   - PII guards       → gtm-os + crm-lite/timeline (B1 / B3)
 *   - kill switch      → ENF-1 connection-halt semantics (ledger), mirrored
 *                        here as a sandbox connection-status flag so the matrix
 *                        stays fully offline.
 *
 * Doctrine under test: automation is FAIL-CLOSED. The happy path can only plan
 * a dry run (never a live send); flipping any single gate must block. Nothing
 * here performs live outreach, touches a vendor SDK/network, writes a real CRM,
 * or carries raw PII — and several tests assert exactly that, by construction.
 */

const FIXED_NOW = new Date('2026-06-22T00:00:00.000Z');
const FIXED_ID = '22222222-2222-2222-2222-222222222220';
const WORKSPACE_ID = 'budget_wheels_demo';

function workflow(overrides: MockPortOverrides = {}) {
  let counter = 0;
  return createSalesCloserWorkflow({
    ports: createMockCloserPorts(overrides),
    now: () => FIXED_NOW,
    newId: () => `${FIXED_ID.slice(0, -1)}${counter++}`,
  });
}

function prospectFrom(raw: RawGtmProspectInput): GtmProspect {
  return normalizeGtmProspect(raw, { id: FIXED_ID, now: FIXED_NOW });
}

/* ------------------------------------------------- readiness composition layer */

type ReadinessBlocker = 'not_contactable' | 'channel_policy' | 'release_gate' | 'kill_switch';

/**
 * Mirrors ENF-1 (`AgentActionLedger.connectionHalt`): any non-`active`
 * integration connection status halts external automation for the tenant.
 * Modelled as a flag so the matrix needs no DB/adapters.
 */
type ConnectionStatus = 'active' | 'paused' | 'error' | 'revoked';

function connectionHalted(status: ConnectionStatus): boolean {
  return status !== 'active';
}

interface AutomationReadinessInput {
  prospect: GtmProspect;
  channel: ChannelPolicyInput;
  releaseStage: ReleaseStage;
  releaseConditions: ReleaseConditions;
  connectionStatus?: ConnectionStatus;
}

interface AutomationReadinessResult {
  ready: boolean;
  blockers: ReadinessBlocker[];
  reasons: string[];
}

/**
 * Compose the real lane modules into one fail-closed readiness decision. Every
 * sub-decision is delegated to its owning module; this function only collects
 * the blockers. Any blocker => not ready.
 */
function evaluateAutomationReadiness(input: AutomationReadinessInput): AutomationReadinessResult {
  const blockers: ReadinessBlocker[] = [];
  const reasons: string[] = [];

  if (!canContactProspect(input.prospect)) {
    blockers.push('not_contactable');
    reasons.push('prospect is not contactable (consent / unsubscribe / do-not-contact)');
  }

  const policy = evaluateChannelPolicy(input.channel);
  if (!policy.allow) {
    blockers.push('channel_policy');
    reasons.push(...policy.reasons);
  }

  const gate = evaluateReleaseGate(input.releaseStage, input.releaseConditions);
  if (!gate.passed) {
    blockers.push('release_gate');
    reasons.push(gate.reason);
  }

  const status = input.connectionStatus ?? 'active';
  if (connectionHalted(status)) {
    blockers.push('kill_switch');
    reasons.push(`automation halted: connection_${status}`);
  }

  return { ready: blockers.length === 0, blockers, reasons };
}

/** Every release condition satisfied — the only state in which live could proceed. */
const ALL_LIVE_CONDITIONS: Required<ReleaseConditions> = {
  signedCustomerScope: true,
  counselSignoff: true,
  founderSignoff: true,
  monitoringEnabled: true,
  rollbackReady: true,
  secretsConfigured: true,
  connectorApproval: true,
};

function liveConditionsWithout(key: keyof ReleaseConditions): ReleaseConditions {
  return { ...ALL_LIVE_CONDITIONS, [key]: false };
}

/** A baseline that passes every gate, so each test can flip exactly one. */
function readyInput(): AutomationReadinessInput {
  return {
    prospect: prospectFrom(FIXTURE_LEAD),
    channel: {
      channel: 'email',
      consent: true,
      approval: 'approved',
      workspaceId: WORKSPACE_ID,
      live: false,
    },
    // dry_run requires no live conditions — the only stage automation may use here.
    releaseStage: 'dry_run',
    releaseConditions: {},
    connectionStatus: 'active',
  };
}

const dryRunInput: DryRunChannelInput = {
  workspaceId: WORKSPACE_ID,
  prospectId: 'prospect_0001',
};

/* ------------------------------------------------------------------ 1. can plan */

describe('1. clean dry-run can plan', () => {
  it('is ready when every gate passes', () => {
    const result = evaluateAutomationReadiness(readyInput());
    expect(result.ready).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it('runs the full closer workflow to completed with a no-egress packet', async () => {
    const packet = await assembleGtmRunPacket({
      lead: FIXTURE_LEAD,
      workspaceId: WORKSPACE_ID,
      now: () => FIXED_NOW,
      newId: (() => {
        let c = 0;
        return () => `${FIXED_ID.slice(0, -1)}${c++}`;
      })(),
    });
    expect(packet.status).toBe('completed');
    expect(packet.finalState).toBe('completed');
    expect(packet.compliance.passed).toBe(true);
    expect(packet.approval.status).toBe('approved');
    expect(packet.appointment.requested).toBe(true);
    expect(packet.crm.written).toBe(true);
    expect(packet.noEgress.liveSendOccurred).toBe(false);
  });

  it('plans a dry-run action that is never sent for every channel', () => {
    for (const channel of CHANNEL_KINDS) {
      const action = planDryRunAction(channel, dryRunInput);
      expect(action.mode).toBe('dry_run');
      expect(action.sent).toBe(false);
      expect(() => assertNoLiveSend(action)).not.toThrow();
    }
  });
});

/* ------------------------------------------------------------ 2. pending approval */

describe('2. pending approval blocks', () => {
  it('pauses the workflow at the human gate (no downstream effects)', async () => {
    const run = await workflow({ approval: { status: 'pending' } }).run(FIXTURE_LEAD);
    expect(run.status).toBe('awaiting_approval');
    expect(run.state).toBe('human_approval_required');
    expect(run.proofs).toEqual([]);
  });

  it('blocks readiness via the channel policy (approval !== approved)', () => {
    const result = evaluateAutomationReadiness({
      ...readyInput(),
      channel: { ...readyInput().channel, approval: 'pending' },
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual(['channel_policy']);
  });
});

/* ----------------------------------------------------------- 3. rejected approval */

describe('3. rejected approval blocks', () => {
  it('terminates the workflow in blocked_approval with no proofs', async () => {
    const run = await workflow({ approval: { status: 'rejected', reason: 'not a fit' } }).run(
      FIXTURE_LEAD,
    );
    expect(run.status).toBe('blocked');
    expect(run.state).toBe('blocked_approval');
    expect(run.proofs).toEqual([]);
  });

  it('blocks readiness via the channel policy (approval rejected)', () => {
    const result = evaluateAutomationReadiness({
      ...readyInput(),
      channel: { ...readyInput().channel, approval: 'rejected' },
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual(['channel_policy']);
  });
});

/* -------------------------------------------------------------- 4. missing consent */

describe('4. missing consent blocks', () => {
  it('blocks readiness when per-contact consent is not captured', () => {
    const result = evaluateAutomationReadiness({
      ...readyInput(),
      channel: { ...readyInput().channel, consent: false },
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual(['channel_policy']);
    expect(result.reasons.some((r) => r.startsWith('consent_required'))).toBe(true);
  });

  it('the channel policy itself denies a no-consent plan', () => {
    const decision = evaluateChannelPolicy({
      channel: 'email',
      consent: false,
      approval: 'approved',
      workspaceId: WORKSPACE_ID,
    });
    expect(decision.allow).toBe(false);
  });
});

/* ------------------------------------------------- 5. missing connector approval */

describe('5. missing connector approval blocks', () => {
  it('fails the controlled_live release gate', () => {
    const gate = evaluateReleaseGate('controlled_live', liveConditionsWithout('connectorApproval'));
    expect(gate.passed).toBe(false);
    expect(gate.missingKeys).toEqual(['connectorApproval']);
  });

  it('blocks readiness with only the release gate as blocker', () => {
    const result = evaluateAutomationReadiness({
      ...readyInput(),
      releaseStage: 'controlled_live',
      releaseConditions: liveConditionsWithout('connectorApproval'),
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual(['release_gate']);
  });
});

/* --------------------------------------------------------------- 6. missing secrets */

describe('6. missing secrets blocks', () => {
  it('fails the controlled_live release gate', () => {
    const gate = evaluateReleaseGate('controlled_live', liveConditionsWithout('secretsConfigured'));
    expect(gate.passed).toBe(false);
    expect(gate.missingKeys).toEqual(['secretsConfigured']);
  });

  it('blocks readiness with only the release gate as blocker', () => {
    const result = evaluateAutomationReadiness({
      ...readyInput(),
      releaseStage: 'controlled_live',
      releaseConditions: liveConditionsWithout('secretsConfigured'),
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual(['release_gate']);
  });
});

/* ------------------------------------------------------ 7. monitoring unavailable */

describe('7. monitoring unavailable blocks', () => {
  it('fails the private_pilot release gate (monitoring required)', () => {
    const gate = evaluateReleaseGate('private_pilot', { rollbackReady: true });
    expect(gate.passed).toBe(false);
    expect(gate.missingKeys).toContain('monitoringEnabled');
  });

  it('blocks readiness with only the release gate as blocker', () => {
    const result = evaluateAutomationReadiness({
      ...readyInput(),
      releaseStage: 'controlled_live',
      releaseConditions: liveConditionsWithout('monitoringEnabled'),
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual(['release_gate']);
  });
});

/* --------------------------------------------------------- 8. rollback unavailable */

describe('8. rollback unavailable blocks', () => {
  it('fails the private_pilot release gate (rollback required)', () => {
    const gate = evaluateReleaseGate('private_pilot', { monitoringEnabled: true });
    expect(gate.passed).toBe(false);
    expect(gate.missingKeys).toContain('rollbackReady');
  });

  it('blocks readiness with only the release gate as blocker', () => {
    const result = evaluateAutomationReadiness({
      ...readyInput(),
      releaseStage: 'controlled_live',
      releaseConditions: liveConditionsWithout('rollbackReady'),
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual(['release_gate']);
  });
});

/* ----------------------------------------------------------------- 9. kill switch */

describe('9. kill switch blocks', () => {
  it('halts readiness even when every release condition is satisfied', () => {
    // Gate fully green so the ONLY possible blocker is the kill switch.
    const greenGate = evaluateReleaseGate('controlled_live', ALL_LIVE_CONDITIONS);
    expect(greenGate.passed).toBe(true);

    const result = evaluateAutomationReadiness({
      ...readyInput(),
      releaseStage: 'controlled_live',
      releaseConditions: ALL_LIVE_CONDITIONS,
      connectionStatus: 'paused',
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual(['kill_switch']);
  });

  it('every non-active connection status halts (ENF-1 semantics)', () => {
    for (const status of ['paused', 'error', 'revoked'] as const) {
      expect(connectionHalted(status)).toBe(true);
      const result = evaluateAutomationReadiness({ ...readyInput(), connectionStatus: status });
      expect(result.ready).toBe(false);
      expect(result.blockers).toContain('kill_switch');
    }
    expect(connectionHalted('active')).toBe(false);
  });
});

/* ------------------------------------------------------------------- 10. raw PII */

describe('10. raw PII blocks', () => {
  it('the gtm-os packet guard throws on a raw email', () => {
    expect(() => assertPacketNoRawPii({ note: 'reach gm@dealership.com' }, 'test')).toThrow(
      /raw PII/,
    );
  });

  it('crm-lite refuses a contact email outside the reserved TLDs', () => {
    const crm = createMockCrmLite({ now: () => FIXED_NOW });
    const company = crm.upsertCompany({ workspaceId: WORKSPACE_ID, companyName: 'Acme Motors' });
    expect(() =>
      crm.upsertContact({
        workspaceId: WORKSPACE_ID,
        prospectId: 'p1',
        companyId: company.id,
        emailExample: 'real.person@gmail.com',
      }),
    ).toThrow(/reserved TLD/);
  });

  it('the timeline guard rejects raw-looking email and phone PII', () => {
    expect(() => assertTimelineNoRawPii('contact gm@dealership.com')).toThrow(/raw-looking email/);
    expect(() => assertTimelineNoRawPii('call 415-922-0188')).toThrow(/raw-looking phone/);
    // Synthetic, clearly-fake values are allowed through.
    expect(() => assertTimelineNoRawPii('lead@buyer.example')).not.toThrow();
    expect(() => assertTimelineNoRawPii('call +1-555-0142')).not.toThrow();
  });

  it('the assembled packet never serializes a raw email', async () => {
    const packet = await assembleGtmRunPacket({
      lead: { ...FIXTURE_LEAD, contactEmail: 'gm@northshore-auto.com' },
      workspaceId: WORKSPACE_ID,
      now: () => FIXED_NOW,
      newId: (() => {
        let c = 0;
        return () => `${FIXED_ID.slice(0, -1)}${c++}`;
      })(),
    });
    expect(JSON.stringify(packet)).not.toMatch(/@/);
  });
});

/* -------------------------------------------------------------- 11. do-not-contact */

describe('11. do-not-contact blocks', () => {
  it('canContactProspect is false for a do-not-contact prospect', () => {
    expect(canContactProspect(prospectFrom({ ...FIXTURE_LEAD, doNotContact: true }))).toBe(false);
    expect(
      canContactProspect(prospectFrom({ ...FIXTURE_LEAD, unsubscribeStatus: 'unsubscribed' })),
    ).toBe(false);
  });

  it('blocks the workflow at compliance by doctrine (before any boundary)', async () => {
    const run = await workflow().run({ ...FIXTURE_LEAD, doNotContact: true });
    expect(run.state).toBe('blocked_compliance');
    expect(run.blockedReason).toMatch(/not contactable/);
  });

  it('blocks readiness via the contactability gate', () => {
    const result = evaluateAutomationReadiness({
      ...readyInput(),
      prospect: prospectFrom({ ...FIXTURE_LEAD, doNotContact: true }),
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('not_contactable');
  });
});

/* ----------------------------------------------------- 12. sandbox never sends */

describe('12. sandbox simulation never sends', () => {
  it('planDryRunAction is always sent:false with a BLOCKED live preview', () => {
    for (const channel of CHANNEL_KINDS) {
      const action = planDryRunAction(channel, dryRunInput);
      expect(action.sent).toBe(false);
      expect(action.mode).toBe('dry_run');
      expect(action.wouldSendIfLive.liveStatus).toBe('BLOCKED');
    }
  });

  it('assertNoLiveSend trips on a forged sent:true action', () => {
    const forged = { mode: 'dry_run', sent: true } as unknown as Parameters<
      typeof assertNoLiveSend
    >[0];
    expect(() => assertNoLiveSend(forged)).toThrow(LiveSendBlockedError);
  });

  it('sendLive fails closed for every channel, even with a forged open gate', () => {
    const forcedGate: ReleaseGate = {
      legalReviewComplete: true,
      consentVerified: true,
      signedReleaseApproval: true,
      impossibleToken: 'anything-the-caller-tries',
    };
    for (const channel of CHANNEL_KINDS) {
      expect(() => sendLive(channel, dryRunInput)).toThrow(/live channels disabled/);
      expect(() => sendLive(channel, dryRunInput, forcedGate)).toThrow(LiveSendBlockedError);
    }
  });

  it('a completed run carries a no-live-egress attestation', async () => {
    const packet = await assembleGtmRunPacket({
      lead: FIXTURE_LEAD,
      workspaceId: WORKSPACE_ID,
      now: () => FIXED_NOW,
      newId: (() => {
        let c = 0;
        return () => `${FIXED_ID.slice(0, -1)}${c++}`;
      })(),
    });
    expect(packet.noEgress.liveSendOccurred).toBe(false);
    expect(packet.noEgress.mode).toBe('mock');
  });
});

/* ----------------------------------------- source-scan guards (13 / 14 / 15) */

const SCAN_DIR = dirname(fileURLToPath(import.meta.url));

/** Production lane sources this matrix drives — never test/fixture files. */
const LANE_SOURCES: ReadonlyArray<string> = [
  'salesCloserWorkflow.ts',
  'mockPorts.ts',
  'ports.ts',
  'index.ts',
  '../channels/channelPolicy.ts',
  '../channels/dryRunChannels.ts',
  '../security/releaseGate.ts',
  '../security/permissionModel.ts',
  '../gtm-os/assembly/index.ts',
  '../gtm-os/assembly/guards.ts',
  '../crm-lite/mockCrmLite.ts',
  '../crm-lite/timeline.ts',
];

function readLaneSource(relative: string): string {
  return readFileSync(join(SCAN_DIR, relative), 'utf8');
}

describe('13. no vendor imports', () => {
  const vendors = [
    'twilio',
    'sendgrid',
    'hubspot',
    '@hubspot',
    'apify',
    'apollo',
    'nodemailer',
    'openai',
    'new Anthropic',
    'googleapis',
    'stripe',
  ];

  it('no lane source imports or instantiates a vendor SDK', () => {
    for (const file of LANE_SOURCES) {
      const src = readLaneSource(file).toLowerCase();
      for (const vendor of vendors) {
        expect(src.includes(vendor.toLowerCase()), `${file} must not reference ${vendor}`).toBe(
          false,
        );
      }
    }
  });
});

describe('14. no fetch / network', () => {
  const networkTokens = [
    'fetch(',
    'axios',
    'node:http',
    'node:https',
    'node:net',
    'node:tls',
    'node:dgram',
    'child_process',
    'xmlhttprequest',
    'websocket',
    'http://',
    'https://',
  ];

  it('no lane source performs network IO', () => {
    for (const file of LANE_SOURCES) {
      const src = readLaneSource(file).toLowerCase();
      for (const token of networkTokens) {
        expect(src.includes(token.toLowerCase()), `${file} must not contain ${token}`).toBe(false);
      }
    }
  });
});

describe('15. no real CRM write', () => {
  it('no lane source imports a real DB / integrations / CRM client', () => {
    const banned = [
      '@cognitia/db',
      '@cognitia/integrations',
      'pg',
      'postgres',
      'drizzle',
      'prisma',
    ];
    for (const file of LANE_SOURCES) {
      const src = readLaneSource(file);
      for (const dep of banned) {
        expect(src.includes(`'${dep}'`), `${file} must not import ${dep}`).toBe(false);
        expect(src.includes(`"${dep}"`), `${file} must not import ${dep}`).toBe(false);
      }
    }
  });

  it('the workflow CRM writeback produces only a mock record reference', async () => {
    const run = await workflow().run(FIXTURE_LEAD);
    const proposalProof = run.proofs.find((p) => p.kind === 'gtm.proposal.generated.v1');
    expect(proposalProof?.detailsPrivate.crmRecordRef).toBe('mock-crm-record');
  });

  it('crm-lite is purely in-memory and idempotent (no external write, no duplicate)', () => {
    const timeline = createCrmTimeline({ now: () => FIXED_NOW });
    const crm = createMockCrmLite({ now: () => FIXED_NOW, timeline });
    const company = crm.upsertCompany({ workspaceId: WORKSPACE_ID, companyName: 'Acme Motors' });

    const first = crm.upsertOpportunity({
      workspaceId: WORKSPACE_ID,
      prospectId: 'p1',
      companyId: company.id,
      stage: 'appointment_set',
      appointmentRef: 'appt-1',
    });
    const second = crm.upsertOpportunity({
      workspaceId: WORKSPACE_ID,
      prospectId: 'p1',
      companyId: company.id,
      stage: 'proposal',
      appointmentRef: 'appt-1',
    });

    expect(second.id).toBe(first.id); // idempotent upsert — never a duplicate
    expect(crm.listOpportunities(WORKSPACE_ID)).toHaveLength(1);
    expect(second.stage).toBe('proposal');
  });
});
