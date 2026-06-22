import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { RawGtmProspectInput } from '@cognitia/core';
import { assembleGtmRunPacket, type GtmRunPacket } from '../assembly/index.js';
import { planDryRunAction } from '../../channels/dryRunChannels.js';
import { createMockCrmLite } from '../../crm-lite/mockCrmLite.js';
import { buildTrustOpsReport } from '../../trustops/report.js';
import {
  buildProofTrace,
  packetToRunSummary,
  assertTraceNoRawPii,
  type GtmProofTrace,
} from './index.js';

const FIXED_ID = '33333333-3333-3333-3333-333333333333';
const FIXED_NOW = new Date('2026-06-22T00:00:00.000Z');

/** Business-only fixture with a raw email on the INPUT — must never reach the trace. */
const FIXTURE_LEAD: RawGtmProspectInput = {
  companyName: 'Lakeshore Motors',
  website: 'https://lakeshore-motors.example',
  city: 'Calgary',
  provinceOrState: 'AB',
  country: 'CA',
  businessType: 'auto_dealership',
  source: 'public_registry',
  sourceUrl: 'https://registry.example/lakeshore-motors',
  sourceRisk: 'low',
  contactRole: 'Owner',
  contactName: 'Jane Doe',
  contactEmail: 'jane@lakeshore-motors.example',
  contactPhone: '555-0123',
  contactBasis: 'conspicuously_published_business_contact',
  consentStatus: 'implied_possible',
  unsubscribeStatus: 'subscribed',
  doNotContact: false,
};

function makePacket(overrides = {}): Promise<GtmRunPacket> {
  let counter = 0;
  return assembleGtmRunPacket({
    lead: FIXTURE_LEAD,
    portOverrides: overrides,
    now: () => FIXED_NOW,
    newId: () => `${FIXED_ID.slice(0, -1)}${counter++}`,
  });
}

/** Build a trace over a completed packet with a real dry-run plan + CRM record. */
async function happyTrace(): Promise<GtmProofTrace> {
  const packet = await makePacket();
  const dryRunActions = (['email', 'sms', 'crm_writeback'] as const).map((channel) =>
    planDryRunAction(channel, {
      workspaceId: packet.workspace.workspaceId,
      prospectId: packet.prospect.id,
    }),
  );
  const crm = createMockCrmLite();
  const company = crm.upsertCompany({
    workspaceId: packet.workspace.workspaceId,
    companyName: packet.prospect.companyName,
  });
  crm.upsertOpportunity({
    workspaceId: packet.workspace.workspaceId,
    prospectId: packet.prospect.id,
    companyId: company.id,
    stage: 'appointment_set',
    appointmentRef: 'appt-1',
  });
  const crmRecords = crm
    .listOpportunities(packet.workspace.workspaceId)
    .filter((r) => r.prospectId === packet.prospect.id);
  return buildProofTrace({ packet, dryRunActions, crmRecords });
}

describe('buildProofTrace — chain mapping', () => {
  it('maps the full ordered chain lead → compliance → approval → dry-run → CRM → TrustOps', async () => {
    const trace = await happyTrace();
    expect(trace.steps.map((s) => s.stage)).toEqual([
      'lead',
      'compliance',
      'approval',
      'dry_run_plan',
      'crm_lite',
      'trustops',
    ]);
  });

  it('marks every stage passed on a completed run, with the dry-run + CRM counts', async () => {
    const trace = await happyTrace();
    expect(trace.status).toBe('completed');
    expect(trace.steps.every((s) => s.status === 'passed')).toBe(true);
    expect(trace.dryRunActionCount).toBe(3);
    expect(trace.steps.find((s) => s.stage === 'dry_run_plan')?.detail).toMatch(/sent:false/);
    expect(trace.steps.find((s) => s.stage === 'crm_lite')?.detail).toMatch(/record/);
  });

  it('attaches the appointment + proposal proofs to the CRM stage', async () => {
    const trace = await happyTrace();
    const crmStep = trace.steps.find((s) => s.stage === 'crm_lite');
    expect(crmStep?.proofs.map((p) => p.kind)).toEqual([
      'gtm.discovery.booked.v1',
      'gtm.proposal.generated.v1',
    ]);
    expect(trace.proofEventCount).toBe(2);
    // Proof refs carry only PII-safe fields (no detailsPrivate projection).
    for (const p of crmStep?.proofs ?? []) {
      expect(p.evidenceTag).toBe('verified_fact');
      expect('detailsPrivate' in p).toBe(false);
    }
  });

  it('binds the per-lead trace to the canonical TrustOps run summary', async () => {
    const trace = await happyTrace();
    expect(trace.trustOpsSummary).toEqual(
      expect.objectContaining({ status: 'completed', compliance: 'pass', crm: 'ok' }),
    );
    expect(trace.steps.find((s) => s.stage === 'trustops')?.detail).toMatch(
      /Contributed to TrustOps/,
    );
  });
});

describe('buildProofTrace — blocked / rejected honesty', () => {
  it('compliance-blocked: compliance blocked, downstream not_reached, no proofs', async () => {
    const packet = await makePacket({
      compliance: { status: 'blocked', reason: 'do_not_contact' },
    });
    const trace = buildProofTrace({ packet });
    expect(trace.status).toBe('blocked');
    const byStage = Object.fromEntries(trace.steps.map((s) => [s.stage, s.status]));
    expect(byStage.compliance).toBe('blocked');
    expect(byStage.approval).toBe('not_reached');
    expect(byStage.dry_run_plan).toBe('not_reached');
    expect(byStage.crm_lite).toBe('not_reached');
    expect(trace.proofEventCount).toBe(0);
  });

  it('approval-rejected: approval blocked, no dry-run plan', async () => {
    const packet = await makePacket({
      approval: { status: 'rejected', reason: 'operator declined' },
    });
    const trace = buildProofTrace({ packet, dryRunActions: [] });
    const byStage = Object.fromEntries(trace.steps.map((s) => [s.stage, s.status]));
    expect(byStage.compliance).toBe('passed');
    expect(byStage.approval).toBe('blocked');
    expect(byStage.dry_run_plan).toBe('not_reached');
    expect(trace.dryRunActionCount).toBe(0);
  });
});

describe('packetToRunSummary — canonical packet → TrustOps mapping', () => {
  it('projects a real packet onto a non-PII run summary', async () => {
    const packet = await makePacket();
    const summary = packetToRunSummary(packet);
    expect(summary).toEqual({
      runId: `run-${packet.prospect.id}`,
      tenant: 'budget_wheels_demo',
      status: 'completed',
      compliance: 'pass',
      approval: 'approved',
      appointment: 'requested',
      crm: 'ok',
      proofEventsRecorded: 2,
      blockedReason: undefined,
    });
    expect(JSON.stringify(summary)).not.toMatch(/@/);
  });
});

describe('no raw PII in proof/report outputs', () => {
  it('the serialized trace contains no email/phone PII even with PII on the lead input', async () => {
    const trace = await happyTrace();
    const serialized = JSON.stringify(trace);
    expect(serialized).not.toMatch(/@/);
    expect(serialized).not.toMatch(/Jane/);
    expect(serialized).not.toMatch(/jane/);
    // No 7+ digit phone runs other than the reserved 555-01xx test range.
    const phones = serialized.match(/\b\d{3}[\s.-]?\d{4}\b/g) ?? [];
    for (const phone of phones) expect(phone).toMatch(/555[\s.-]?01\d{2}/);
  });

  it('the TrustOps report over real packets contains no raw PII', async () => {
    const packets = await Promise.all([
      makePacket(),
      makePacket({ compliance: { status: 'blocked', reason: 'do_not_contact' } }),
      makePacket({ approval: { status: 'rejected', reason: 'operator declined' } }),
    ]);
    const report = buildTrustOpsReport(packets.map(packetToRunSummary));
    expect(report.markdown).not.toMatch(/@/);
    expect(report.markdown).not.toMatch(/Jane/i);
    expect(report.markdown).toContain('MOCK / SANDBOX');
  });

  it('assertTraceNoRawPii throws if a raw email is injected onto a step', async () => {
    const trace = await happyTrace();
    expect(() => assertTraceNoRawPii(trace)).not.toThrow();
    const poisoned: GtmProofTrace = {
      ...trace,
      steps: trace.steps.map((s) =>
        s.stage === 'lead' ? { ...s, detail: 'leaked owner@dealership.com' } : s,
      ),
    };
    expect(() => assertTraceNoRawPii(poisoned)).toThrow(/raw PII/);
  });
});

describe('mock-safety: no network/vendor imports in the proof-trace source', () => {
  it('production source imports no network/DB/vendor primitives', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const banned =
      /\b(fetch|child_process|node:net|node:http|node:https|node:tls|axios|ApifyClient|new\s+Anthropic|Twilio)\b/;
    for (const file of readdirSync(here).filter(
      (f) => f.endsWith('.ts') && !f.endsWith('.test.ts'),
    )) {
      const src = readFileSync(join(here, file), 'utf8');
      expect(banned.test(src), `${file} must make no network/vendor calls`).toBe(false);
      expect(src.includes('@cognitia/db')).toBe(false);
      expect(src.includes('@cognitia/integrations')).toBe(false);
    }
  });
});
