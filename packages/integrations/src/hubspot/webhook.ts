import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * HubSpot webhook signature verification (v3).
 *
 * v3 signs `${method}${fullUri}${body}${timestamp}` with the app client secret
 * (HMAC-SHA256, base64). The request also carries a timestamp that must be recent
 * (default tolerance 5 minutes) to prevent replay. Comparison is timing-safe.
 *
 * Verify BEFORE trusting any webhook payload (see security-and-compliance.md).
 */
export interface VerifyHubspotSignatureInput {
  method: string;
  /** Full request URI including scheme + host + path + query, as HubSpot signs it. */
  uri: string;
  /** Raw request body (exact bytes/string received). */
  body: string;
  /** `X-HubSpot-Signature-V3` header. */
  signature: string;
  /** `X-HubSpot-Request-Timestamp` header (epoch millis as string/number). */
  timestamp: string | number;
  clientSecret: string;
  /** Max age of the request. Default 5 minutes. */
  toleranceMs?: number;
  /** Injectable clock for tests. */
  now?: () => number;
}

export function verifyHubspotSignatureV3(input: VerifyHubspotSignatureInput): boolean {
  const tolerance = input.toleranceMs ?? 5 * 60 * 1000;
  const now = (input.now ?? Date.now)();
  const ts = Number(input.timestamp);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > tolerance) {
    return false; // missing/expired timestamp -> reject (replay protection)
  }

  const base = `${input.method}${input.uri}${input.body}${input.timestamp}`;
  const expected = createHmac('sha256', input.clientSecret).update(base, 'utf8').digest('base64');

  return safeEqual(expected, input.signature);
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
