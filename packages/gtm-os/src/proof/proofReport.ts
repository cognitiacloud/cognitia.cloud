import { verifyLedger, type AppendOnlyLedger } from '../ledger/actionLedger.js';
import { scanForRawPii } from '../pii/piiSafety.js';
import type { ProofReceipt, RunState, TenantId } from '../types.js';
import { verifyReceiptChain } from './proofReceipt.js';

/**
 * Proof report + operator-facing timeline. The report aggregates a run's proof
 * receipts and ledger into a single attestable artifact; the timeline renders it
 * as a Markdown "proof log" an operator can read. (The web operator-console
 * route is owned by #138 / #119, so the operator surface here is a pure renderer
 * in this lane — no `apps/web` files are touched.)
 */

export interface ProofReportIntegrity {
  ledgerValid: boolean;
  receiptChainValid: boolean;
  eventCount: number;
  receiptCount: number;
}

export interface ProofReport {
  runId: string;
  tenantId: TenantId;
  leadId: string;
  outcome: RunState;
  startedAt: string;
  finishedAt: string;
  states: RunState[];
  receipts: ProofReceipt[];
  blockedReasons: string[];
  approval: { status: 'approved' | 'rejected'; approver: string | null } | null;
  idempotencyKeys: string[];
  integrity: ProofReportIntegrity;
  /** True when neither the full ledger nor the receipts contain raw PII. */
  noRawPii: boolean;
}

function str(detail: Record<string, unknown>, key: string): string | null {
  const value = detail[key];
  return typeof value === 'string' ? value : null;
}

export function generateProofReport(
  run: {
    id: string;
    tenantId: TenantId;
    leadId: string;
    state: RunState;
    receipts: ProofReceipt[];
    createdAt: string;
  },
  ledger: AppendOnlyLedger,
): ProofReport {
  const runEvents = ledger.forRun(run.id);
  const states = run.receipts.map((r) => r.toState);

  const blockedReasons = [
    ...new Set(
      run.receipts
        .filter((r) => r.decision === 'blocked' || r.decision === 'rejected')
        .flatMap((r) => r.reasons),
    ),
  ];

  let approval: ProofReport['approval'] = null;
  const idempotencyKeys = new Set<string>();
  for (const event of runEvents) {
    if (event.kind === 'approval.granted') {
      approval = { status: 'approved', approver: str(event.detail, 'approver') };
    } else if (event.kind === 'approval.rejected') {
      approval = { status: 'rejected', approver: str(event.detail, 'approver') };
    } else if (event.kind === 'crm.upserted' || event.kind === 'crm.idempotent_replay') {
      const key = str(event.detail, 'externalKey');
      if (key) idempotencyKeys.add(`crm:${key}`);
    } else if (
      event.kind === 'appointment.booked' ||
      event.kind === 'appointment.idempotent_replay'
    ) {
      idempotencyKeys.add(`appointment:${run.id}`);
    }
  }

  const ledgerCheck = verifyLedger(ledger.all());
  const receiptCheck = verifyReceiptChain(run.receipts);
  const noRawPii =
    scanForRawPii(ledger.all() as unknown).length === 0 &&
    scanForRawPii(run.receipts as unknown).length === 0;

  const lastReceipt = run.receipts[run.receipts.length - 1];
  return {
    runId: run.id,
    tenantId: run.tenantId,
    leadId: run.leadId,
    outcome: run.state,
    startedAt: run.createdAt,
    finishedAt: lastReceipt ? lastReceipt.at : run.createdAt,
    states,
    receipts: run.receipts.slice(),
    blockedReasons,
    approval,
    idempotencyKeys: [...idempotencyKeys],
    integrity: {
      ledgerValid: ledgerCheck.valid,
      receiptChainValid: receiptCheck.valid,
      eventCount: runEvents.length,
      receiptCount: run.receipts.length,
    },
    noRawPii,
  };
}

/** Render a run's proof report as an operator-readable Markdown timeline. */
export function renderRunTimeline(report: ProofReport): string {
  const lines: string[] = [];
  lines.push(`# Proof timeline — run ${report.runId}`);
  lines.push('');
  lines.push(`- tenant: \`${report.tenantId}\``);
  lines.push(`- lead: \`${report.leadId}\``);
  lines.push(`- outcome: **${report.outcome}**`);
  if (report.approval) {
    lines.push(
      `- approval: **${report.approval.status}** by \`${report.approval.approver ?? 'n/a'}\``,
    );
  }
  if (report.blockedReasons.length > 0) {
    lines.push(`- blocked reasons: ${report.blockedReasons.map((r) => `\`${r}\``).join(', ')}`);
  }
  lines.push('');
  lines.push('| # | from → to | decision | reasons | receipt |');
  lines.push('| - | --------- | -------- | ------- | ------- |');
  for (const r of report.receipts) {
    const from = r.fromState ?? '∅';
    const reasons = r.reasons.length > 0 ? r.reasons.join(', ') : '—';
    lines.push(
      `| ${r.seq} | ${from} → ${r.toState} | ${r.decision} | ${reasons} | \`${r.receiptHash.slice(0, 12)}…\` |`,
    );
  }
  lines.push('');
  lines.push('## Integrity');
  lines.push(`- ledger hash-chain valid: ${report.integrity.ledgerValid ? '✅' : '❌'}`);
  lines.push(`- receipt chain valid: ${report.integrity.receiptChainValid ? '✅' : '❌'}`);
  lines.push(`- no raw PII: ${report.noRawPii ? '✅' : '❌'}`);
  lines.push(`- ledger events (run): ${report.integrity.eventCount}`);
  lines.push(`- proof receipts: ${report.integrity.receiptCount}`);
  if (report.idempotencyKeys.length > 0) {
    lines.push(`- idempotency keys: ${report.idempotencyKeys.map((k) => `\`${k}\``).join(', ')}`);
  }
  return lines.join('\n');
}
