import type { ApprovalVerification } from './approvalGate.js';
import type { WritebackResult } from './connectorRegistry.js';
import type { QualificationResult } from './qualification.js';
import type {
  BlockedReason,
  ConsentStatus,
  DataMode,
  SourceRightsStatus,
  VerticalId,
  WorkflowState,
} from './types.js';

/**
 * Command Center summary — the operator-facing data surface (build target 10):
 * workflow state, approvals, blockers, proof receipt id, next action. This is
 * a data shape, not a UI; rendering is a future lane.
 */

export type ApprovalSummaryState =
  | 'approved'
  | 'denied'
  | 'hold'
  | 'missing'
  | 'forged'
  | 'not_reached';

export type WritebackSummaryState = 'recorded_mock_intent' | 'blocked' | 'not_reached';

export interface CommandCenterSummary {
  runId: string;
  leadId: string | null;
  scenarioId: string | null;
  vertical: VerticalId | null;
  dataMode: DataMode | null;
  workflowState: WorkflowState;
  qualificationStatus: 'qualified' | 'disqualified' | 'not_reached';
  compositeScore: number | null;
  consentState: ConsentStatus | null;
  sourceRightsState: SourceRightsStatus | null;
  approvalState: ApprovalSummaryState;
  writebackState: WritebackSummaryState;
  proofReceiptId: string;
  blockers: readonly BlockedReason[];
  nextAction: string;
}

export interface CommandCenterInput {
  runId: string;
  leadId: string | null;
  scenarioId: string | null;
  vertical: VerticalId | null;
  dataMode: DataMode | null;
  finalState: WorkflowState;
  qualification: QualificationResult | null;
  consentState: ConsentStatus | null;
  sourceRightsState: SourceRightsStatus | null;
  approval: ApprovalVerification | null;
  writeback: WritebackResult | null;
  proofReceiptId: string;
  blockedReason: BlockedReason | null;
}

export function buildCommandCenterSummary(input: CommandCenterInput): CommandCenterSummary {
  const approvalState: ApprovalSummaryState = input.approval
    ? input.approval.status
    : 'not_reached';
  const writebackState: WritebackSummaryState = input.writeback
    ? input.writeback.status === 'recorded_mock_intent'
      ? 'recorded_mock_intent'
      : 'blocked'
    : 'not_reached';
  return {
    runId: input.runId,
    leadId: input.leadId,
    scenarioId: input.scenarioId,
    vertical: input.vertical,
    dataMode: input.dataMode,
    workflowState: input.finalState,
    qualificationStatus: input.qualification?.status ?? 'not_reached',
    compositeScore: input.qualification?.compositeScore ?? null,
    consentState: input.consentState,
    sourceRightsState: input.sourceRightsState,
    approvalState,
    writebackState,
    proofReceiptId: input.proofReceiptId,
    blockers: input.blockedReason ? [input.blockedReason] : [],
    nextAction: deriveNextAction(input, approvalState),
  };
}

function deriveNextAction(input: CommandCenterInput, approvalState: ApprovalSummaryState): string {
  const reason = input.blockedReason;
  if (!reason) {
    return 'Run complete (mock-only). Review the proof receipt and monthly report input.';
  }
  switch (reason.code) {
    case 'LEAD_SCHEMA_INVALID':
      return 'Fix the lead fixture so it passes intake validation, then re-run.';
    case 'LIVE_DATA_MODE_REJECTED':
    case 'DATA_MODE_NOT_ALLOWED_FOR_VERTICAL':
      return 'Replace the payload with fake/reserved fixture data; live data is not accepted in this build.';
    case 'VERTICAL_ADAPTER_NOT_AVAILABLE':
      return 'Vertical is reference/design-only. Implement its adapter in an authorized lane before running.';
    case 'SOURCE_RIGHTS_UNKNOWN':
    case 'SOURCE_RIGHTS_DENIED':
      return 'Verify source rights for this lead source before any further action.';
    case 'CONSENT_MISSING':
    case 'CONSENT_REVOKED':
    case 'CONTACT_NOT_ALLOWED':
      return 'Obtain and record verifiable consent before any follow-up readiness step.';
    case 'LEAD_DISQUALIFIED':
      return 'No automated action. Optionally route to a human for manual nurture review.';
    case 'HUMAN_APPROVAL_MISSING':
      return 'Request a human operator decision via the approval registry, then re-run.';
    case 'HUMAN_APPROVAL_DENIED':
      return 'Respect the denial. Review the reviewer note before proposing a different next step.';
    case 'HUMAN_APPROVAL_HOLD':
      return 'Wait for the human reviewer to release the hold; do not retry automatically.';
    case 'FORGED_APPROVAL_REJECTED':
      return 'Investigate the forged approval attempt; only registry-issued approvals are trusted.';
    case 'CONNECTOR_NOT_REGISTERED':
    case 'CONNECTOR_LIVE_BLOCKED':
    case 'CONNECTOR_EGRESS_DENIED':
    case 'CONNECTOR_APPROVAL_REQUIRED':
      return 'Use a mock_only connector with a verified approval; live connectors stay blocked in this build.';
    case 'LIVE_PROVIDER_NOT_AUTHORIZED':
    case 'PROVIDER_DISABLED':
    case 'REPLAY_FIXTURE_MISSING':
      return 'Use mock or replay routes with registered fixtures; live providers stay disabled.';
    case 'SECRET_LIKE_INPUT_REJECTED':
      return 'Remove secret-looking content from the route input and re-run with clean fixture text.';
    default: {
      // Exhaustiveness backstop — new codes must add a next action above.
      if (approvalState === 'forged') {
        return 'Investigate the forged approval attempt.';
      }
      return 'Blocked. Review the proof receipt reason before any further action.';
    }
  }
}
