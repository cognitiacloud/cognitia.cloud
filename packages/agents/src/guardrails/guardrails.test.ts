import { describe, it, expect } from 'vitest';
import { runGuardrails, BLOCKING_GUARDRAILS } from './index.js';
import type { MessageCandidate } from '../mira/messageGenerator.js';

function candidate(overrides: Partial<MessageCandidate> = {}): MessageCandidate {
  return {
    subject_line: 'A quick idea',
    body: 'I noticed that Acme operates in SaaS.\nReply STOP to opt out.',
    evidence_refs: ['ev-1'],
    risk_level: 'high',
    ...overrides,
  };
}

describe('guardrails', () => {
  it('passes a grounded, compliant message', () => {
    const results = runGuardrails(candidate(), { isSuppressed: false, personalized: true });
    expect(results.every((r) => r.passed)).toBe(true);
  });

  it('blocks when target is suppressed', () => {
    const results = runGuardrails(candidate(), { isSuppressed: true, personalized: true });
    const suppression = results.find((r) => r.name === 'suppression')!;
    expect(suppression.passed).toBe(false);
    expect(BLOCKING_GUARDRAILS.has('suppression')).toBe(true);
  });

  it('blocks personalized message with no evidence refs', () => {
    const results = runGuardrails(candidate({ evidence_refs: [] }), {
      isSuppressed: false,
      personalized: true,
    });
    const evidence = results.find((r) => r.name === 'evidence')!;
    expect(evidence.passed).toBe(false);
  });

  it('flags spammy content', () => {
    const results = runGuardrails(
      candidate({ body: 'ACT NOW for 100% FREE money! Reply STOP to opt out.' }),
      { isSuppressed: false, personalized: true },
    );
    expect(results.find((r) => r.name === 'spamminess')!.passed).toBe(false);
  });

  it('fails compliance without an opt-out affordance', () => {
    const results = runGuardrails(candidate({ body: 'I noticed that Acme operates in SaaS.' }), {
      isSuppressed: false,
      personalized: true,
    });
    expect(results.find((r) => r.name === 'compliance')!.passed).toBe(false);
  });
});
