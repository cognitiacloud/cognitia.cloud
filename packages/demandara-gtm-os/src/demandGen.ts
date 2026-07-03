import { z } from 'zod';
import { evidenceLabel, verticalId } from './types.js';
import type { BlockedReason, VerticalId } from './types.js';

/**
 * Demand Gen engine skeleton (10_DEMAND_GEN_AND_COGNITIA_REPUBLIC_CONTEXT.md).
 *
 * SEO/AEO/AIO opportunity objects, proof-backed content briefs, and the
 * monthly proof-backed report input. Content boundary: evidence-backed claims
 * only — the claim-safety checker rejects forbidden claim language before a
 * brief can be marked claim-safe. Nothing here publishes anything.
 */

export const demandChannel = z.enum(['seo', 'aeo', 'aio']);
export type DemandChannel = z.infer<typeof demandChannel>;

/** A ranked content/demand opportunity for a vertical. */
export const demandOpportunitySchema = z.object({
  opportunityId: z.string().min(1),
  channel: demandChannel,
  vertical: verticalId,
  topic: z.string().min(1),
  painCategory: z.string().min(1),
  searchIntent: z.string().min(1),
  priorityScore: z.number().min(0).max(1),
});
export type DemandOpportunity = z.infer<typeof demandOpportunitySchema>;

/** A single claim inside a brief; every claim carries an evidence label. */
export const contentClaimSchema = z.object({
  text: z.string().min(1),
  evidenceLabel,
  evidenceRef: z.string().min(1).optional(),
});
export type ContentClaim = z.infer<typeof contentClaimSchema>;

export const contentBriefSchema = z.object({
  briefId: z.string().min(1),
  opportunityId: z.string().min(1),
  headline: z.string().min(1),
  outline: z.array(z.string()).default([]),
  claims: z.array(contentClaimSchema).default([]),
  proofReceiptIds: z.array(z.string()).default([]),
});
export type ContentBrief = z.infer<typeof contentBriefSchema>;

/**
 * Forbidden public-claim language (05_ALTA_BENCHMARK_AND_SUPERIORITY_TARGET.md
 * and the content boundary). Checked case-insensitively.
 */
export const FORBIDDEN_CLAIM_PHRASES: readonly string[] = [
  'better than alta',
  'production-ready',
  'production ready',
  'guaranteed',
  'can contact customers now',
  'proven revenue',
  'beta 1 approved',
];

export interface ClaimSafetyViolation {
  claimText: string;
  problem: string;
}

/**
 * Claim-safety checker: a brief is claim-safe only if no claim uses forbidden
 * phrases and every strong claim ('IMPLEMENTED_LOCAL_MOCK'/'TESTED_LOCAL')
 * carries an evidenceRef pointing at local evidence (receipt, test, doc).
 */
export function checkClaimSafety(brief: ContentBrief): {
  claimSafe: boolean;
  violations: ClaimSafetyViolation[];
} {
  const violations: ClaimSafetyViolation[] = [];
  for (const claim of brief.claims) {
    const lowered = claim.text.toLowerCase();
    for (const phrase of FORBIDDEN_CLAIM_PHRASES) {
      if (lowered.includes(phrase)) {
        violations.push({ claimText: claim.text, problem: `forbidden phrase: "${phrase}"` });
      }
    }
    if (
      (claim.evidenceLabel === 'IMPLEMENTED_LOCAL_MOCK' ||
        claim.evidenceLabel === 'TESTED_LOCAL') &&
      !claim.evidenceRef
    ) {
      violations.push({
        claimText: claim.text,
        problem: 'evidence-backed claim requires an evidenceRef',
      });
    }
  }
  return { claimSafe: violations.length === 0, violations };
}

/* ------------------------------------------- monthly proof-backed report */

export interface MonthlyReportRunEntry {
  runId: string;
  leadId: string | null;
  vertical: VerticalId | null;
  policyDecision: 'allowed_mock_only' | 'blocked';
  blockedReason: BlockedReason | null;
  proofReceiptId: string;
  qualified: boolean | null;
  approvalDecision: string | null;
}

/** Outcome-first metrics (03_DEMANDARA_GTM_OS_PRODUCT_CONTEXT.md) — not just meetings booked. */
export interface MonthlyProofReportInput {
  totalRuns: number;
  allowedMockOnly: number;
  blocked: number;
  blockedByReason: Record<string, number>;
  qualifiedLeadProgression: number;
  humanApprovedNextSteps: number;
  proofReceiptIds: readonly string[];
  blockedUnsafeActionCount: number;
}

/** Accumulates per-run entries into the monthly proof-backed report input. */
export class MonthlyProofReportAccumulator {
  private readonly entries: MonthlyReportRunEntry[] = [];

  record(entry: MonthlyReportRunEntry): void {
    this.entries.push(entry);
  }

  runs(): readonly MonthlyReportRunEntry[] {
    return [...this.entries];
  }

  snapshot(): MonthlyProofReportInput {
    const blockedByReason: Record<string, number> = {};
    let allowed = 0;
    let blocked = 0;
    let qualified = 0;
    let approved = 0;
    const receiptIds: string[] = [];
    for (const entry of this.entries) {
      receiptIds.push(entry.proofReceiptId);
      if (entry.policyDecision === 'allowed_mock_only') allowed += 1;
      else {
        blocked += 1;
        const code = entry.blockedReason?.code ?? 'UNKNOWN';
        blockedByReason[code] = (blockedByReason[code] ?? 0) + 1;
      }
      if (entry.qualified === true) qualified += 1;
      if (entry.approvalDecision === 'approved') approved += 1;
    }
    return {
      totalRuns: this.entries.length,
      allowedMockOnly: allowed,
      blocked,
      blockedByReason,
      qualifiedLeadProgression: qualified,
      humanApprovedNextSteps: approved,
      proofReceiptIds: receiptIds,
      blockedUnsafeActionCount: blocked,
    };
  }
}
