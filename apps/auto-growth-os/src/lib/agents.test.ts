import { describe, expect, it } from 'vitest';
import { AGENTS, getAgent, canAgentPerform } from './agents';

const EXPECTED_IDS = [
  'lead-intake',
  'inventory-listing',
  'sales-draft',
  'seo-geo',
  'social-reels',
  'proof-reporter',
  'compliance-guardrail',
  'demandara-gtm',
  'discovery-strategist',
];

describe('AGENTS roster', () => {
  it('contains the nine named agents', () => {
    expect(AGENTS).toHaveLength(9);
    expect(AGENTS.map((a) => a.id).sort()).toEqual([...EXPECTED_IDS].sort());
  });
  it('every agent forbids sending without approval and committing terms', () => {
    for (const a of AGENTS) {
      expect(a.forbiddenActions).toContain('send_without_approval');
      expect(a.forbiddenActions).toContain('commit_price');
      expect(a.forbiddenActions).toContain('commit_financing');
    }
  });
});

describe('canAgentPerform (deny-by-default)', () => {
  it('allows a listed action', () => {
    expect(canAgentPerform('sales-draft', 'draft_reply')).toBe(true);
  });
  it('denies an unlisted action', () => {
    expect(canAgentPerform('sales-draft', 'launch_rockets')).toBe(false);
  });
  it('denies forbidden actions even if otherwise shaped like allowed', () => {
    expect(canAgentPerform('sales-draft', 'commit_price')).toBe(false);
    for (const a of AGENTS) {
      expect(canAgentPerform(a.id, 'send_without_approval')).toBe(false);
    }
  });
  it('denies unknown agents', () => {
    expect(canAgentPerform('ghost-agent', 'draft_reply')).toBe(false);
  });
});

describe('getAgent', () => {
  it('resolves by id', () => {
    expect(getAgent('proof-reporter')?.name).toBe('Proof Reporter Agent');
  });
  it('returns undefined for unknown ids', () => {
    expect(getAgent('nope')).toBeUndefined();
  });
});
