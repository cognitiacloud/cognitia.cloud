import { describe, it, expect } from 'vitest';
import {
  BRAIN_CONSOLE_BANNER,
  demoBrainHarnessSnapshot,
  toBrainConsoleView,
  type BrainHarnessSnapshot,
} from './brainConsoleViewModel.js';

/**
 * A mock-safe harness snapshot fixture. Mirrors {@link demoBrainHarnessSnapshot}
 * but is overridable per-test. PII-safe by construction: no email/raw prompt —
 * content is referenced by hash only.
 */
function snapshot(over: Partial<BrainHarnessSnapshot> = {}): BrainHarnessSnapshot {
  return { ...demoBrainHarnessSnapshot(), ...over };
}

describe('brain console view-model', () => {
  it('maps the demo snapshot to a mock-safe console view', () => {
    const view = toBrainConsoleView(snapshot());
    expect(view.banner).toBe(BRAIN_CONSOLE_BANNER);
    expect(view.workspaceId).toBe('budget_wheels_demo');
    expect(view.sandbox).toBe(true);
    expect(view.taskLabel).toBe('Draft follow-up message');
    expect(view.selectedProviderLabel).toBe('local-stub · deterministic-mock');
    expect(view.selectedProviderState).toEqual({ label: 'Enabled', tone: 'success' });
    expect(view.mockSafe).toBe(true);
  });

  it('always exposes the persistent banner with all four guarantees', () => {
    const view = toBrainConsoleView(snapshot());
    expect(view.banner).toContain('MOCK ONLY');
    expect(view.banner).toContain('NO REAL MODEL CALLS');
    expect(view.banner).toContain('NO LIVE OUTREACH');
    expect(view.banner).toContain('NO RAW PII');
  });

  it('lists every real (remote) provider as disabled', () => {
    const view = toBrainConsoleView(snapshot());
    expect(view.disabledRealProviders).toEqual(['anthropic', 'openai']);
    const remotes = view.providers.filter((p) => p.kind === 'remote');
    expect(remotes.length).toBeGreaterThan(0);
    expect(remotes.every((p) => !p.enabled)).toBe(true);
    expect(remotes.every((p) => p.stateLabel === 'Disabled')).toBe(true);
  });

  it('marks the selected provider and only the selected one', () => {
    const view = toBrainConsoleView(snapshot());
    const selected = view.providers.filter((p) => p.selected);
    expect(selected).toHaveLength(1);
    expect(selected[0]?.id).toBe('local-stub');
  });

  it('surfaces the policy decision as a warning when approval is required', () => {
    const view = toBrainConsoleView(snapshot());
    expect(view.policyBadge).toEqual({ label: 'Requires approval', tone: 'warning' });
    expect(view.policyReason).toMatch(/approval/i);
  });

  it('maps allow / deny policy decisions to the right tone', () => {
    const allow = toBrainConsoleView(
      snapshot({
        policy: { decision: 'allow', riskLevel: 'low', blocked: false, reason: 'ok' },
      }),
    );
    expect(allow.policyBadge.tone).toBe('success');

    const deny = toBrainConsoleView(
      snapshot({
        policy: { decision: 'deny', riskLevel: 'high', blocked: true, reason: 'suppressed' },
      }),
    );
    expect(deny.policyBadge).toEqual({ label: 'Deny', tone: 'danger' });
  });

  it('reports no fallback when the primary provider is selected', () => {
    const view = toBrainConsoleView(snapshot());
    expect(view.fallbackLabel).toBe('None — primary provider selected');
  });

  it('describes a fallback that was used', () => {
    const view = toBrainConsoleView(
      snapshot({
        fallback: { used: true, from: 'anthropic', to: 'local-stub', reason: 'provider disabled' },
      }),
    );
    expect(view.fallbackLabel).toBe('anthropic → local-stub (provider disabled)');
  });

  it('exposes the ledger hash and proofRef (hashes only, no raw content)', () => {
    const view = toBrainConsoleView(snapshot());
    expect(view.ledgerHash).toMatch(/^sha256:/);
    expect(view.proofRef).toMatch(/^proof:/);
  });

  it('reports local-only readiness', () => {
    const view = toBrainConsoleView(snapshot());
    expect(view.localOnlyReady).toBe(true);
    expect(view.localOnlyStatement).toMatch(/no network egress/i);
  });

  it('flags an enabled remote provider as a danger tone (real-call risk)', () => {
    const view = toBrainConsoleView(
      snapshot({
        providers: [
          {
            id: 'anthropic',
            model: 'claude',
            kind: 'remote',
            enabled: true,
            reason: 'tampered',
          },
        ],
      }),
    );
    const row = view.providers.find((p) => p.id === 'anthropic');
    expect(row?.tone).toBe('danger');
  });

  it('reports mockSafe=false if any real model call is recorded', () => {
    const view = toBrainConsoleView(
      snapshot({
        noRealModelCalls: { occurred: true, statement: 'tampered' },
      }),
    );
    expect(view.mockSafe).toBe(false);
  });

  it('reports mockSafe=false if any real provider is left enabled', () => {
    const view = toBrainConsoleView(
      snapshot({
        providers: [
          {
            id: 'local-stub',
            model: 'deterministic-mock',
            kind: 'local',
            enabled: true,
            reason: 'ok',
          },
          { id: 'openai', model: 'gpt', kind: 'remote', enabled: true, reason: 'tampered' },
        ],
      }),
    );
    expect(view.mockSafe).toBe(false);
  });

  it('emits no raw PII (no email) in the rendered view', () => {
    const view = toBrainConsoleView(snapshot());
    expect(JSON.stringify(view)).not.toMatch(/@/);
  });
});
