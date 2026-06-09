#!/usr/bin/env node
/**
 * Issue an operator session token (operator-handoff step 7).
 *
 * Mirrors the token format in apps/api/src/auth.ts (HmacSessionVerifier):
 * base64url(JSON{tid,uid,role,exp}) + '.' + base64url(HMAC-SHA256(payload)).
 *
 * Usage:
 *   SESSION_SECRET=... node apps/api/scripts/issue-session.mjs \
 *     --tenant <tenant-uuid> [--user user:ops] [--role operator] [--ttl-hours 12]
 *
 * The token is printed to stdout (and nothing else) so it can be piped/copied.
 */
import { createHmac } from 'node:crypto';

const args = process.argv.slice(2);
const get = (flag, dflt) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};

const secret = process.env.SESSION_SECRET;
if (!secret) {
  console.error('SESSION_SECRET env var is required');
  process.exit(1);
}
const tenant = get('--tenant');
if (!tenant) {
  console.error('--tenant <tenant-uuid> is required');
  process.exit(1);
}
const role = get('--role', 'operator');
if (!['owner', 'operator', 'viewer'].includes(role)) {
  console.error('--role must be owner|operator|viewer');
  process.exit(1);
}
const user = get('--user', 'user:ops');
const ttlHours = Number(get('--ttl-hours', '12'));

const claims = { tid: tenant, uid: user, role, exp: Date.now() + ttlHours * 3600_000 };
const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
const sig = createHmac('sha256', secret).update(payload).digest('base64url');
// stdout only — do not add logging around the token.
process.stdout.write(`${payload}.${sig}\n`);
