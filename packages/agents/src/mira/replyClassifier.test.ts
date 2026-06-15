import { describe, it, expect } from 'vitest';
import { classifyReply, replyOutcome } from './replyClassifier.js';

describe('reply classifier', () => {
  it('detects unsubscribe and triggers suppression', () => {
    for (const text of ['Please unsubscribe me', 'STOP', 'remove me from your list']) {
      expect(classifyReply(text)).toBe('unsubscribe');
    }
    expect(replyOutcome('unsubscribe')).toEqual({
      suppress: true,
      haltSequence: true,
      retarget: false,
    });
  });

  it('detects wrong-person and triggers retarget', () => {
    expect(classifyReply("I'm the wrong person for this")).toBe('wrong_person');
    expect(classifyReply('I no longer work at Acme')).toBe('wrong_person');
    expect(replyOutcome('wrong_person')).toEqual({
      suppress: false,
      haltSequence: true,
      retarget: true,
    });
  });

  it('detects interested / not_interested / out_of_office / referral', () => {
    expect(classifyReply("Sounds good, let's chat")).toBe('interested');
    expect(classifyReply("We're all set, not interested")).toBe('not_interested');
    expect(classifyReply('I am out of office until Monday')).toBe('out_of_office');
    expect(classifyReply('You should reach out to my colleague')).toBe('referral');
  });

  it('falls back to other', () => {
    expect(classifyReply('hmm')).toBe('other');
  });
});
