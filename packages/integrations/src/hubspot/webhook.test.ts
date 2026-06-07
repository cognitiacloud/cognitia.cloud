import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyHubspotSignatureV3 } from './webhook.js';

const SECRET = 'client-secret';
const METHOD = 'POST';
const URI = 'https://app.cognitia.cloud/webhooks/hubspot';
const BODY = '{"objectId":123}';

function sign(timestamp: number, secret = SECRET, body = BODY): string {
  return createHmac('sha256', secret)
    .update(`${METHOD}${URI}${body}${timestamp}`, 'utf8')
    .digest('base64');
}

describe('verifyHubspotSignatureV3', () => {
  const now = () => 1_000_000_000_000;

  it('accepts a valid, recent signature', () => {
    const ts = now();
    expect(
      verifyHubspotSignatureV3({
        method: METHOD,
        uri: URI,
        body: BODY,
        timestamp: ts,
        signature: sign(ts),
        clientSecret: SECRET,
        now,
      }),
    ).toBe(true);
  });

  it('rejects a tampered body', () => {
    const ts = now();
    expect(
      verifyHubspotSignatureV3({
        method: METHOD,
        uri: URI,
        body: '{"objectId":999}',
        timestamp: ts,
        signature: sign(ts),
        clientSecret: SECRET,
        now,
      }),
    ).toBe(false);
  });

  it('rejects the wrong secret', () => {
    const ts = now();
    expect(
      verifyHubspotSignatureV3({
        method: METHOD,
        uri: URI,
        body: BODY,
        timestamp: ts,
        signature: sign(ts, 'other-secret'),
        clientSecret: SECRET,
        now,
      }),
    ).toBe(false);
  });

  it('rejects an expired timestamp (replay protection)', () => {
    const ts = now() - 10 * 60 * 1000; // 10 minutes old
    expect(
      verifyHubspotSignatureV3({
        method: METHOD,
        uri: URI,
        body: BODY,
        timestamp: ts,
        signature: sign(ts),
        clientSecret: SECRET,
        now,
      }),
    ).toBe(false);
  });
});
