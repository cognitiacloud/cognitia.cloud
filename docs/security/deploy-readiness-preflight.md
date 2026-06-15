# Deploy-readiness preflight (Item 7)

A **pure, read-only** check that a deployment is configured correctly **before**
it ships. It aggregates the fail-closed gates the API enforces at boot
(`apps/api/src/server.ts`) into a single report a pipeline can act on.

- **Code:** `apps/api/src/preflightReadiness.ts` (pure function over a
  `SecretSource`), CLI `scripts/preflight.ts`.
- **Run:** `pnpm run preflight` — prints the report and **exits non-zero** when
  any check fails, so it can gate a deploy.

## What it does — and deliberately does NOT do

It **never** deploys, connects to a database, mutates state, or reads secret
_material_ into output. It only checks presence/shape via the **same validators
boot uses** (`requireSecret`, `requireKeyBytes`, `isProductionDeploy` in
`apps/api/src/secrets.ts`), so the preflight rules cannot drift from the boot
rules.

## Checks

| id                             | prod-missing | malformed | notes                                                           |
| ------------------------------ | ------------ | --------- | --------------------------------------------------------------- |
| `DATABASE_URL`                 | **fail**     | —         | boot refuses the in-memory repo in production                   |
| `CREDENTIAL_SECRET_KEY_BASE64` | **fail**     | **fail**  | must decode to exactly 32 bytes (AES-256)                       |
| `SESSION_SECRET`               | warn         | **fail**  | warn if absent (boot also accepts SSO); weak (<32) always fails |
| `HUBSPOT_WEBHOOK_SECRET`       | warn         | —         | optional; without it inbound webhook signatures aren't verified |
| `DB_ROLE_RLS_ENFORCED`         | **skip**     | —         | live-only — enforced at boot via `assertEnforcedRlsRole`        |

**Fail-closed:** any `fail` makes the report `ok: false` and the CLI exit `1`.
In non-production, prod-only requirements downgrade to `warn` so local work is
not blocked — but a **present-but-malformed** secret fails everywhere.

## Honest scope

The preflight is a configuration gate, not a guarantee of a healthy deploy. The
DB-role RLS-enforcement check needs a live connection and is therefore reported
as `skip` (enforced at boot), never claimed "verified" here. Wiring
`pnpm preflight` into CI/CD as a required step is an ops/policy action.

Tests: `apps/api/src/preflightReadiness.test.ts` (production + non-production
matrices, fail-closed behavior, validator reuse, report formatting).
