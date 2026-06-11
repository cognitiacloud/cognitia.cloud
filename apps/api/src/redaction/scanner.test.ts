import { describe, expect, it } from 'vitest';
import { scanTextForPii, describeFindings } from './scanner.js';

/**
 * COG-003 redaction scanner. Patterns are ported from the Hermes vision skill
 * (`_scan_text_for_pii`) — the same fixtures must fail/pass on both sides.
 */

describe('scanTextForPii', () => {
  it('clean business text is publish-safe', () => {
    const out = scanTextForPii('Lead rescued in 42 seconds; booking confirmed for June 14.');
    expect(out.publish_safe).toBe(true);
    expect(describeFindings(out)).toEqual([]);
  });

  it('empty / absent text is publish-safe', () => {
    expect(scanTextForPii('').publish_safe).toBe(true);
    expect(scanTextForPii(null).publish_safe).toBe(true);
    expect(scanTextForPii(undefined).publish_safe).toBe(true);
  });

  it('detects emails', () => {
    const out = scanTextForPii('contact jane.doe@example.com for details');
    expect(out.emails_detected).toEqual(['jane.doe@example.com']);
    expect(out.publish_safe).toBe(false);
  });

  it('detects phone numbers in common formats', () => {
    for (const phone of ['604-555-0123', '(604) 555 0123', '+1 604.555.0123']) {
      const out = scanTextForPii(`call ${phone} today`);
      expect(out.phone_numbers_detected.length, phone).toBeGreaterThan(0);
      expect(out.publish_safe, phone).toBe(false);
    }
  });

  it('detects API keys and tokens by provider label', () => {
    const out = scanTextForPii('key sk-TESTONLYabcdefghijklmnopqrst and ghp_' + 'a'.repeat(30));
    expect(out.api_keys_or_tokens_detected).toContain('openai-key');
    expect(out.api_keys_or_tokens_detected).toContain('github-token');
    expect(out.publish_safe).toBe(false);
  });

  it('detects filesystem paths and financial digit runs', () => {
    const out = scanTextForPii('/home/jane/notes.md card 4242 4242 4242 4242');
    expect(out.file_paths_detected.length).toBeGreaterThan(0);
    expect(out.financial_data_detected).toBe(true);
    expect(out.publish_safe).toBe(false);
  });

  it('findings are audit-safe: labels and counts, never the matched PII', () => {
    const out = scanTextForPii('jane.doe@example.com 604-555-0123');
    const findings = describeFindings(out);
    expect(findings).toContain('emails:1');
    expect(findings.join(' ')).not.toContain('jane.doe');
    expect(findings.join(' ')).not.toContain('604');
  });
});
