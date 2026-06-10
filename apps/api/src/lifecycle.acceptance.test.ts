import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryRepository,
  type AccountRow,
  type ContactRow,
  type IntegrationConnectionRow,
} from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { FakeHubspotClient } from '@cognitia/integrations';
import { ApiHandlers } from './handlers.js';
import type { PreflightReport } from './preflight.js';
import type { TrustPacket } from './trustPacket.js';
import type { TrustMetrics } from './trustMetrics.js';

/**
 * ALPHA-1 — the full-lifecycle acceptance test: the ENTIRE governed CRM
 * action loop in one CI-enforced journey, asserting every accountability
 * artifact along the way. This is the product-truth test an honest evaluator
 * runs first: if any stage of the governed lifecycle silently regresses —
 * preflight safety, preview parity, approval gating, audited denials,
 * idempotent execution, the kill switch, accountable undo, the rejection
 * flywheel, live metrics, the audit trail, or the trust packet — this fails.
 *
 * Journey:
 *   sync'd tenant → readiness READY → preflight (zero writes) → propose →
 *   preview → execute-before-approve DENIED (audited) → approve (reason) →
 *   execute (one provenance-stamped write) → re-execute (idempotent) →
 *   kill-switch pause halts rollback (audited) → owner resume → undo
 *   (archived + labeled + audited) → reject second action (reason) →
 *   regression candidate (anonymized) → metrics/audit/packet reflect it all.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const ts = '2026-06-10T00:00:00.000Z';

function account(id: string, name: string): AccountRow {
  return {
    id,
    tenant_id: TENANT,
    name,
    domain: `${name.toLowerCase().replace(/ /g, '')}.com`,
    industry: 'SaaS',
    employee_count: 150,
    region: 'NA',
    fit_score: 0.9,
    timing_score: 0.8,
    attributes: {},
    created_at: ts,
    updated_at: ts,
  };
}

describe('ALPHA-1 — full governed lifecycle (acceptance)', () => {
  let handlers: ApiHandlers;
  let repo: InMemoryRepository;
  let hubspot: FakeHubspotClient;

  beforeEach(() => {
    repo = new InMemoryRepository();
    repo.seedAccount(account('acc-1', 'Acme Live'));
    repo.seedAccount(account('acc-2', 'Globex Live'));
    const contact: ContactRow = {
      id: 'ct-1',
      tenant_id: TENANT,
      account_id: 'acc-1',
      full_name: 'Live Champion',
      title: 'VP Ops',
      persona: 'champion',
      email_hash: 'sha256:livechampion',
      phone_hash: null,
      is_suppressed: false,
      attributes: {},
      created_at: ts,
      updated_at: ts,
    };
    repo.seedContact(contact);
    const conn: IntegrationConnectionRow = {
      id: 'conn-1',
      tenant_id: TENANT,
      external_system: 'hubspot',
      status: 'active',
      credential_ref: 'cred-1',
      metadata: {},
      created_at: ts,
      updated_at: ts,
    };
    repo.seedIntegrationConnection(conn);
    hubspot = new FakeHubspotClient();
    handlers = new ApiHandlers(
      repo,
      createGtmServices({ repo, v1Mode: true, hubspotClient: hubspot }),
      {
        hubspotClient: hubspot,
      },
    );
  });

  it('runs the entire governed loop and leaves the complete artifact trail', async () => {
    const op = { tenantId: TENANT, role: 'operator' as const };
    const owner = { tenantId: TENANT, role: 'owner' as const };

    // ---- 0. Readiness gate: portal configured, connection active. ----
    const ready = await handlers.integrationReadiness(op);
    expect(ready.status).toBe(200);
    expect((ready.body as { ready: boolean }).ready).toBe(true);

    // ---- 1. Preflight: the real runtime, zero writes. ----
    const pf = await handlers.preflightMira({ ...op, body: {} });
    const report = pf.body as PreflightReport;
    expect(report.writes_performed).toBe(0);
    expect(report.proposals.length).toBe(2); // both fit accounts
    expect(await repo.listAgentActions(TENANT)).toHaveLength(0); // nothing persisted

    // ---- 2. Propose for real. ----
    await handlers.runMira({ ...op, body: {} });
    const list = await handlers.listAgentActions({ tenantId: TENANT });
    const actions = (list.body as { actions: Array<{ id: string; target_ref: string }> }).actions;
    expect(actions).toHaveLength(2);
    const first = actions[0]!;
    const second = actions[1]!;

    // ---- 3. Preview shows the exact write before any consent. ----
    const preview = await handlers.previewAction({ tenantId: TENANT, params: { id: first.id } });
    const plan = (preview.body as { plan: { properties: Record<string, unknown> } }).plan;
    expect(plan.properties['hs_task_subject']).toBeDefined();
    expect((preview.body as { would_execute: boolean }).would_execute).toBe(false);

    // ---- 4. Execute before approval is DENIED and audited. ----
    const premature = await handlers.executeAction({ ...op, params: { id: first.id } });
    expect(premature.status).toBe(409);
    expect(hubspot.writeLog).toHaveLength(0);

    // ---- 5. Approve with a mandatory structured reason. ----
    await handlers.approveAction({
      ...op,
      params: { id: first.id },
      body: { reason: { reason_code: 'meets_playbook' } },
    });

    // ---- 6. Execute: exactly one provenance-stamped write; preview parity. ----
    const exec = await handlers.executeAction({ ...op, params: { id: first.id } });
    expect(exec.status).toBe(200);
    expect(hubspot.writeLog).toHaveLength(1);
    const sentContent = hubspot.writeLog[0]!.input.payload;
    for (const [k, v] of Object.entries(sentContent)) {
      expect(plan.properties[k], `preview/write parity on ${k}`).toEqual(v);
    }
    expect(hubspot.writeLog[0]!.input.provenance?.approved_by).toBe('user:operator');

    // ---- 7. Re-execute is an idempotent no-op. ----
    const again = await handlers.executeAction({ ...op, params: { id: first.id } });
    expect(again.status).toBe(200);
    expect(hubspot.writeLog).toHaveLength(1); // still exactly one

    // ---- 8. Kill switch halts even rollback; resume is owner-only. ----
    await handlers.pauseIntegration({ ...op, params: { system: 'hubspot' } });
    const haltedUndo = await handlers.rollbackAction({
      ...op,
      params: { id: first.id },
      body: { reason: { reason_code: 'wrong_target' } },
    });
    expect(haltedUndo.status).toBe(409);
    expect(hubspot.archiveLog).toHaveLength(0);
    await expect(
      handlers.resumeIntegration({ ...op, params: { system: 'hubspot' } }),
    ).rejects.toMatchObject({ status: 403 }); // operator cannot resume
    await handlers.resumeIntegration({ ...owner, params: { system: 'hubspot' } });

    // ---- 9. Undo: archived, labeled, audited — as accountable as execution. ----
    const undo = await handlers.rollbackAction({
      ...op,
      params: { id: first.id },
      body: { reason: { reason_code: 'wrong_target' } },
    });
    expect(undo.status).toBe(200);
    expect(hubspot.archiveLog).toHaveLength(1);

    // ---- 10. Reject the second action; export the regression candidate. ----
    await handlers.rejectAction({
      ...op,
      params: { id: second.id },
      body: { reason: { reason_code: 'duplicate_or_stale' } },
    });
    const candidate = await handlers.regressionCandidate({
      tenantId: TENANT,
      params: { id: second.id },
    });
    expect(candidate.status).toBe(200);
    const candidateJson = JSON.stringify(candidate.body);
    expect(candidateJson).not.toContain('Acme Live'); // anonymized
    expect(candidateJson).not.toContain('Globex Live');

    // ---- 11. Live trust metrics reflect every stage. ----
    const metrics = (await handlers.metricsTrust({ tenantId: TENANT })).body as TrustMetrics;
    expect(metrics.actions).toMatchObject({ approved: 1, rejected: 1, rolled_back: 1 });
    expect(metrics.approval_rate).toBe(0.5);

    // ---- 12. The audit trail contains the COMPLETE accountability census. ----
    const audit = (await handlers.auditTrail({ tenantId: TENANT })).body as {
      events: Array<{ action: string }>;
    };
    const auditActions = audit.events.map((e) => e.action);
    for (const required of [
      'proposed',
      'execution_denied', // step 4
      'approved',
      'executed',
      'integration_paused',
      'rollback_denied', // step 8 (halted)
      'integration_resumed',
      'rolled_back',
      'rejected',
    ]) {
      expect(auditActions, `audit trail must contain "${required}"`).toContain(required);
    }

    // ---- 13. The exportable trust packet reflects it all, with a live eval run. ----
    const packet = (await handlers.trustPacket({ tenantId: TENANT })).body as TrustPacket;
    expect(packet.metrics.actions).toMatchObject({ approved: 1, rejected: 1, rolled_back: 1 });
    expect(packet.decisions).toHaveLength(3); // approved + rejected + rolled_back labels
    expect(packet.integration).toMatchObject({ status: 'active', kill_switch_enforced: true });
    expect(packet.eval_gate.run_at_export.failed).toBe(0);
    expect(packet.audit_trail.length).toBeGreaterThanOrEqual(9);
  });
});
