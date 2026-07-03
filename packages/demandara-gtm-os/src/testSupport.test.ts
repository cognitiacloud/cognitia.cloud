import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { demandaraLeadSchema } from './types.js';
import type { Clock, DemandaraLead, IdFactory } from './types.js';

/**
 * Shared test support: deterministic clock/id factories and fixture loading.
 * Lives in a .test.ts file so it is never part of the package build surface.
 */

export function fixedClock(startIso = '2026-07-03T10:00:00.000Z'): Clock {
  let tick = 0;
  const start = new Date(startIso).getTime();
  return () => new Date(start + tick++ * 1000);
}

export function sequentialIds(prefix = 'id'): IdFactory {
  let n = 0;
  return () => `${prefix}-${String(++n).padStart(4, '0')}`;
}

interface BudgetWheelsFixture {
  fixtureLabel: string;
  dataPolicy: string;
  leads: Record<string, unknown>[];
}

const here = dirname(fileURLToPath(import.meta.url));

export function loadBudgetWheelsFixture(): BudgetWheelsFixture {
  const raw = readFileSync(join(here, '..', 'fixtures', 'budgetWheels.demo.json'), 'utf8');
  return JSON.parse(raw) as BudgetWheelsFixture;
}

export function fixtureLead(scenarioId: string): Record<string, unknown> {
  const lead = loadBudgetWheelsFixture().leads.find((l) => l['scenarioId'] === scenarioId);
  if (!lead) throw new Error(`fixture scenario not found: ${scenarioId}`);
  return { ...lead };
}

export function parsedFixtureLead(scenarioId: string): DemandaraLead {
  return demandaraLeadSchema.parse(fixtureLead(scenarioId));
}

describe('test support', () => {
  it('loads the Budget Wheels fixture and finds the happy-path scenario', () => {
    const fixture = loadBudgetWheelsFixture();
    expect(fixture.fixtureLabel).toBe('BUDGET_WHEELS_DEALEROS_DEMO_FIXTURE_V1');
    expect(fixture.leads.length).toBeGreaterThanOrEqual(4);
    expect(fixtureLead('bw_happy_path_mock_only')['leadId']).toBe('bw-fake-lead-0001');
  });

  it('deterministic clock and id factory produce stable sequences', () => {
    const clock = fixedClock();
    const ids = sequentialIds('t');
    expect(clock().toISOString()).toBe('2026-07-03T10:00:00.000Z');
    expect(clock().toISOString()).toBe('2026-07-03T10:00:01.000Z');
    expect(ids()).toBe('t-0001');
    expect(ids()).toBe('t-0002');
  });
});
