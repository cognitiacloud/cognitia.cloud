import { describe, expect, it } from 'vitest';
import type { DiscoveryAnswers, DiscoveryPackage } from '../types';
import {
  discoverySessionFromAnswers,
  gtmProspectFromDiscovery,
  proposalFromDiscovery,
  proposalMarkdown,
} from './proposals';
import { generateDiscoveryOutput } from './discovery';

const foundation: DiscoveryAnswers = {
  dealership: 'BudgetWheels',
  city: 'Toronto',
  businessType: 'dealership',
  inventoryModel: 'owned',
  inventoryWorkflow: 'manual',
  leadRouting: 'single',
  aiLevel: 'none',
  adsLevel: 'none',
};
const growth: DiscoveryAnswers = { ...foundation, socialLevel: 'manual' };
const fullAuto: DiscoveryAnswers = {
  ...foundation,
  businessType: 'finance_focused',
  inventoryModel: 'partner',
  inventoryWorkflow: 'spreadsheet',
  leadRouting: 'ai_first',
};
const enterprise: DiscoveryAnswers = { ...foundation, inventoryModel: 'marketplace' };

const cases: [string, DiscoveryAnswers, DiscoveryPackage][] = [
  ['Foundation Website', foundation, 'Foundation Website'],
  ['Growth Engine', growth, 'Growth Engine'],
  ['Full Auto Growth OS', fullAuto, 'Full Auto Growth OS'],
  ['Enterprise / Marketplace', enterprise, 'Enterprise / Marketplace'],
];

describe('proposalFromDiscovery', () => {
  it.each(cases)(
    'maps the %s package and renders non-empty markdown',
    (_label, answers, expected) => {
      const proposal = proposalFromDiscovery(answers, 'S1', 'P1', '2026-06-20T12:00:00Z');
      expect(proposal.id).toBe('P1');
      expect(proposal.sessionId).toBe('S1');
      expect(proposal.dealership).toBe('BudgetWheels');
      expect(proposal.recommendedPackage).toBe(expected);
      expect(proposal.markdown.length).toBeGreaterThan(0);
      expect(proposal.markdown).toContain(expected);
    },
  );

  it('falls back to a placeholder dealership name when none is given', () => {
    const { dealership } = foundation;
    void dealership;
    const proposal = proposalFromDiscovery({ ...foundation, dealership: '' }, 'S1', 'P1', 'n');
    expect(proposal.dealership).toBe('Unnamed dealership');
  });
});

describe('discoverySessionFromAnswers', () => {
  it('captures scores + recommendation for the session', () => {
    const session = discoverySessionFromAnswers(fullAuto, 'S1', '2026-06-20T12:00:00Z');
    expect(session.id).toBe('S1');
    expect(session.recommendedPackage).toBe('Full Auto Growth OS');
    expect(session.scores.complexity).toBeGreaterThan(0);
  });
});

describe('gtmProspectFromDiscovery', () => {
  it('creates a qualified prospect with a bounded signal score', () => {
    const prospect = gtmProspectFromDiscovery(fullAuto, 'GP1', '2026-06-20T12:00:00Z');
    expect(prospect.id).toBe('GP1');
    expect(prospect.stage).toBe('qualified');
    expect(prospect.dealership).toBe('BudgetWheels');
    expect(prospect.city).toBe('Toronto');
    expect(prospect.recommendedPackage).toBe('Full Auto Growth OS');
    expect(prospect.signalScore).toBeGreaterThanOrEqual(1);
    expect(prospect.signalScore).toBeLessThanOrEqual(100);
  });
});

describe('proposalMarkdown', () => {
  it('includes the recommended package and roadmap sections', () => {
    const md = proposalMarkdown(generateDiscoveryOutput(growth));
    expect(md).toContain('# Auto Growth OS Proposal');
    expect(md).toContain('Recommended package:');
    expect(md).toContain('## 30/60/90 roadmap');
  });
});
