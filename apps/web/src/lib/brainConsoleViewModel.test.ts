import { describe, expect, it } from 'vitest';
import {
  BRAIN_CONSOLE_BANNER,
  exampleBrainHarnessSnapshot,
  toBrainConsoleView,
  type BrainHarnessSnapshot,
} from './brainConsoleViewModel';

describe('toBrainConsoleView', () => {
  it('renders the persistent banner and selected provider label', () => {
    const view = toBrainConsoleView(exampleBrainHarnessSnapshot());
    expect(view.banner).toBe(BRAIN_CONSOLE_BANNER);
    expect(view.selectedProviderLabel).toBe('mock · mock-deterministic-1');
    expect(view.selectedProviderState.label).toBe('Enabled');
  });

  it('is mock-safe when mock-mode, no real calls, and every remote provider disabled', () => {
    const view = toBrainConsoleView(exampleBrainHarnessSnapshot());
    expect(view.mockSafe).toBe(true);
    expect(view.disabledRealProviders.sort()).toEqual(['anthropic', 'openai']);
  });

  it('flags NOT mock-safe if any remote provider is enabled', () => {
    const snap = exampleBrainHarnessSnapshot();
    const tampered: BrainHarnessSnapshot = {
      ...snap,
      providers: snap.providers.map((p) => (p.kind === 'remote' ? { ...p, enabled: true } : p)),
    };
    expect(toBrainConsoleView(tampered).mockSafe).toBe(false);
  });

  it('flags NOT mock-safe if a real model call is recorded', () => {
    const snap = exampleBrainHarnessSnapshot();
    const tampered: BrainHarnessSnapshot = {
      ...snap,
      noRealModelCalls: { occurred: true, statement: 'real call occurred' },
    };
    expect(toBrainConsoleView(tampered).mockSafe).toBe(false);
  });

  it('renders an allow policy badge and a no-fallback label', () => {
    const view = toBrainConsoleView(exampleBrainHarnessSnapshot());
    expect(view.policyBadge.label).toBe('Allow');
    expect(view.fallbackLabel).toMatch(/None/);
  });

  it('surfaces only ledger hashes, never raw prompt content', () => {
    const view = toBrainConsoleView(exampleBrainHarnessSnapshot());
    expect(view.ledgerHash.startsWith('sha256:')).toBe(true);
    expect(JSON.stringify(view)).not.toContain('@');
  });
});
