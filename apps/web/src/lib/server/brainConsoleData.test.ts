import { describe, expect, it } from 'vitest';
import { loadBrainHarnessSnapshot } from './brainConsoleData';
import { toBrainConsoleView } from '../brainConsoleViewModel';

describe('loadBrainHarnessSnapshot (real #206 brain)', () => {
  it('builds a mock-safe snapshot from the real registry + router', async () => {
    const snapshot = await loadBrainHarnessSnapshot();
    expect(snapshot.mode).toBe('mock');
    expect(snapshot.workspace.workspaceId).toBe('budget_wheels_demo');
    // The real router serves the deterministic mock for a low-risk research task.
    expect(snapshot.selectedProvider.id).toBe('mock');
    expect(snapshot.selectedProvider.model).toBe('mock-deterministic-1');
    expect(snapshot.policy.decision).toBe('allow');
    expect(snapshot.noRealModelCalls.occurred).toBe(false);
  });

  it('lists every registered provider with real enabled/disabled state', async () => {
    const snapshot = await loadBrainHarnessSnapshot();
    // Exactly one enabled provider (the mock); all real (remote) providers disabled.
    const enabled = snapshot.providers.filter((p) => p.enabled);
    expect(enabled.map((p) => p.id)).toEqual(['mock']);
    expect(snapshot.providers.filter((p) => p.kind === 'remote').every((p) => !p.enabled)).toBe(
      true,
    );
  });

  it('records a real ledger hash (sha256), never raw prompt content', async () => {
    const snapshot = await loadBrainHarnessSnapshot();
    expect(snapshot.ledger.hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(JSON.stringify(snapshot)).not.toContain('Budget Wheels demo dealership pipeline');
  });

  it('feeds a mock-safe view-model end to end', async () => {
    const view = toBrainConsoleView(await loadBrainHarnessSnapshot());
    expect(view.mockSafe).toBe(true);
    expect(view.selectedProviderState.label).toBe('Enabled');
  });

  it('is deterministic across calls (fixed clock + deterministic mock)', async () => {
    const a = await loadBrainHarnessSnapshot();
    const b = await loadBrainHarnessSnapshot();
    expect(a).toEqual(b);
  });
});
