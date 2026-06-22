import { isSafeEmail, isSafePhone, scanForRawPii } from '../pii/piiSafety.js';
import type {
  ComplianceCheck,
  ComplianceCheckName,
  ComplianceDecision,
  FixtureLead,
  Tenant,
} from '../types.js';

/**
 * Consent / compliance gate. Pure and deterministic: given a lead and its
 * tenant it returns an allow/block decision plus machine-readable blocked
 * reasons. It is fail-closed — any failed check blocks the run, and a blocked
 * decision still produces a proof receipt upstream (in the engine).
 *
 * Note this gate also enforces PII safety as a compliance check: a lead whose
 * contact fields are not on the reserved fictional forms is `pii_unsafe` and is
 * blocked before it can reach any (mock) consequential action.
 */

const REASON_BY_CHECK: Record<ComplianceCheckName, string> = {
  tenant_active: 'tenant_inactive',
  pii_safe: 'pii_unsafe',
  consent_present: 'consent_missing',
  consent_not_revoked: 'consent_revoked',
  not_suppressed: 'on_suppression_list',
  channel_permitted: 'channel_not_permitted',
};

export function evaluateCompliance(lead: FixtureLead, tenant: Tenant): ComplianceDecision {
  const piiSafe =
    isSafeEmail(lead.email) &&
    isSafePhone(lead.phone) &&
    scanForRawPii({ displayName: lead.displayName, source: lead.source }).length === 0;

  const channelPermitted =
    tenant.permittedChannels.includes('mock_appointment') &&
    tenant.permittedChannels.includes('mock_crm');

  const checks: ComplianceCheck[] = [
    {
      name: 'tenant_active',
      passed: tenant.active,
      detail: tenant.active ? 'tenant is active' : 'tenant is not active',
    },
    {
      name: 'pii_safe',
      passed: piiSafe,
      detail: piiSafe
        ? 'contact fields use reserved .example / 555-01xx forms'
        : 'contact fields are not on the reserved fictional forms',
    },
    {
      name: 'consent_present',
      passed: lead.consent.contact === true,
      detail: lead.consent.contact ? 'contact consent on record' : 'no contact consent on record',
    },
    {
      name: 'consent_not_revoked',
      passed: !lead.consent.revoked,
      detail: lead.consent.revoked ? 'consent was revoked' : 'consent is current',
    },
    {
      name: 'not_suppressed',
      passed: !lead.suppressed,
      detail: lead.suppressed ? 'lead is on the suppression list' : 'lead is not suppressed',
    },
    {
      name: 'channel_permitted',
      passed: channelPermitted,
      detail: channelPermitted
        ? 'mock channels permitted for tenant'
        : 'required mock channels not permitted for tenant',
    },
  ];

  const reasons = checks.filter((c) => !c.passed).map((c) => REASON_BY_CHECK[c.name]);
  return { allowed: reasons.length === 0, reasons, checks };
}
