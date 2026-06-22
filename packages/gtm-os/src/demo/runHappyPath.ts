/**
 * Mock-only end-to-end demo of the authorized v0 flow. Pure functions with no
 * side effects on import; executed (and printed) by `runHappyPath.test.ts`, which
 * is the idiomatic runnable entry point in this repo's vitest toolchain:
 *
 *   pnpm --filter @cognitia/gtm-os demo
 *
 * Nothing here leaves the process.
 */
import { createEngine } from '../engine/gtmRunEngine.js';
import { leadById } from '../fixtures/leads.js';
import { createDeterministicEnv } from '../ids.js';
import { renderRunTimeline, type ProofReport } from '../proof/proofReport.js';
import { getTenant } from '../tenants/registry.js';
import type { FixtureLead } from '../types.js';

function must<T>(value: T | null, label: string): T {
  if (value === null) throw new Error(`demo fixture missing: ${label}`);
  return value;
}

/** Run an approved happy path for a fixture lead and return its proof report. */
export function runApprovedDemo(leadId: string): ProofReport {
  const { engine } = createEngine(createDeterministicEnv());
  const lead: FixtureLead = must(leadById(leadId), leadId);
  const run = engine.start({ tenantId: lead.tenantId, lead });
  engine.runCompliance(run, lead, getTenant(lead.tenantId));
  // A named human operator approves before any consequential action.
  engine.submitApproval(run, must(run.approvalRequestId, 'approvalRequestId'), {
    outcome: 'approved',
    approver: 'operator:demo-human',
    note: 'looks good — book it',
  });
  return engine.executeApprovedActions(run, lead, { slotIso: '2026-02-01T17:00:00.000Z' });
}

/** Run a compliance-blocked path for a fixture lead and return its proof report. */
export function runBlockedDemo(leadId: string): ProofReport {
  const { engine } = createEngine(createDeterministicEnv());
  const lead: FixtureLead = must(leadById(leadId), leadId);
  const run = engine.start({ tenantId: lead.tenantId, lead });
  engine.runCompliance(run, lead, getTenant(lead.tenantId));
  return engine.report(run);
}

/** Render both demo paths as an operator-facing Markdown proof log. */
export function renderDemo(): string {
  return [
    '=== APPROVED HAPPY PATH (budget_wheels_demo / lead_bw_001) ===',
    '',
    renderRunTimeline(runApprovedDemo('lead_bw_001')),
    '',
    '=== BLOCKED PATH — consent missing (budget_wheels_demo / lead_bw_002) ===',
    '',
    renderRunTimeline(runBlockedDemo('lead_bw_002')),
  ].join('\n');
}
