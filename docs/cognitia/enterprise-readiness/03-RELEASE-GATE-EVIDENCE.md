# 03 — Release-Gate Evidence Requirements

**Model:** `packages/enterprise-readiness/src/releaseGate.ts`
**Tests:** `src/releaseGate.test.ts`

## Goal

Promotion through stages is a **fail-closed** evidence checklist. Missing or
unknown evidence blocks. `live` is never reachable while mock-safe is on.

## Stages

`dev` → `mock-staging` → `pilot-dark` → `live`

## Evidence requirements (`EVIDENCE_REQUIREMENTS`)

| Evidence | Required from | Human-attested |
|----------|---------------|----------------|
| `typecheck` (pnpm check / tsc) | mock-staging | |
| `unit_tests` (unit + guard) | mock-staging | |
| `safety_scan` (no egress, no secrets) | mock-staging | |
| `mock_safe_proof` (dry-run `sent:false`) | mock-staging | |
| `audit_schema_conformance` (validates, no PII) | mock-staging | |
| `rollback_rehearsed` | pilot-dark | |
| `monitoring_active` | pilot-dark | |
| `founder_approval` (#09 signed) | pilot-dark | ✅ |
| `legal_client_approval` (#10 signed) | live | ✅ |
| `connector_dark_mode_review` | live | ✅ |

Requirements accumulate: a stage inherits every requirement at or below it.

## Evaluation (`evaluateReleaseGate`)

Fail-closed rules:
- evidence **missing** → `missing_evidence:<id>`;
- evidence **not passing** (`fail` or `unknown`) → `evidence_not_passing:<id>:<state>`;
- promotion to **`live` while mock-safe** → always blocked
  (`live_promotion_blocked_in_mock_safe`), regardless of evidence. An automated
  gate must never grant live on its own — that needs #09 + #10 sign-off and an
  explicit, audited decision to disable mock-safe.

Each gate evaluation should emit `release.gate.evaluated.v1`; an override (only
by `admin`+ with `release.gate.override`) emits `release.gate.overridden.v1`,
which pages (#04).

## Evidence provenance

Each `EvidenceItem` carries an optional `ref` pointing at the proof (CI run id,
doc path, signature ref). Human-attested items must reference a signed checklist,
never a self-asserted boolean.
