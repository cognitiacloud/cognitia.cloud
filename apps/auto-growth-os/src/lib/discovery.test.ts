import { describe, expect, it } from 'vitest';
import type { DiscoveryAnswers, DiscoveryScores } from '../types/portal';
import {
  scoreDiscovery,
  recommendDiscoveryPackage,
  generateDiscoveryOutput,
  DISCOVERY_SECTIONS,
} from './discovery';

const fixture: DiscoveryAnswers = {
  dealership: 'BudgetWheels',
  city: 'Toronto',
  businessType: 'dealership', // +10 complexity
  inventoryModel: 'owned', // +5 complexity
  inventoryWorkflow: 'spreadsheet', // +10 complexity
  leadRouting: 'single', // +5 complexity
  aiLevel: 'draft_only', // +5 automation
  adsLevel: 'single', // +5 automation
  websiteFeatures: ['basic'], // +5 content
  socialLevel: 'manual', // +5 content
  access: ['website', 'domain'], // 10 + 15 = 25 readiness
  urgency: 'this_quarter', // 15
};

describe('scoreDiscovery', () => {
  it('computes the exact documented scores', () => {
    const expected: DiscoveryScores = {
      infrastructureReadiness: 25,
      complexity: 30,
      automation: 10,
      contentBurden: 10,
      integrationBurden: 0,
      complianceRisk: 0,
      urgency: 15,
    };
    expect(scoreDiscovery(fixture)).toEqual(expected);
  });
});

describe('recommendDiscoveryPackage (numeric boundaries)', () => {
  const s = (over: Partial<DiscoveryScores>): DiscoveryScores => ({
    infrastructureReadiness: 0,
    complexity: 0,
    automation: 0,
    contentBurden: 0,
    integrationBurden: 0,
    complianceRisk: 0,
    urgency: 0,
    ...over,
  });

  it('maps all four tiers by complexity/automation', () => {
    expect(recommendDiscoveryPackage(s({ complexity: 20, automation: 10 }))).toBe(
      'Foundation Website',
    );
    expect(recommendDiscoveryPackage(s({ complexity: 45 }))).toBe('Growth Engine');
    expect(recommendDiscoveryPackage(s({ complexity: 70 }))).toBe('Full Auto Growth OS');
    expect(recommendDiscoveryPackage(s({ complexity: 90 }))).toBe('Enterprise / Marketplace');
    expect(recommendDiscoveryPackage(s({ complexity: 10, automation: 60 }))).toBe(
      'Full Auto Growth OS',
    );
    expect(recommendDiscoveryPackage(s({ complexity: 10, automation: 30 }))).toBe('Growth Engine');
  });

  it('routes marketplace inventory to Enterprise via answers', () => {
    const scores = scoreDiscovery({ ...fixture, inventoryModel: 'marketplace' });
    expect(recommendDiscoveryPackage(scores, { ...fixture, inventoryModel: 'marketplace' })).toBe(
      'Enterprise / Marketplace',
    );
  });
});

describe('generateDiscoveryOutput', () => {
  it('returns all sections including the confirmation prompt', () => {
    const out = generateDiscoveryOutput(fixture);
    expect(out.recommendedPackage).toBeTruthy();
    expect(out.proposedSystem.length).toBeGreaterThan(0);
    expect(out.roadmap.d30.length).toBeGreaterThan(0);
    expect(out.accessChecklist.length).toBeGreaterThan(0);
    expect(out.pricingRange.length).toBeGreaterThan(0);
    expect(out.clientResponsibilities.length).toBeGreaterThan(0);
    expect(out.cognitiaResponsibilities.length).toBeGreaterThan(0);
    expect(out.finalConfirmation).toBe('Before we build, please confirm: Is this what you meant?');
  });
});

describe('DISCOVERY_SECTIONS', () => {
  it('defines the twelve discovery sections', () => {
    expect(DISCOVERY_SECTIONS).toHaveLength(12);
  });
});
