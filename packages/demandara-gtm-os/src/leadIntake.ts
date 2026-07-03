import { demandaraLeadSchema, ALLOWED_DATA_MODES, blockedReason } from './types.js';
import type { BlockedReason, DemandaraLead, RawLeadInput } from './types.js';

/**
 * Lead intake — normalize inbound/referral/manual/demo leads into a
 * `DemandaraLead` (03_DEMANDARA_GTM_OS_PRODUCT_CONTEXT.md).
 *
 * Fail-closed rules:
 *   - payloads that do not match the schema are rejected (unknown keys are
 *     stripped, so approval-looking fields can never enter the workflow);
 *   - any data mode outside fake_fixture/internal_reserved is rejected —
 *     this build never accepts live customer data.
 */

export type LeadIntakeResult =
  | { ok: true; lead: DemandaraLead }
  | { ok: false; reason: BlockedReason };

export function intakeLead(raw: RawLeadInput): LeadIntakeResult {
  const parsed = demandaraLeadSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    return { ok: false, reason: blockedReason('LEAD_SCHEMA_INVALID', `Issues: ${issues}`) };
  }
  const lead = parsed.data;
  if (!ALLOWED_DATA_MODES.includes(lead.dataMode)) {
    return {
      ok: false,
      reason: blockedReason('LIVE_DATA_MODE_REJECTED', `Declared mode: ${lead.dataMode}.`),
    };
  }
  return { ok: true, lead };
}
