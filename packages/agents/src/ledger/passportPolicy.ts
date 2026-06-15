import type { AgentPassportRow, ScopeGrantRow } from '@cognitia/db';

/**
 * PASS-1 — identity-first execution policy. A pure decision function: given
 * the acting agent's passport, its grants, and the action being executed,
 * decide allow/deny with a typed denial reason. Pure so the matrix of cases
 * is unit-testable without a repo; the ledger is the ONLY caller (single
 * chokepoint — authorization is not scattered across adapters).
 *
 * Fail-closed rules:
 *  - no passport, or passport not 'active' → deny
 *  - no grant matching (action_type, integration) → deny
 *  - matching grants all revoked/expired → deny (most specific reason wins)
 *  - live matching grant but action risk above risk_max → deny
 *  - unknown risk strings are treated as maximally risky for the action and
 *    minimally permissive for the grant (never silently allow).
 */

export type PassportDenial =
  | 'passport_missing'
  | 'passport_revoked'
  | 'passport_suspended'
  | 'grant_missing'
  | 'grant_revoked'
  | 'grant_expired'
  | 'grant_insufficient_risk';

const RISK_ORDER: Record<string, number> = { none: 0, low: 1, medium: 2, high: 3 };
/** Action risk: unknown → maximally risky (requires the broadest grant). */
const actionRisk = (r: string): number => RISK_ORDER[r] ?? Number.POSITIVE_INFINITY;
/** Grant ceiling: unknown → grants nothing. */
const grantCeiling = (r: string): number => RISK_ORDER[r] ?? -1;

export interface PassportCheckInput {
  passport: AgentPassportRow | null;
  /** All grants for the passport (the function filters; callers don't pre-judge). */
  grants: ScopeGrantRow[];
  actionType: string;
  integration: string;
  riskLevel: string;
  now: Date;
}

export interface PassportCheckResult {
  allowed: boolean;
  denial?: PassportDenial;
  passport_id?: string;
  /** The grant that authorized execution (when allowed). */
  grant_id?: string;
}

export function checkPassport(input: PassportCheckInput): PassportCheckResult {
  const { passport, actionType, integration, riskLevel, now } = input;
  if (!passport) return { allowed: false, denial: 'passport_missing' };
  if (passport.status !== 'active') {
    return {
      allowed: false,
      denial: passport.status === 'suspended' ? 'passport_suspended' : 'passport_revoked',
      passport_id: passport.id,
    };
  }

  const matching = input.grants.filter(
    (g) =>
      g.passport_id === passport.id &&
      g.action_type === actionType &&
      g.integration === integration,
  );
  if (matching.length === 0) {
    return { allowed: false, denial: 'grant_missing', passport_id: passport.id };
  }

  const live = matching.filter(
    (g) => g.status === 'active' && new Date(g.expires_at).getTime() > now.getTime(),
  );
  if (live.length === 0) {
    // Most specific reason: an explicit revocation outranks a lapse.
    const revoked = matching.find((g) => g.status === 'revoked');
    return {
      allowed: false,
      denial: revoked ? 'grant_revoked' : 'grant_expired',
      passport_id: passport.id,
      grant_id: (revoked ?? matching[0])!.id,
    };
  }

  const sufficient = live.find((g) => grantCeiling(g.risk_max) >= actionRisk(riskLevel));
  if (!sufficient) {
    return {
      allowed: false,
      denial: 'grant_insufficient_risk',
      passport_id: passport.id,
      grant_id: live[0]!.id,
    };
  }
  return { allowed: true, passport_id: passport.id, grant_id: sufficient.id };
}
