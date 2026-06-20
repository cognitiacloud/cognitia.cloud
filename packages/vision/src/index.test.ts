import { describe, it, expect } from 'vitest';
import { MockVisionBridge } from './index';

describe('MockVisionBridge', () => {
  it('flags PII when the screenshot name hints at secrets', async () => {
    const r = await new MockVisionBridge().auditScreenshot('/tmp/screenshot_secret.png');
    expect(r.hasPii).toBe(true);
    expect(r.privacyFlags).toContain('email_detected');
  });

  it('returns a clean audit otherwise', async () => {
    const r = await new MockVisionBridge().auditScreenshot('/tmp/home.png');
    expect(r.hasPii).toBe(false);
    expect(r.privacyFlags).toHaveLength(0);
  });
});
