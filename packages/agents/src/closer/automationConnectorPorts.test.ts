import { describe, expect, it } from 'vitest';
import {
  CONNECTOR_CHANNELS,
  ConnectorLiveExecutionBlockedError,
  createDisabledConnectorPorts,
  type AutomationConnectorPorts,
  type ConnectorChannel,
} from './automationConnectorPorts.js';

const NON_LIVE_PROVIDERS = ['none', 'sandbox_simulated'] as const;

function eachPort(ports: AutomationConnectorPorts) {
  return CONNECTOR_CHANNELS.map((channel) => [channel, ports[channel]] as const);
}

describe('createDisabledConnectorPorts', () => {
  it('exposes a port for every modelled channel', () => {
    const ports = createDisabledConnectorPorts();
    const expected: ConnectorChannel[] = [
      'email',
      'sms',
      'whatsapp',
      'calls',
      'ads',
      'crm',
      'calendar',
    ];
    expect([...CONNECTOR_CHANNELS]).toEqual(expected);
    for (const [channel, port] of eachPort(ports)) {
      expect(port.channel).toBe(channel);
    }
  });

  it('defaults to the safest non-live provider with live disabled', () => {
    const ports = createDisabledConnectorPorts();
    for (const [, port] of eachPort(ports)) {
      expect(port.provider).toBe('none');
      expect(port.liveEnabled).toBe(false);
    }
  });

  it('only ever reports a non-live provider', () => {
    const ports = createDisabledConnectorPorts({ provider: 'sandbox_simulated' });
    for (const [, port] of eachPort(ports)) {
      expect(NON_LIVE_PROVIDERS).toContain(port.provider);
      expect(port.provider).not.toBe('controlled-live');
    }
  });

  it('allows dry-run preview without sending', async () => {
    const ports = createDisabledConnectorPorts({ provider: 'sandbox_simulated' });
    for (const [channel, port] of eachPort(ports)) {
      const result = await port.preview({
        channel,
        targetRef: 'prospect-123',
        summary: 'intro message',
      });
      expect(result.sent).toBe(false);
      expect(result.dryRun).toBe(true);
      expect(result.channel).toBe(channel);
      expect(result.provider).toBe('sandbox_simulated');
      expect(result.preview).toContain(channel);
      // Preview must not leak a raw vendor name; only the simulated provider appears.
      expect(result.preview).toContain('sandbox_simulated');
    }
  });

  it('blocks live execution by default (fail-closed, never sends)', async () => {
    const ports = createDisabledConnectorPorts();
    for (const [channel, port] of eachPort(ports)) {
      const result = await port.execute({
        channel,
        targetRef: 'prospect-123',
        summary: 'intro message',
      });
      expect(result.status).toBe('blocked');
      expect(result.sent).toBe(false);
      expect(result.reason).toBeTruthy();
    }
  });

  it('still blocks live execution even when a controlled-live authorization is supplied', async () => {
    const ports = createDisabledConnectorPorts({ provider: 'sandbox_simulated' });
    const result = await ports.email.execute({
      channel: 'email',
      targetRef: 'prospect-123',
      summary: 'intro message',
      authorization: { mode: 'controlled-live', approvalRef: 'approval-xyz' },
    });
    expect(result.status).toBe('blocked');
    expect(result.sent).toBe(false);
  });

  it('throws on live execution when configured to throw', async () => {
    const ports = createDisabledConnectorPorts({ liveBehavior: 'throw' });
    for (const [channel, port] of eachPort(ports)) {
      await expect(
        port.execute({ channel, targetRef: 'prospect-123', summary: 'intro message' }),
      ).rejects.toBeInstanceOf(ConnectorLiveExecutionBlockedError);
    }
  });

  it('preview remains allowed even in throw mode', async () => {
    const ports = createDisabledConnectorPorts({ liveBehavior: 'throw' });
    const result = await ports.sms.preview({
      channel: 'sms',
      targetRef: 'prospect-123',
      summary: 'reminder',
    });
    expect(result.sent).toBe(false);
    expect(result.dryRun).toBe(true);
  });
});
