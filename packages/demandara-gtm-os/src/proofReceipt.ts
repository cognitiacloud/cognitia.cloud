import { randomUUID } from 'node:crypto';
import { hashValue } from './hashing.js';
import type { ApprovalEvent } from './approvalGate.js';
import type { WritebackIntent } from './connectorRegistry.js';
import type {
  BlockedReason,
  Clock,
  ConsentStatus,
  DataMode,
  EvidenceLabel,
  IdFactory,
  SourceRightsStatus,
  VerticalId,
  WorkflowState,
} from './types.js';

/**
 * Proof receipt (02_COGNITIA_TRUST_PROOF_CONTROL_CONTEXT.md) — the
 * human-readable explanation of what happened and why. A receipt is generated
 * on EVERY workflow run, allowed or blocked; the blocked path is proof too.
 */

export interface ProofReceipt {
  receiptId: string;
  runId: string;
  templateId: string;
  leadId: string | null;
  scenarioId: string | null;
  vertical: VerticalId | null;
  dataMode: DataMode | null;
  policyDecision: 'allowed_mock_only' | 'blocked';
  finalState: WorkflowState;
  consentState: ConsentStatus | null;
  sourceRightsState: SourceRightsStatus | null;
  approval: {
    approvalId: string;
    decision: string;
    approvedBy: string;
    issuedAt: string;
  } | null;
  adapterEvent: {
    connectorId: string;
    intentId: string;
    target: string;
    mockOnly: true;
  } | null;
  blockedReason: BlockedReason | null;
  blockedAtState: WorkflowState | null;
  ledgerEventIds: readonly string[];
  evidenceLabel: EvidenceLabel;
  generatedAt: string;
  /** Hash over every field above — receipts are tamper-evident. */
  contentHash: string;
}

export interface ProofReceiptInput {
  runId: string;
  templateId: string;
  leadId: string | null;
  scenarioId: string | null;
  vertical: VerticalId | null;
  dataMode: DataMode | null;
  policyDecision: 'allowed_mock_only' | 'blocked';
  finalState: WorkflowState;
  consentState: ConsentStatus | null;
  sourceRightsState: SourceRightsStatus | null;
  approval: ApprovalEvent | null;
  writebackIntent: WritebackIntent | null;
  blockedReason: BlockedReason | null;
  blockedAtState: WorkflowState | null;
  ledgerEventIds: readonly string[];
}

export interface ProofReceiptOptions {
  clock?: Clock;
  idFactory?: IdFactory;
}

export function buildProofReceipt(
  input: ProofReceiptInput,
  options: ProofReceiptOptions = {},
): ProofReceipt {
  const clock = options.clock ?? (() => new Date());
  const idFactory = options.idFactory ?? randomUUID;
  const body = {
    receiptId: idFactory(),
    runId: input.runId,
    templateId: input.templateId,
    leadId: input.leadId,
    scenarioId: input.scenarioId,
    vertical: input.vertical,
    dataMode: input.dataMode,
    policyDecision: input.policyDecision,
    finalState: input.finalState,
    consentState: input.consentState,
    sourceRightsState: input.sourceRightsState,
    approval: input.approval
      ? {
          approvalId: input.approval.approvalId,
          decision: input.approval.decision,
          approvedBy: input.approval.approvedBy,
          issuedAt: input.approval.issuedAt,
        }
      : null,
    adapterEvent: input.writebackIntent
      ? {
          connectorId: input.writebackIntent.connectorId,
          intentId: input.writebackIntent.intentId,
          target: input.writebackIntent.target,
          mockOnly: true as const,
        }
      : null,
    blockedReason: input.blockedReason,
    blockedAtState: input.blockedAtState,
    ledgerEventIds: [...input.ledgerEventIds],
    evidenceLabel: 'IMPLEMENTED_LOCAL_MOCK' as const,
    generatedAt: clock().toISOString(),
  };
  return Object.freeze({ ...body, contentHash: hashValue(body) });
}

/** Render the receipt for humans (operators, reviewers, auditors). */
export function renderProofReceiptMarkdown(receipt: ProofReceipt): string {
  const lines: string[] = [
    `# Proof Receipt ${receipt.receiptId}`,
    '',
    `- Run: ${receipt.runId}`,
    `- Template: ${receipt.templateId}`,
    `- Lead: ${receipt.leadId ?? '(rejected before intake completed)'}`,
    `- Scenario: ${receipt.scenarioId ?? 'n/a'}`,
    `- Vertical: ${receipt.vertical ?? 'n/a'}`,
    `- Data mode: ${receipt.dataMode ?? 'n/a'}`,
    `- Decision: **${receipt.policyDecision}**`,
    `- Final state: ${receipt.finalState}`,
    `- Consent: ${receipt.consentState ?? 'n/a'}`,
    `- Source rights: ${receipt.sourceRightsState ?? 'n/a'}`,
  ];
  if (receipt.approval) {
    lines.push(
      `- Human approval: ${receipt.approval.decision} by ${receipt.approval.approvedBy} at ${receipt.approval.issuedAt} (event ${receipt.approval.approvalId})`,
    );
  } else {
    lines.push('- Human approval: none recorded');
  }
  if (receipt.adapterEvent) {
    lines.push(
      `- Writeback: MOCK-ONLY intent ${receipt.adapterEvent.intentId} to ${receipt.adapterEvent.target} via ${receipt.adapterEvent.connectorId} (no egress performed)`,
    );
  } else {
    lines.push('- Writeback: none recorded');
  }
  if (receipt.blockedReason) {
    lines.push(
      `- Blocked at \`${receipt.blockedAtState ?? 'unknown'}\`: [${receipt.blockedReason.code}] ${receipt.blockedReason.detail}`,
    );
  } else {
    lines.push('- Blocked: no');
  }
  lines.push(
    `- Ledger events: ${receipt.ledgerEventIds.length}`,
    `- Evidence label: ${receipt.evidenceLabel}`,
    `- Generated: ${receipt.generatedAt}`,
    `- Content hash: ${receipt.contentHash}`,
    '',
    '> Local/mock-only run. No live provider, CRM, outreach, or deploy action was taken.',
  );
  return lines.join('\n');
}
