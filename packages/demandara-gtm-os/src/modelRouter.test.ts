import { describe, expect, it } from 'vitest';
import { ActionLedger } from './actionLedger.js';
import { looksLikeSecret, ModelRouterHarness } from './modelRouter.js';
import { fixedClock, sequentialIds } from './testSupport.test.js';

function setup(replay = true) {
  const clock = fixedClock();
  const ledger = new ActionLedger({ clock, idFactory: sequentialIds('led') });
  const router = new ModelRouterHarness({
    clock,
    idFactory: sequentialIds('route'),
    replayFixtures: replay
      ? [
          {
            fixtureId: 'replay-qualify-001',
            output: { summary: 'replayed fixture output', humanApproved: true },
            recordedAt: '2026-07-01T00:00:00.000Z',
            sourceLabel: 'local_replay_fixture',
          },
        ]
      : [],
  });
  return { ledger, router };
}

describe('model-router brain harness (fail closed)', () => {
  it('blocks live provider routes by default — no live path exists', () => {
    const { ledger, router } = setup();
    const result = router.route(
      { taskKind: 'qualify', providerMode: 'live_approved', input: 'fixture text' },
      ledger,
    );
    expect(result.status).toBe('blocked');
    if (result.status === 'blocked') {
      expect(result.reason.code).toBe('LIVE_PROVIDER_NOT_AUTHORIZED');
    }
    expect(ledger.eventsOfType('model_route_blocked')).toHaveLength(1);
  });

  it('blocks disabled provider routes', () => {
    const { ledger, router } = setup();
    const result = router.route(
      { taskKind: 'qualify', providerMode: 'disabled', input: 'fixture text' },
      ledger,
    );
    expect(result.status).toBe('blocked');
    if (result.status === 'blocked') expect(result.reason.code).toBe('PROVIDER_DISABLED');
  });

  it('fails closed when the replay fixture is missing', () => {
    const { ledger, router } = setup(false);
    const result = router.route(
      {
        taskKind: 'qualify',
        providerMode: 'replay',
        input: 'fixture text',
        replayFixtureId: 'replay-qualify-001',
      },
      ledger,
    );
    expect(result.status).toBe('blocked');
    if (result.status === 'blocked') expect(result.reason.code).toBe('REPLAY_FIXTURE_MISSING');
  });

  it('replay returns deterministic fixture output and logs the decision', () => {
    const { ledger, router } = setup();
    const request = {
      taskKind: 'qualify',
      providerMode: 'replay' as const,
      input: 'fixture text',
      replayFixtureId: 'replay-qualify-001',
    };
    const first = router.route(request, ledger);
    const second = router.route(request, ledger);
    expect(first.status).toBe('completed');
    if (first.status === 'completed' && second.status === 'completed') {
      expect(first.output.data).toEqual(second.output.data);
      expect(first.output.sourceLabel).toBe('local_replay_fixture');
      expect(first.output.riskLabel).toBe('mock_or_replay_no_live_provider');
    }
    expect(ledger.eventsOfType('model_route_decided')).toHaveLength(2);
  });

  it('mock mode produces deterministic local output with an input digest', () => {
    const { ledger, router } = setup();
    const result = router.route(
      { taskKind: 'next_step_copy', providerMode: 'mock', input: 'segment=dealer' },
      ledger,
    );
    expect(result.status).toBe('completed');
    if (result.status === 'completed') {
      expect(result.output.data['mock']).toBe(true);
      expect(result.output.data['summary']).toBe('mock output for next_step_copy');
    }
  });

  it('rejects secret-looking inputs before routing', () => {
    const { ledger, router } = setup();
    const samples = [
      'api_key=abcdef123456',
      'Authorization: Bearer abcdefghij.klmnopqrst',
      '-----BEGIN RSA PRIVATE KEY-----',
      'my key is sk-abcdefgh12345678',
      'AKIAABCDEFGHIJKLMNOP',
    ];
    for (const input of samples) {
      expect(looksLikeSecret(input)).toBe(true);
      const result = router.route({ taskKind: 'qualify', providerMode: 'mock', input }, ledger);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.reason.code).toBe('SECRET_LIKE_INPUT_REJECTED');
      }
    }
    expect(looksLikeSecret('vertical=budget_wheels; segment=used_car_buyer')).toBe(false);
  });
});
