#!/usr/bin/env node
// Startup gate for production deploys. The API degrades silently when core env
// is missing (in-memory repository, fake CRM client, ephemeral PII key) — a
// deploy can look healthy while persisting nothing. This script makes those
// absences fatal before the server starts. Run it as the container entrypoint:
//   node scripts/assert-prod-env.mjs && node --experimental-strip-types src/server.ts
//
// Scope: hard-required vars fail the boot; recommended vars print a warning so
// a deliberately-degraded staging boot is still possible with REQUIRE_ENV=off.

const off = process.env.REQUIRE_ENV === 'off';

const required = [
  ['DATABASE_URL', 'without it the API silently falls back to the in-memory repository'],
  ['SESSION_SECRET', 'without it every operator route returns 401'],
];

const recommended = [
  ['CREDENTIAL_SECRET_KEY_BASE64', 'without it CRM writes use the fake HubSpot client'],
  ['COGNITIA_PII_KEY_BASE64', 'without it lead PII is encrypted with an ephemeral per-process key'],
  ['HUBSPOT_WEBHOOK_SECRET', 'without it the HubSpot webhook returns 503'],
];

let failed = false;
for (const [name, why] of required) {
  if (!process.env[name]) {
    console.error(`[assert-prod-env] MISSING ${name} — ${why}`);
    failed = true;
  }
}
for (const [name, why] of recommended) {
  if (!process.env[name]) {
    console.warn(`[assert-prod-env] warning: ${name} unset — ${why}`);
  }
}

for (const name of ['CREDENTIAL_SECRET_KEY_BASE64', 'COGNITIA_PII_KEY_BASE64']) {
  const value = process.env[name];
  if (value && Buffer.from(value, 'base64').length !== 32) {
    console.error(`[assert-prod-env] INVALID ${name} — must decode to exactly 32 bytes`);
    failed = true;
  }
}

if (failed && !off) {
  console.error('[assert-prod-env] refusing to start. Set REQUIRE_ENV=off to boot degraded (staging only).');
  process.exit(1);
}
console.log('[assert-prod-env] ok');
