import { describe, expect, it } from 'vitest';
import {
  detectClaimTypes,
  riskForClaimTypes,
  requiresHumanApproval,
  scanSensitiveClaims,
  suggestSaferRewrite,
} from './guardrails';

describe('detectClaimTypes', () => {
  it('detects each sensitive claim type from representative phrases', () => {
    expect(detectClaimTypes('Can I get financing with bad credit?')).toContain('finance');
    expect(detectClaimTypes('What is my trade-in worth?')).toContain('trade_in');
    expect(detectClaimTypes('Is there an extended warranty?')).toContain('warranty');
    expect(detectClaimTypes('Has it been in an accident? Any CarFax?')).toContain(
      'accident_history',
    );
    expect(detectClaimTypes('Any discount or rebate this month?')).toContain('promotion');
    expect(detectClaimTypes('Please unsubscribe me — CASL.')).toContain('compliance');
    expect(detectClaimTypes('This is a scam and I am angry.')).toContain('complaint');
    expect(detectClaimTypes('How much does it cost?')).toContain('price');
    expect(detectClaimTypes('Is it still available?')).toContain('availability');
  });

  it('is case-insensitive', () => {
    expect(detectClaimTypes('FINANCING OPTIONS')).toContain('finance');
  });

  it('returns [] for clean text', () => {
    expect(detectClaimTypes('Hello, what time do you open?')).toEqual([]);
  });

  it('dedupes and keeps a stable order', () => {
    expect(detectClaimTypes('How much is financing for this?')).toEqual(['finance', 'price']);
  });
});

describe('riskForClaimTypes', () => {
  it('returns high for any high-risk type', () => {
    expect(riskForClaimTypes(['finance'])).toBe('high');
  });
  it('returns medium for medium-risk types only', () => {
    expect(riskForClaimTypes(['price'])).toBe('medium');
    expect(riskForClaimTypes(['availability'])).toBe('medium');
  });
  it('returns low for no claims', () => {
    expect(riskForClaimTypes([])).toBe('low');
  });
  it('takes the max (high wins over medium)', () => {
    expect(riskForClaimTypes(['price', 'finance'])).toBe('high');
  });
});

describe('requiresHumanApproval', () => {
  it('is true for any sensitive claim', () => {
    expect(requiresHumanApproval(['availability'])).toBe(true);
  });
  it('is false for no claims', () => {
    expect(requiresHumanApproval([])).toBe(false);
  });
});

describe('scanSensitiveClaims', () => {
  it('flags financing text and requires approval', () => {
    const scan = scanSensitiveClaims('Can I get approved for financing?');
    expect(scan.flagged).toBe(true);
    expect(scan.riskLevel).toBe('high');
    expect(scan.requiresApproval).toBe(true);
  });
  it('does not flag clean text', () => {
    const scan = scanSensitiveClaims('What are your opening hours?');
    expect(scan.flagged).toBe(false);
    expect(scan.requiresApproval).toBe(false);
    expect(scan.riskLevel).toBe('low');
  });
});

describe('suggestSaferRewrite', () => {
  it('appends a conservative clarification for flagged claims', () => {
    const original = 'Best price guaranteed and instant financing approval!';
    const types = detectClaimTypes(original);
    const safe = suggestSaferRewrite(original, types);
    expect(safe).not.toBe(original);
    expect(safe).toContain('confirmed by the dealership');
  });
  it('returns the trimmed original when nothing is flagged', () => {
    expect(suggestSaferRewrite('  hello  ', [])).toBe('hello');
  });
});
