/**
 * Machine-readable evidence pack (Item 5) — single source of truth.
 *
 * A reviewer-facing inventory of the GTM-lane controls with an HONEST completion
 * status and the files/tests that prove each. The committed JSON
 * (docs/security/evidence-pack.json) is GENERATED from this constant
 * (scripts/gen-evidence-pack.ts) and a test asserts it matches + that every
 * referenced file/test actually exists — so evidence can neither drift nor be
 * fabricated.
 *
 * `status` is what the CODE achieves. `residual` states what remains and of
 * what KIND (infra / policy / decision) — so "code-complete vs infra-complete
 * vs policy-complete" is visible at a glance. This module imports nothing so it
 * can be rendered by a plain Node script.
 */

export type CompletionStatus = 'code-complete' | 'infra-complete' | 'policy-complete' | 'pending';
export type ResidualKind = 'infra' | 'policy' | 'decision';

export interface ControlEvidence {
  id: string;
  name: string;
  category: 'security' | 'reliability' | 'observability' | 'compliance';
  status: CompletionStatus;
  /** Source files that enforce the control (must exist). */
  enforced_by: string[];
  /** Test files that prove it (must exist; required for security/compliance). */
  tests: string[];
  /** What remains, and of what kind. null when nothing remains. */
  residual: { kind: ResidualKind; note: string } | null;
}

export interface EvidencePack {
  schema_version: 'evidence.v1';
  note: string;
  controls: ControlEvidence[];
}

export const EVIDENCE_PACK: EvidencePack = {
  schema_version: 'evidence.v1',
  note: 'GTM-lane controls. status = what the code achieves; residual.kind = infra/policy/decision work that remains. Generated from apps/api/src/evidencePack.ts; do not edit the JSON by hand.',
  controls: [
    {
      id: 'tenant-isolation-rls',
      name: 'Tenant isolation via RLS under a non-superuser role',
      category: 'security',
      status: 'code-complete',
      enforced_by: ['deploy/roles/app_user.sql', 'packages/db/src/rlsGuard.ts'],
      tests: [
        'packages/db/src/kysely.rls.pglite.test.ts',
        'packages/db/src/rlsGuard.pglite.test.ts',
      ],
      residual: {
        kind: 'infra',
        note: 'app/worker pools must run under app_user at deploy; the prod boot guard enforces this.',
      },
    },
    {
      id: 'approval-gating',
      name: 'No side effect without explicit human approval',
      category: 'security',
      status: 'code-complete',
      enforced_by: ['packages/agents/src/ledger/actionLedger.ts'],
      tests: ['apps/api/src/crmExecute.test.ts', 'apps/api/src/security.regression.test.ts'],
      residual: null,
    },
    {
      id: 'audit-chain-integrity',
      name: 'Append-only, tamper-evident audit chain',
      category: 'security',
      status: 'code-complete',
      enforced_by: ['packages/db/src/auditChain.ts'],
      tests: [
        'apps/api/src/security.regression.test.ts',
        'packages/db/src/kysely.rls.pglite.test.ts',
      ],
      residual: {
        kind: 'infra',
        note: 'external anchoring is a mechanism only; a durable, independent sink is infra (not provisioned).',
      },
    },
    {
      id: 'authz-rbac',
      name: 'RBAC: owner-only / mutating gates on every privileged route',
      category: 'security',
      status: 'code-complete',
      enforced_by: ['apps/api/src/authzMatrix.ts', 'apps/api/src/handlers.ts'],
      tests: [
        'apps/api/src/security.regression.test.ts',
        'apps/api/src/securityInvariants.guard.test.ts',
      ],
      residual: null,
    },
    {
      id: 'input-sanitization',
      name: 'No raw PII/secret into logs or stored errors; generic 500s',
      category: 'security',
      status: 'code-complete',
      enforced_by: ['packages/core/src/logging.ts', 'apps/api/src/server.ts'],
      tests: ['packages/core/src/logging.test.ts', 'apps/api/src/logSafety.guard.test.ts'],
      residual: null,
    },
    {
      id: 'rate-limiting',
      name: 'Per-client rate limit on every route (429); /health exempt',
      category: 'reliability',
      status: 'code-complete',
      enforced_by: ['apps/api/src/server.ts'],
      tests: ['apps/api/src/security.regression.test.ts'],
      residual: {
        kind: 'infra',
        note: 'in-memory store per instance; multi-instance deploys need a shared (Redis) store.',
      },
    },
    {
      id: 'fail-closed-startup',
      name: 'Production refuses superuser DB role / missing secrets / fake client',
      category: 'security',
      status: 'code-complete',
      enforced_by: [
        'packages/db/src/rlsGuard.ts',
        'apps/api/src/secrets.ts',
        'apps/api/src/server.ts',
      ],
      tests: ['packages/db/src/rlsGuard.pglite.test.ts', 'apps/api/src/secrets.test.ts'],
      residual: {
        kind: 'infra',
        note: 'requires DEPLOY_ENV=production + real secrets supplied at deploy.',
      },
    },
    {
      id: 'dsar',
      name: 'DSAR access export + erasure (PII removed, audit chain preserved)',
      category: 'compliance',
      status: 'code-complete',
      enforced_by: ['apps/api/src/dsar.ts', 'packages/db/src/repository.ts'],
      tests: ['apps/api/src/dsar.test.ts'],
      residual: null,
    },
    {
      id: 'secret-validation',
      name: 'Secret seam + fail-closed validation (length / 32-byte key)',
      category: 'security',
      status: 'code-complete',
      enforced_by: ['apps/api/src/secrets.ts'],
      tests: ['apps/api/src/secrets.test.ts'],
      residual: {
        kind: 'infra',
        note: 'KMS/Vault custody of the secret material is infra (env is the default source).',
      },
    },
    {
      id: 'ci-gates',
      name: 'CI gates: coverage floor, prod dep-scan, CodeQL SAST',
      category: 'reliability',
      status: 'code-complete',
      enforced_by: [
        '.github/workflows/ci.yml',
        '.github/workflows/codeql.yml',
        '.github/codeql/codeql-config.yml',
        'vitest.config.ts',
      ],
      tests: [],
      residual: {
        kind: 'policy',
        note: 'branch protection (require build-test + CodeQL) is a GitHub settings toggle the gates do not self-enforce.',
      },
    },
    {
      id: 'sso-auth2',
      name: 'Tenant-scoped SSO (SAML+OIDC) + access-review export',
      category: 'security',
      status: 'code-complete',
      enforced_by: ['apps/api/src/sso.ts', 'apps/api/src/accessReview.ts'],
      tests: ['apps/api/src/sso.test.ts', 'apps/api/src/accessReview.test.ts'],
      residual: {
        kind: 'decision',
        note: 'live IdP wire bindings (JWKS / XML-DSig) = AUTH-3, gated on the pilot IdP choice.',
      },
    },
    {
      id: 'self-improve-sandbox',
      name: 'Shadow-mode self-improvement (inert; human-gated; no auto-promote)',
      category: 'security',
      status: 'code-complete',
      enforced_by: ['apps/api/src/selfImprove.ts'],
      tests: ['apps/api/src/selfImprove.test.ts'],
      residual: {
        kind: 'decision',
        note: 'persistence + owner-gated API + any applier need product decisions; inert by design until then.',
      },
    },
  ],
};

/** Deterministic JSON rendering of the pack (trailing newline for prettier). */
export function renderEvidenceJson(): string {
  return JSON.stringify(EVIDENCE_PACK, null, 2) + '\n';
}
