/**
 * Tests for the automation readiness panel transform.
 *
 * The panel is a PURE transform over the REAL `CommandCenterData` produced by
 * the server-only adapter (`server/gtmCommandCenterData.ts`). These tests load
 * the real adapter output and assert the readiness panel's safety-critical
 * invariants: live automation is disabled by construction, the only open mode
 * is dry_run, every dry-run preview row is BLOCKED/sent=false, the kill switch
 * is engaged, the controlled-live gate has its full set of unmet conditions,
 * and the proof ledger is append-only and workspace-attributed.
 */

import { describe, it, expect } from 'vitest';
import { loadCommandCenterData } from './server/gtmCommandCenterData.js';
import {
  buildAutomationReadiness,
  ROLLBACK_PLAN,
  type AutomationReadiness,
} from './gtmCommandCenterViewModel.js';

const data = await loadCommandCenterData();
const readiness: AutomationReadiness = buildAutomationReadiness(data);

describe('buildAutomationReadiness', () => {
  it('reports live automation disabled by construction', () => {
    expect(readiness.liveAutomationEnabled).toBe(false);
  });

  it('exposes dry_run as the active automation mode', () => {
    expect(readiness.automationMode).toBe('dry_run');
  });

  it('is a pure transform: identical output on repeat calls', () => {
    expect(buildAutomationReadiness(data)).toEqual(readiness);
  });

  it('surfaces all seven readiness signals', () => {
    expect(readiness.signals.map((s) => s.key)).toEqual([
      'automationMode',
      'approval',
      'consent',
      'killSwitch',
      'connector',
      'monitoring',
      'rollback',
    ]);
  });

  it('reports the kill switch as engaged', () => {
    const kill = readiness.signals.find((s) => s.key === 'killSwitch');
    expect(kill?.state).toContain('ENGAGED');
    expect(kill?.tone).toBe('success');
  });

  it('reports no live connectors approved', () => {
    const connector = readiness.signals.find((s) => s.key === 'connector');
    expect(connector?.state).toContain('NO live connectors');
    expect(connector?.tone).toBe('danger');
  });

  it('reports monitoring not enabled', () => {
    const monitoring = readiness.signals.find((s) => s.key === 'monitoring');
    expect(monitoring?.state).toContain('NOT enabled');
  });

  it('reports rollback not armed with a documented plan', () => {
    const rollback = readiness.signals.find((s) => s.key === 'rollback');
    expect(rollback?.state).toContain('NOT armed');
    expect(readiness.rollbackPlan).toEqual([...ROLLBACK_PLAN]);
    expect(readiness.rollbackPlan.length).toBeGreaterThan(0);
  });

  it('lists the unmet controlled-live conditions from the real gate', () => {
    const liveGate = data.releaseGates.find((g) => g.stage === 'controlled_live');
    expect(readiness.missingLiveConditions).toEqual(liveGate?.missing);
    expect(readiness.missingLiveConditions.length).toBeGreaterThan(0);
  });

  it('derives consent state from the real assembled leads', () => {
    const consent = readiness.signals.find((s) => s.key === 'consent');
    const total = data.leads.length;
    const counted = consent?.state
      .split(' · ')
      .reduce((sum, part) => sum + Number(part.split('×')[0]), 0);
    expect(counted).toBe(total);
  });

  it('every dry-run preview row is DRY-RUN, sent=false, BLOCKED', () => {
    for (const row of readiness.dryRunPreview) {
      expect(row.mode).toBe('dry_run');
      expect(row.sent).toBe(false);
      expect(row.liveStatus).toBe('BLOCKED');
    }
  });

  it('proof ledger is append-only and workspace-attributed over real proofs', () => {
    expect(readiness.proofLedger.appendOnly).toBe(true);
    expect(readiness.proofLedger.eventCount).toBe(data.proofTrace.length);
    expect(readiness.proofLedger.leadsCovered).toBe(
      new Set(data.proofTrace.map((p) => p.prospectId)).size,
    );
  });

  it('gate reasons cover every real release stage', () => {
    expect(readiness.gateReasons.map((g) => g.stage)).toEqual(
      data.releaseGates.map((g) => g.stage),
    );
  });
});
