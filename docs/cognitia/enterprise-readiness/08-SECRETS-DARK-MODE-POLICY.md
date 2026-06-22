# 08 — Secrets / Connector Dark-Mode Policy

**Model:** `packages/enterprise-readiness/src/darkMode.ts`
**Tests:** `src/darkMode.test.ts`
**Scan:** `scripts/safety-scan.mjs`

## Policy

Dark mode is the default and only sanctioned posture in this build.

- **No production secrets.** Connectors hold **placeholder** credential refs only
  (`env:…PLACEHOLDER`, `mock://…`, `placeholder:…`, `dark:…`). Real-looking
  secrets fail closed.
- **No vendor API execution / no real CRM writes.** Every action is a dry run
  with `sent: false`.
- **Going live is out of band.** Turning a connector live requires founder (#09)
  + legal/client (#10) sign-off **and** disabling mock-safe — which this codebase
  never does.

## Enforcement

### `assertDarkMode(posture)` — fail-closed
- `mode` must be `dark` while mock-safe → else `connector_not_dark`.
- `credentialRef` must be a recognized placeholder → else
  `credential_ref_not_placeholder`.
- `credentialRef` must not match real-secret heuristics (OpenAI `sk-…`, Slack
  `xox…`, Google `AIza…`, AWS `AKIA…`, PEM private keys) → else
  `real_secret_detected`.

### `DryRunAction` / `assertDryRun`
- `DryRunAction.sent` is the literal `false`; constructing a truthy `sent` is a
  **type error**.
- `assertDryRun` rejects any boundary object whose `sent` is not literally
  `false` in mock-safe mode.

### `scripts/safety-scan.mjs`
Repo-wide scan that fails the build on: live egress primitives (`fetch(`,
`axios`, external `http(s)://`, `net.connect`, `https.request`) in production
source; real-secret patterns anywhere; `sent: true` literals in production
source. Test files are scanned with case-aware rules so negative tests don't
false-positive.

## Connectors covered

`hubspot`, `gmail`, `slack`, `apify`, `crm-generic` — all `dark`.

## Secret handling rules

- Secrets are referenced by name (`env:NAME`), never inlined.
- `.env.example` carries placeholder values only; real `.env` is never committed.
- Any connector config change emits `connector.config.changed.v1` and is checked
  to confirm it stayed dark (#04 `connector-config-change`).
- Enforcing dark mode on a connector emits `connector.darkmode.enforced.v1`.
