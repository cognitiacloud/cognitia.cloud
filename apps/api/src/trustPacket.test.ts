import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { InMemoryRepository, type AccountRow } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers } from './handlers.js';
import { CONTROL_ATTESTATIONS, type TrustPacket } from './trustPacket.js';

/**
 * TRUST-2 — exportable trust packet. Honesty invariants under test:
 * numbers derive live from the ledger, every control attestation points at a
 * test file that actually exists in the repo (pointers cannot go stale), the
 * eval gate embedded in the packet is a real run, and no PII leaks.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const ts = '2026-06-10T00:00:00.000Z';
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

describe('GET /reports/trust-packet (TRUST-2)', () => {
  let handlers: ApiHandlers;
  let repo: InMemoryRepository;

  beforeEach(() => {
    repo = new InMemoryRepository();
    const account: AccountRow = {
      id: 'acc-1',
      tenant_id: TENANT,
      name: 'Acme',
      domain: 'acme.com',
      industry: 'SaaS',
      employee_count: 100,
      region: 'NA',
      fit_score: 0.9,
      timing_score: 0.8,
      attributes: {},
      created_at: ts,
      updated_at: ts,
    };
    repo.seedAccount(account);
    handlers = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }));
  });

  it('every control attestation cites test files that exist in the repo', () => {
    for (const control of CONTROL_ATTESTATIONS) {
      expect(control.enforced_by.length).toBeGreaterThan(0);
      for (const path of control.enforced_by) {
        expect(existsSync(join(REPO_ROOT, path)), `missing evidence file: ${path}`).toBe(true);
      }
    }
  });

  it('derives metrics/decisions/audits live from a real flow and embeds a real eval run', async () => {
    await handlers.runMira({ tenantId: TENANT, role: 'operator', body: {} });
    const list = await handlers.listAgentActions({ tenantId: TENANT });
    const id = (list.body as { actions: Array<{ id: string }> }).actions[0]!.id;
    await handlers.approveAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id },
      body: { reason: { reason_code: 'meets_playbook' } },
    });
    await handlers.executeAction({ tenantId: TENANT, role: 'operator', params: { id } });

    const res = await handlers.trustPacket({ tenantId: TENANT, role: 'viewer' });
    expect(res.status).toBe(200);
    const p = res.body as TrustPacket;
    expect(p.packet_version).toBe('trust-packet-v1');
    expect(p.metrics.actions.approved).toBe(1);
    expect(p.metrics.actions.executed).toBe(1);
    expect(p.decisions).toHaveLength(1);
    expect(p.decisions[0]!.reason_code).toBe('meets_playbook');
    // Audit trail covers the whole lifecycle: proposed, approved, executed.
    const auditActions = p.audit_trail.map((a) => a.action);
    for (const expected of ['proposed', 'approved', 'executed']) {
      expect(auditActions).toContain(expected);
    }
    // The embedded eval gate is a real run of the golden dataset — and green.
    expect(p.eval_gate.run_at_export.scenarios).toBeGreaterThanOrEqual(4);
    expect(p.eval_gate.run_at_export.failed).toBe(0);
    // Write contract lists the stamped properties.
    expect(p.write_contract.provenance_properties).toContain('cognitia_agent_action_id');
    expect(p.write_contract.idempotency_property).toBe('cognitia_idempotency_key');
  });

  it('contains no raw PII (no email-like strings anywhere)', async () => {
    await handlers.runMira({ tenantId: TENANT, role: 'operator', body: {} });
    const res = await handlers.trustPacket({ tenantId: TENANT });
    const json = JSON.stringify(res.body);
    expect(json).not.toMatch(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  });

  it('is tenant-scoped and requires auth', async () => {
    await expect(handlers.trustPacket({})).rejects.toMatchObject({ status: 401 });
    const other = await handlers.trustPacket({
      tenantId: '22222222-2222-2222-2222-222222222222',
    });
    expect((other.body as TrustPacket).metrics.actions.proposed).toBe(0);
    expect((other.body as TrustPacket).decisions).toHaveLength(0);
  });
});
