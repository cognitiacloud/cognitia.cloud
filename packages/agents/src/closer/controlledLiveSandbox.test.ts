import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ReleaseConditions } from '../security/releaseGate.js';
import {
  assertSandboxSimulatedOnly,
  runControlledLiveSandbox,
  RealProviderBlockedError,
  SandboxInvariantError,
  SANDBOX_MODE,
  SANDBOX_PROVIDER,
  SANDBOX_STAGE,
  type ControlledLiveSandboxInput,
  type SandboxSimulationResult,
} from './controlledLiveSandbox.js';

/** Full set of `controlled_live` sandbox conditions, all attested true. */
const FULLY_AUTHORIZED_CONDITIONS: ReleaseConditions = {
  signedCustomerScope: true,
  counselSignoff: true,
  founderSignoff: true,
  monitoringEnabled: true,
  rollbackReady: true,
  secretsConfigured: true,
  connectorApproval: true,
};

const baseInput: ControlledLiveSandboxInput = {
  workspaceId: 'ws_budget_wheels_demo',
  prospectId: 'prospect_0001',
  channel: 'email',
  authorization: {
    role: 'admin',
    conditions: FULLY_AUTHORIZED_CONDITIONS,
  },
};

describe('runControlledLiveSandbox — authorized action produces simulated result only', () => {
  it('emits the required mode/sent/provider triple for a fully-authorized run', () => {
    const result = runControlledLiveSandbox(baseInput);
    expect(result.mode).toBe(SANDBOX_MODE);
    expect(result.mode).toBe('sandbox_simulated');
    expect(result.sent).toBe(false);
    expect(result.provider).toBe(SANDBOX_PROVIDER);
    expect(result.provider).toBe('none');
  });

  it('marks the run authorized when permission held and gate passed', () => {
    const result = runControlledLiveSandbox(baseInput);
    expect(result.authorized).toBe(true);
    expect(result.gate.passed).toBe(true);
    expect(result.stage).toBe(SANDBOX_STAGE);
    expect(result.stage).toBe('controlled_live');
  });

  it('embeds a never-sent dry-run plan, not a live send', () => {
    const result = runControlledLiveSandbox(baseInput);
    expect(result.plan.mode).toBe('dry_run');
    expect(result.plan.sent).toBe(false);
    expect(result.plan.wouldSendIfLive.liveStatus).toBe('BLOCKED');
  });

  it('still simulates (never sends) even when unauthorized', () => {
    const result = runControlledLiveSandbox({
      ...baseInput,
      authorization: { role: 'viewer', conditions: {} },
    });
    expect(result.authorized).toBe(false);
    expect(result.gate.passed).toBe(false);
    // The hard invariants still hold regardless of authorization.
    expect(result.mode).toBe('sandbox_simulated');
    expect(result.sent).toBe(false);
    expect(result.provider).toBe('none');
  });

  it('explicitly accepts provider:"none" as a simulation', () => {
    const result = runControlledLiveSandbox({ ...baseInput, provider: 'none' });
    expect(result.provider).toBe('none');
    expect(result.sent).toBe(false);
  });

  it('is pure/deterministic for identical inputs', () => {
    const a = runControlledLiveSandbox(baseInput);
    const b = runControlledLiveSandbox(baseInput);
    expect(a).toEqual(b);
  });

  it('builds a stable, deterministic simulation reference', () => {
    const result = runControlledLiveSandbox(baseInput);
    expect(result.simulationRef).toBe(
      'sandbox:controlled_live:email:ws_budget_wheels_demo:prospect_0001',
    );
  });

  it('passes the sandbox-only tripwire for a genuine result', () => {
    const result = runControlledLiveSandbox(baseInput);
    expect(() => assertSandboxSimulatedOnly(result)).not.toThrow();
  });
});

describe('runControlledLiveSandbox — real provider mode is blocked', () => {
  it('throws RealProviderBlockedError when a named real provider is requested', () => {
    for (const provider of ['twilio', 'sendgrid', 'hubspot', 'smtp', 'real']) {
      expect(() => runControlledLiveSandbox({ ...baseInput, provider })).toThrow(
        RealProviderBlockedError,
      );
    }
  });

  it('throws when useRealProvider is true — even with full authorization', () => {
    expect(() => runControlledLiveSandbox({ ...baseInput, useRealProvider: true })).toThrow(
      RealProviderBlockedError,
    );
  });

  it('produces NO result when a real provider is requested (fails closed)', () => {
    let result: SandboxSimulationResult | undefined;
    try {
      result = runControlledLiveSandbox({ ...baseInput, provider: 'twilio' });
    } catch {
      // expected
    }
    expect(result).toBeUndefined();
  });
});

describe('assertSandboxSimulatedOnly — tripwire against forged results', () => {
  it('throws if a result is forged to sent:true', () => {
    const forged = {
      mode: 'sandbox_simulated',
      sent: true,
      provider: 'none',
    } as unknown as Parameters<typeof assertSandboxSimulatedOnly>[0];
    expect(() => assertSandboxSimulatedOnly(forged)).toThrow(SandboxInvariantError);
  });

  it('throws if a result claims a non-sandbox mode', () => {
    const forged = {
      mode: 'live',
      sent: false,
      provider: 'none',
    } as unknown as Parameters<typeof assertSandboxSimulatedOnly>[0];
    expect(() => assertSandboxSimulatedOnly(forged)).toThrow(SandboxInvariantError);
  });

  it('throws if a result claims a real provider', () => {
    const forged = {
      mode: 'sandbox_simulated',
      sent: false,
      provider: 'twilio',
    } as unknown as Parameters<typeof assertSandboxSimulatedOnly>[0];
    expect(() => assertSandboxSimulatedOnly(forged)).toThrow(SandboxInvariantError);
  });
});

describe('source-level network/vendor scan', () => {
  const here = fileURLToPath(new URL('.', import.meta.url));
  const source = readFileSync(`${here}controlledLiveSandbox.ts`, 'utf8');

  // Identifiers that would indicate live IO or a vendor SDK leaked in.
  const forbidden = [
    'fetch(',
    'axios',
    'node:http',
    'node:https',
    'node:net',
    'node:tls',
    'node:dgram',
    'child_process',
    'twilio',
    'sendgrid',
    'hubspot',
    'apify',
    'nodemailer',
    'XMLHttpRequest',
    'WebSocket',
    'https://',
    'http://',
  ];

  it('contains no network or vendor identifiers', () => {
    for (const token of forbidden) {
      expect(source.includes(token)).toBe(false);
    }
  });
});
