import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { RawGtmProspectInput } from '@cognitia/core';
import { canContactProspect, normalizeGtmProspect } from '@cognitia/core';
import {
  // B1 — assembly island: real Sales Closer workflow + in-code compliance doctrine.
  assembleGtmRunPacket,
  type GtmRunPacket,
  // B2 — dry-run channel layer: real planner + policy gate + fail-closed live path.
  CHANNEL_KINDS,
  type ChannelKind,
  type DryRunAction,
  planDryRunAction,
  assertNoLiveSend,
  sendLive,
  LiveSendBlockedError,
  evaluateChannelPolicy,
  IMPOSSIBLE_RELEASE_GATE,
  isReleaseGateOpen,
  // B3 — CRM-lite read model: real idempotent store + operator timeline.
  createMockCrmLite,
  type MockCrmLite,
  crmIdempotencyKey,
  // B5 — TrustOps: real metrics + report builder.
  buildTrustOpsReport,
  type TrustOpsReport,
  type WorkflowRunSummary,
  // B6 — release gate: real fail-closed evaluator.
  evaluateReleaseGate,
  RELEASE_STAGES,
  type ReleaseConditions,
  type ReleaseGateResult,
} from '../index.js';

/**
 * COMMAND CENTER — END-TO-END DATA-PATH SCENARIOS.
 *
 * These tests drive one lead at a time through the *real* Command Center data
 * path and assert on outputs derived from real upstream module results — never
 * on hand-authored literals. The path, in order:
 *
 *   lead → B1 assembleGtmRunPacket (real SalesCloserWorkflow + compliance
 *          doctrine) → B5 WorkflowRunSummary → B3 CRM-lite read model
 *          (idempotent upserts + timeline) → B2 dry-run channel plan (policy
 *          gate + planner) → B5 TrustOps report → B6 release gate.
 *
 * MOCK / SANDBOX / DRY-RUN ONLY. Tenant is the `budget_wheels_demo` /
 * Tenant Zero sandbox. No network, no vendor SDK, no real CRM, no live send,
 * no raw PII. Every downstream input is computed from the real packet so a
 * regression anywhere in the path fails a real assertion.
 */

const SANDBOX_WORKSPACE = 'budget_wheels_demo';
const FIXED_NOW = new Date('2026-06-22T00:00:00.000Z');

/** A clean, contactable, business-only fixture lead (no raw PII). */
const CLEAN_LEAD: RawGtmProspectInput = {
  companyName: 'Northshore Auto Group',
  website: 'https://northshore-auto.example',
  city: 'Vancouver',
  provinceOrState: 'BC',
  country: 'CA',
  businessType: 'auto_dealership',
  source: 'public_registry',
  sourceUrl: 'https://registry.example/northshore-auto',
  sourceRisk: 'low',
  contactRole: 'General Manager',
  contactBasis: 'conspicuously_published_business_contact',
  consentStatus: 'implied_possible',
  unsubscribeStatus: 'subscribed',
  doNotContact: false,
};

/** A lead that hard-fails the contactability doctrine (do-not-contact + unsubscribed). */
const DO_NOT_CONTACT_LEAD: RawGtmProspectInput = {
  ...CLEAN_LEAD,
  companyName: 'Do-Not-Contact Motors',
  consentStatus: 'do_not_contact',
  unsubscribeStatus: 'unsubscribed',
  doNotContact: true,
};

/* ------------------------------------------------------------------ harness */

interface DataPathResult {
  packet: GtmRunPacket;
  /** Real B5 input derived from the real packet. */
  summary: WorkflowRunSummary;
  /** Did the lead clear compliance AND approval (so an action may be planned)? */
  proceeded: boolean;
  /** Real B2 policy decision for this lead. */
  channelPolicyAllow: boolean;
  /** Real B2 dry-run plans (one per channel) — empty unless the lead proceeded. */
  channelPlan: DryRunAction[];
  /** The shared CRM-lite read model used for the run (idempotent). */
  crm: MockCrmLite;
  /** Real B5 report over every run summary seen so far. */
  report: TrustOpsReport;
  /** Real B6 gate results for every release stage. */
  releaseGates: ReleaseGateResult[];
}

/** Map a real assembly packet onto the TrustOps run-summary input (B5). */
function toRunSummary(packet: GtmRunPacket): WorkflowRunSummary {
  return {
    runId: `run-${packet.prospect.id}`,
    tenant: packet.workspace.workspaceId,
    status: packet.status,
    compliance: packet.compliance.blocked ? 'blocked' : 'pass',
    approval: packet.approval.status,
    appointment: packet.appointment.requested ? 'requested' : 'skipped',
    crm: packet.crm.written ? 'ok' : 'skipped',
    proofEventsRecorded: packet.proofs.length,
    blockedReason: packet.blockedReason,
  };
}

/**
 * Project a proceeding packet into the CRM-lite read model. Mirrors the real
 * server adapter: company → contact → opportunity, plus a timeline event per
 * workflow phase. Deliberately upserts the opportunity TWICE to exercise B3
 * idempotency on the live path (not via a literal assertion).
 */
function projectToCrm(crm: MockCrmLite, packet: GtmRunPacket): void {
  if (!packet.crm.written) return;
  const workspaceId = packet.workspace.workspaceId;
  const prospectId = packet.prospect.id;
  const company = crm.upsertCompany({ workspaceId, companyName: packet.prospect.companyName });
  crm.upsertContact({
    workspaceId,
    prospectId,
    companyId: company.id,
    role: packet.prospect.contactRole,
  });
  const oppInput = {
    workspaceId,
    prospectId,
    companyId: company.id,
    stage: 'appointment_set' as const,
    appointmentRef: 'appt-1',
    crmRecordRef: 'crm-1',
  };
  crm.upsertOpportunity(oppInput);
  crm.upsertOpportunity(oppInput); // idempotent retry — must NOT create a duplicate.

  // Operator timeline: one PII-safe event per real workflow phase.
  for (const row of packet.timeline) {
    crm.timeline.record({
      workspaceId,
      prospectId,
      kind: 'note',
      outcome: row.outcome === 'advanced' ? 'ok' : row.outcome === 'halted' ? 'pending' : 'blocked',
      summary: `${row.phase}: ${row.outcome}`,
    });
  }
}

/**
 * Drive one lead through the entire real Command Center data path. Optionally
 * share a CRM-lite instance and accumulated summaries across runs so cross-run
 * invariants (idempotency, funnel rollups) can be asserted.
 */
async function runDataPath(opts: {
  lead: RawGtmProspectInput;
  overrides?: Parameters<typeof assembleGtmRunPacket>[0]['portOverrides'];
  workspaceId?: string;
  crm?: MockCrmLite;
  priorSummaries?: WorkflowRunSummary[];
}): Promise<DataPathResult> {
  let counter = 0;
  const packet = await assembleGtmRunPacket({
    lead: opts.lead,
    workspaceId: opts.workspaceId ?? SANDBOX_WORKSPACE,
    portOverrides: opts.overrides,
    now: () => FIXED_NOW,
    newId: () => `00000000-0000-0000-0000-00000000000${counter++}`,
  });

  const summary = toRunSummary(packet);
  const proceeded = packet.approval.status === 'approved' && !packet.compliance.blocked;

  // B2 — policy gate decides whether a dry-run action may even be planned.
  const policy = evaluateChannelPolicy({
    channel: 'email',
    consent: proceeded,
    approval: packet.approval.status,
    workspaceId: packet.workspace.workspaceId,
    live: false,
  });
  const channelPlan = policy.allow
    ? CHANNEL_KINDS.map((channel) =>
        planDryRunAction(channel, {
          workspaceId: packet.workspace.workspaceId,
          prospectId: packet.prospect.id,
        }),
      )
    : [];

  // B3 — project into the CRM-lite read model.
  const crm = opts.crm ?? createMockCrmLite({ now: () => FIXED_NOW });
  projectToCrm(crm, packet);

  // B5 — TrustOps over every run summary seen so far.
  const summaries = [...(opts.priorSummaries ?? []), summary];
  const report = buildTrustOpsReport(summaries);

  // B6 — every release gate, fail-closed by default.
  const releaseGates = RELEASE_STAGES.map((stage) => evaluateReleaseGate(stage));

  return {
    packet,
    summary,
    proceeded,
    channelPolicyAllow: policy.allow,
    channelPlan,
    crm,
    report,
    releaseGates,
  };
}

/* -------------------------------------------------------- scenario 1: clean */

describe('Scenario 1 — clean lead completes the mock/dry-run flow', () => {
  it('runs end-to-end: completed packet, CRM record, dry-run plan, report, gates', async () => {
    const r = await runDataPath({ lead: CLEAN_LEAD });

    // B1: the real workflow reached the terminal completed state.
    expect(r.packet.status).toBe('completed');
    expect(r.packet.finalState).toBe('completed');
    expect(r.packet.compliance).toMatchObject({ passed: true, blocked: false });
    expect(r.packet.approval.status).toBe('approved');
    expect(r.packet.appointment.requested).toBe(true);
    expect(r.packet.crm.written).toBe(true);
    expect(r.proceeded).toBe(true);

    // B3: the CRM-lite read model actually holds the projected record.
    const opps = r.crm.listOpportunities(SANDBOX_WORKSPACE);
    expect(opps).toHaveLength(1);
    expect(opps[0]!.stage).toBe('appointment_set');
    expect(r.crm.getContact(SANDBOX_WORKSPACE, r.packet.prospect.id)).toBeDefined();
    expect(r.crm.readTimeline({ prospectId: r.packet.prospect.id }).length).toBe(
      r.packet.timeline.length,
    );

    // B2: a dry-run plan exists for every channel and none of it sends.
    expect(r.channelPlan).toHaveLength(CHANNEL_KINDS.length);
    for (const action of r.channelPlan) {
      expect(action.mode).toBe('dry_run');
      expect(action.sent).toBe(false);
    }

    // B5: the report funnel is derived from the real run (one completed lead).
    expect(r.report.metrics.funnel.leadsReceived).toBe(1);
    expect(r.report.metrics.funnel.completed).toBe(1);
    expect(r.report.metrics.funnel.crmWritten).toBe(1);

    // B6: dry_run is the only stage open; everything live is blocked.
    const dryRun = r.releaseGates.find((g) => g.stage === 'dry_run');
    expect(dryRun!.passed).toBe(true);
  });
});

/* --------------------------------------------- scenario 2: do-not-contact */

describe('Scenario 2 — do-not-contact lead is blocked by the real doctrine', () => {
  it('blocks at compliance WITHOUT a port override (in-code doctrine fires)', async () => {
    // Sanity: the canonical guardrail itself refuses this prospect.
    const normalized = normalizeGtmProspect(DO_NOT_CONTACT_LEAD, { id: 'x', now: FIXED_NOW });
    expect(canContactProspect(normalized)).toBe(false);

    // No compliance override: the mock compliance port would PASS. The block
    // must come from the workflow's in-code `evaluateComplianceDoctrine`.
    const r = await runDataPath({ lead: DO_NOT_CONTACT_LEAD });

    expect(r.packet.status).toBe('blocked');
    expect(r.packet.finalState).toBe('blocked_compliance');
    expect(r.packet.compliance.blocked).toBe(true);
    expect(r.packet.compliance.reason).toMatch(/consent|contact|unsubscribe/i);

    // Nothing downstream runs: no approval grant, no appointment, no CRM, no proof.
    expect(r.packet.appointment.requested).toBe(false);
    expect(r.packet.crm.written).toBe(false);
    expect(r.packet.proofs).toEqual([]);
    expect(r.proceeded).toBe(false);

    // B2: the policy gate denies; no dry-run action is even planned.
    expect(r.channelPolicyAllow).toBe(false);
    expect(r.channelPlan).toEqual([]);

    // B3: nothing was written to the CRM read model.
    expect(r.crm.listOpportunities(SANDBOX_WORKSPACE)).toEqual([]);

    // B5: the report counts this as a compliance block, not a completion.
    expect(r.report.metrics.funnel.complianceBlock).toBe(1);
    expect(r.report.metrics.funnel.completed).toBe(0);
    expect(r.report.metrics.blockedReasons.some((g) => g.stage === 'compliance')).toBe(true);
  });
});

/* -------------------------------------------- scenario 3: pending approval */

describe('Scenario 3 — pending approval halts the flow (no auto-advance)', () => {
  it('halts awaiting a human; downstream never runs', async () => {
    const r = await runDataPath({
      lead: CLEAN_LEAD,
      overrides: { approval: { status: 'pending' } },
    });

    expect(r.packet.status).toBe('awaiting_approval');
    expect(r.packet.finalState).toBe('human_approval_required');
    expect(r.packet.approval.status).toBe('pending');

    // Halt is honest: no appointment, no CRM write, no proofs.
    expect(r.packet.appointment.requested).toBe(false);
    expect(r.packet.crm.written).toBe(false);
    expect(r.packet.proofs).toEqual([]);
    expect(r.proceeded).toBe(false);

    // The operator timeline marks the approval gate as halted, not advanced.
    expect(r.packet.timeline.at(-1)?.outcome).toBe('halted');

    // B2 denies planning while approval is pending.
    expect(r.channelPolicyAllow).toBe(false);
    expect(r.channelPlan).toEqual([]);

    // B3: no record. B5: counted as awaiting_approval.
    expect(r.crm.listOpportunities(SANDBOX_WORKSPACE)).toEqual([]);
    expect(r.report.metrics.funnel.awaitingApproval).toBe(1);
    expect(r.report.metrics.funnel.completed).toBe(0);
  });
});

/* ------------------------------------------- scenario 4: rejected approval */

describe('Scenario 4 — rejected approval halts the flow', () => {
  it('terminates at blocked_approval; downstream never runs', async () => {
    const r = await runDataPath({
      lead: CLEAN_LEAD,
      overrides: { approval: { status: 'rejected', reason: 'operator declined' } },
    });

    expect(r.packet.status).toBe('blocked');
    expect(r.packet.finalState).toBe('blocked_approval');
    expect(r.packet.approval).toMatchObject({ status: 'rejected', reason: 'operator declined' });

    // Compliance passed but approval rejected: nothing downstream.
    expect(r.packet.compliance.passed).toBe(true);
    expect(r.packet.appointment.requested).toBe(false);
    expect(r.packet.crm.written).toBe(false);
    expect(r.packet.proofs).toEqual([]);
    expect(r.proceeded).toBe(false);

    expect(r.channelPolicyAllow).toBe(false);
    expect(r.channelPlan).toEqual([]);
    expect(r.crm.listOpportunities(SANDBOX_WORKSPACE)).toEqual([]);

    // B5: counted as a blocked run at the approval stage.
    expect(r.report.metrics.funnel.approvalRejected).toBe(1);
    expect(r.report.metrics.funnel.blocked).toBe(1);
    expect(r.report.metrics.blockedReasons.some((g) => g.stage === 'approval')).toBe(true);
  });
});

/* ------------------------------------ scenario 5: dry-run planner never sends */

describe('Scenario 5 — the dry-run channel planner can never send', () => {
  it('every planned action is sent:false and passes the no-live-send tripwire', async () => {
    const r = await runDataPath({ lead: CLEAN_LEAD });
    expect(r.channelPlan.length).toBeGreaterThan(0);
    for (const action of r.channelPlan) {
      expect(action.mode).toBe('dry_run');
      expect(action.sent).toBe(false);
      expect(action.wouldSendIfLive.liveStatus).toBe('BLOCKED');
      // The runtime tripwire accepts a well-formed dry-run action.
      expect(() => assertNoLiveSend(action)).not.toThrow();
    }
  });

  it('assertNoLiveSend rejects a forged "sent" action', () => {
    const forged = { mode: 'dry_run' as const, sent: true } as unknown as DryRunAction;
    expect(() => assertNoLiveSend(forged)).toThrow(LiveSendBlockedError);
  });

  it('sendLive ALWAYS throws for every channel, even with the layer gate', () => {
    for (const channel of CHANNEL_KINDS as readonly ChannelKind[]) {
      expect(() =>
        sendLive(channel, { workspaceId: SANDBOX_WORKSPACE, prospectId: 'p-1' }),
      ).toThrow(LiveSendBlockedError);
    }
    // The only gate constructible in this layer can never be open.
    expect(isReleaseGateOpen(IMPOSSIBLE_RELEASE_GATE)).toBe(false);
  });
});

/* -------------------------------------------- scenario 6: CRM-lite idempotent */

describe('Scenario 6 — CRM-lite is idempotent across retries and re-runs', () => {
  it('re-upserting the same opportunity returns the same id (no duplicate)', () => {
    const crm = createMockCrmLite({ now: () => FIXED_NOW });
    const company = crm.upsertCompany({ workspaceId: SANDBOX_WORKSPACE, companyName: 'Acme Auto' });
    const input = {
      workspaceId: SANDBOX_WORKSPACE,
      prospectId: 'prospect-1',
      companyId: company.id,
      stage: 'appointment_set' as const,
      appointmentRef: 'appt-9',
    };
    const first = crm.upsertOpportunity(input);
    const second = crm.upsertOpportunity({ ...input, stage: 'proposal' });

    expect(second.id).toBe(first.id); // same record, updated in place
    expect(second.stage).toBe('proposal');
    expect(crm.listOpportunities(SANDBOX_WORKSPACE)).toHaveLength(1);
    expect(crmIdempotencyKey(SANDBOX_WORKSPACE, 'prospect-1', 'appt-9')).toContain('prospect-1');
  });

  it('driving the SAME lead through the full path twice yields one CRM record', async () => {
    const crm = createMockCrmLite({ now: () => FIXED_NOW });
    const first = await runDataPath({ lead: CLEAN_LEAD, crm });
    const second = await runDataPath({ lead: CLEAN_LEAD, crm });

    // Same prospect id (deterministic ids) → same idempotency key → one record.
    expect(second.packet.prospect.id).toBe(first.packet.prospect.id);
    expect(crm.listOpportunities(SANDBOX_WORKSPACE)).toHaveLength(1);
    expect(crm.listContacts(SANDBOX_WORKSPACE)).toHaveLength(1);
    expect(crm.listCompanies(SANDBOX_WORKSPACE)).toHaveLength(1);
  });
});

/* ------------------------------------------ scenario 7: TrustOps report */

describe('Scenario 7 — TrustOps report is generated from real run outcomes', () => {
  it('aggregates a mixed batch into a funnel + bounded score + mock banner', async () => {
    // Build a real batch: one completed, one compliance-blocked, one rejected,
    // one pending — each from a real workflow run.
    const summaries: WorkflowRunSummary[] = [];
    for (const run of [
      await runDataPath({ lead: CLEAN_LEAD }),
      await runDataPath({ lead: DO_NOT_CONTACT_LEAD }),
      await runDataPath({
        lead: CLEAN_LEAD,
        overrides: { approval: { status: 'rejected', reason: 'declined' } },
      }),
      await runDataPath({ lead: CLEAN_LEAD, overrides: { approval: { status: 'pending' } } }),
    ]) {
      summaries.push(run.summary);
    }

    const report = buildTrustOpsReport(summaries);

    // Funnel counts are derived from the four real runs (not literals on a page).
    expect(report.metrics.funnel.leadsReceived).toBe(4);
    expect(report.metrics.funnel.completed).toBe(1);
    expect(report.metrics.funnel.complianceBlock).toBe(1);
    expect(report.metrics.funnel.approvalRejected).toBe(1);
    expect(report.metrics.funnel.awaitingApproval).toBe(1);

    // Score is transparent + bounded; markdown is mock-labelled.
    expect(report.score.score).toBeGreaterThanOrEqual(0);
    expect(report.score.score).toBeLessThanOrEqual(100);
    expect(report.markdown).toMatch(/MOCK \/ SANDBOX/);
    expect(report.markdown).toContain('# TrustOps Analytics Report');
    expect(report.metrics.egress.noLiveEgress).toBe(true);
  });
});

/* --------------------------------------- scenario 8: release gate fails closed */

describe('Scenario 8 — the release gate fails closed', () => {
  it('controlled_live is blocked with default/empty conditions', () => {
    const gate = evaluateReleaseGate('controlled_live');
    expect(gate.passed).toBe(false);
    expect(gate.missing.length).toBeGreaterThan(0);
  });

  it('a single missing condition still blocks controlled_live', () => {
    const allButOne: ReleaseConditions = {
      signedCustomerScope: true,
      counselSignoff: true,
      founderSignoff: true,
      monitoringEnabled: true,
      rollbackReady: true,
      secretsConfigured: true,
      connectorApproval: false, // the one missing approval
    };
    const gate = evaluateReleaseGate('controlled_live', allButOne);
    expect(gate.passed).toBe(false);
    expect(gate.missingKeys).toEqual(['connectorApproval']);
  });

  it('an unknown stage fails closed', () => {
    expect(evaluateReleaseGate('go_live_now').passed).toBe(false);
  });

  it('even a fully-attested sandbox gate cannot open the dry-run send path', () => {
    // The release gate may pass in the abstract, but the channel layer's live
    // path is independently fail-closed: there is no send regardless of a gate.
    const allTrue: ReleaseConditions = {
      signedCustomerScope: true,
      counselSignoff: true,
      founderSignoff: true,
      monitoringEnabled: true,
      rollbackReady: true,
      secretsConfigured: true,
      connectorApproval: true,
    };
    expect(evaluateReleaseGate('controlled_live', allTrue).passed).toBe(true);
    // ...yet the channel layer still refuses to send.
    expect(() => sendLive('email', { workspaceId: SANDBOX_WORKSPACE, prospectId: 'p-1' })).toThrow(
      LiveSendBlockedError,
    );
  });
});

/* --------------------------------------------------- scenario 9: no raw PII */

describe('Scenario 9 — no raw PII leaks anywhere on the data path', () => {
  it('the full pipeline output for every disposition is free of raw email/phone', async () => {
    const runs = [
      await runDataPath({ lead: CLEAN_LEAD }),
      await runDataPath({ lead: DO_NOT_CONTACT_LEAD }),
      await runDataPath({ lead: CLEAN_LEAD, overrides: { approval: { status: 'pending' } } }),
    ];
    // Per the platform PII doctrine, only emails on a reserved TLD
    // (.example/.test/.invalid) are allowed; any other email shape is raw PII.
    const RESERVED_TLD = /\.(example|test|invalid)$/i;
    const emailShape = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
    const rawPhone = /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g;
    for (const r of runs) {
      const blob = JSON.stringify({
        packet: r.packet,
        summary: r.summary,
        channelPlan: r.channelPlan,
        crm: {
          companies: r.crm.listCompanies(),
          contacts: r.crm.listContacts(),
          opportunities: r.crm.listOpportunities(),
          timeline: r.crm.readTimeline(),
        },
        report: r.report,
      });
      // No email anywhere may be a real (non-reserved-TLD) address.
      for (const email of blob.match(emailShape) ?? []) {
        expect(email, `unexpected raw email in pipeline output: ${email}`).toMatch(RESERVED_TLD);
      }
      // No phone may be a real number; synthetic reserved 555-01xx is allowed.
      for (const phone of blob.match(rawPhone) ?? []) {
        expect(phone, `unexpected raw phone in pipeline output: ${phone}`).toMatch(
          /555[-.\s]?01\d{2}/,
        );
      }
      // The PiiSafeProspect must omit contact-identity fields entirely.
      expect('contactName' in r.packet.prospect).toBe(false);
      expect('contactEmailHash' in r.packet.prospect).toBe(false);
      expect('contactPhoneMasked' in r.packet.prospect).toBe(false);
    }
  });

  it('the CRM-lite read model rejects a raw email written to the timeline', () => {
    const crm = createMockCrmLite({ now: () => FIXED_NOW });
    expect(() =>
      crm.timeline.record({
        workspaceId: SANDBOX_WORKSPACE,
        prospectId: 'p-1',
        kind: 'note',
        outcome: 'info',
        summary: 'contacted owner at jane@northshore-auto.com',
      }),
    ).toThrow(/PII/i);
  });
});

/* ------------------------------------------------ scenario 10: no live egress */

describe('Scenario 10 — no live egress anywhere on the data path', () => {
  it('every packet carries a no-live-egress attestation', async () => {
    const r = await runDataPath({ lead: CLEAN_LEAD });
    expect(r.packet.noEgress).toMatchObject({ mode: 'mock', liveSendOccurred: false });
    expect(r.packet.noEgress.statement).toMatch(/MOCK\/SANDBOX/);
    expect(r.report.metrics.egress.noLiveEgress).toBe(true);
  });

  it('no data-path source file imports a network/vendor/DB primitive', () => {
    // Scan the real production modules the data path traverses. None may reach
    // the network, a vendor SDK, or a DB — the path must stay mock by construction.
    const here = dirname(fileURLToPath(import.meta.url));
    const agentsSrc = join(here, '..');
    const dataPathFiles = [
      'closer/salesCloserWorkflow.ts',
      'closer/ports.ts',
      'closer/mockPorts.ts',
      'channels/channelPolicy.ts',
      'channels/dryRunChannels.ts',
      'crm-lite/mockCrmLite.ts',
      'crm-lite/timeline.ts',
      'trustops/metrics.ts',
      'trustops/report.ts',
      'security/releaseGate.ts',
      'gtm-os/assembly/index.ts',
      'gtm-os/assembly/guards.ts',
      'gtm-os/assembly/timeline.ts',
    ];
    const bannedApi =
      /\b(fetch|child_process|node:net|node:http|node:https|node:tls|axios|ApifyClient|new\s+Anthropic|Twilio|nodemailer|@sendgrid|googleapis)\b/;
    for (const rel of dataPathFiles) {
      const src = readFileSync(join(agentsSrc, rel), 'utf8');
      expect(bannedApi.test(src), `${rel} must make no network/vendor calls`).toBe(false);
      expect(src.includes('@cognitia/db'), `${rel} must not import the DB`).toBe(false);
      expect(src.includes('@cognitia/integrations'), `${rel} must not import vendor adapters`).toBe(
        false,
      );
    }
  });
});
