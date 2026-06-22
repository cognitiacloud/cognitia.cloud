import { describe, expect, it } from 'vitest';
import { createSalesCloserWorkflow, type WorkflowRun } from './salesCloserWorkflow.js';
import { createMockCloserPorts } from './mockPorts.js';
import type { ApprovalRequest, CloserPorts, CrmWritebackRequest } from './ports.js';
import { FIXTURE_LEAD } from './__fixtures__/lead.fixture.js';
import {
  DEFAULT_WORKSPACE_ID,
  WORKSPACES,
  WORKSPACE_IDS,
  assertWorkspaceId,
  getWorkspace,
  isSyntheticWorkspace,
  isWorkspaceId,
  type WorkspaceId,
} from './workspaces.js';

const FIXED_ID = '11111111-1111-1111-1111-111111111111';
const FIXED_NOW = new Date('2026-06-21T00:00:00.000Z');

/** Ports that record the requests they receive, over the default mock happy path. */
function recordingPorts(): {
  ports: CloserPorts;
  approvals: ApprovalRequest[];
  writebacks: CrmWritebackRequest[];
} {
  const base = createMockCloserPorts();
  const approvals: ApprovalRequest[] = [];
  const writebacks: CrmWritebackRequest[] = [];
  return {
    approvals,
    writebacks,
    ports: {
      ...base,
      approval: {
        requestApproval: async (request) => {
          approvals.push(request);
          return base.approval.requestApproval(request);
        },
      },
      crm: {
        writeback: async (request) => {
          writebacks.push(request);
          return base.crm.writeback(request);
        },
      },
    },
  };
}

function runIn(workspace: WorkspaceId, ports: CloserPorts): Promise<WorkflowRun> {
  let counter = 0;
  return createSalesCloserWorkflow({
    ports,
    workspace,
    now: () => FIXED_NOW,
    newId: () => `${FIXED_ID.slice(0, -1)}${counter++}`,
  }).run(FIXTURE_LEAD);
}

describe('workspace registry', () => {
  it('contains exactly the three internal demo tenants', () => {
    expect([...WORKSPACE_IDS].sort()).toEqual([
      'budget_wheels_demo',
      'cognitia_internal',
      'demandara_internal',
    ]);
  });

  it('every entry is self-consistent (key === record id)', () => {
    for (const id of WORKSPACE_IDS) {
      expect(getWorkspace(id).id).toBe(id);
    }
  });

  it('isWorkspaceId / assertWorkspaceId accept known ids and reject others', () => {
    expect(isWorkspaceId('cognitia_internal')).toBe(true);
    expect(isWorkspaceId('nope')).toBe(false);
    expect(isWorkspaceId(42)).toBe(false);
    expect(assertWorkspaceId('budget_wheels_demo')).toBe('budget_wheels_demo');
    expect(() => assertWorkspaceId('nope')).toThrow(/Unknown workspace id/);
  });

  it('budget_wheels_demo is the synthetic Tenant Zero sandbox, not a real customer', () => {
    const bw = getWorkspace('budget_wheels_demo');
    expect(bw.synthetic).toBe(true);
    expect(isSyntheticWorkspace('budget_wheels_demo')).toBe(true);
    expect(bw.kind).toBe('sandbox');
    expect(bw.label).toBe('Tenant Zero sandbox');
    expect(bw.consent).toBe('synthetic_no_consent_required');
    // Must not be presented as a real customer / "Client Zero".
    expect(bw.label).not.toMatch(/client zero/i);
    expect(`${bw.label} ${bw.notes}`).toMatch(/synthetic/i);
  });

  it('the internal venture workspaces are not synthetic', () => {
    expect(isSyntheticWorkspace('demandara_internal')).toBe(false);
    expect(isSyntheticWorkspace('cognitia_internal')).toBe(false);
  });

  it('the registry carries no raw PII (no emails or phone-like runs)', () => {
    const serialized = JSON.stringify(WORKSPACES);
    expect(serialized).not.toMatch(/@/);
    expect(serialized).not.toMatch(/\d{3}[^a-z0-9]?\d{3}[^a-z0-9]?\d{4}/i);
  });
});

describe('every mock run carries a workspace_id', () => {
  it('tags the run, approval, CRM writeback, and proofs for each workspace', async () => {
    for (const workspace of WORKSPACE_IDS) {
      const { ports, approvals, writebacks } = recordingPorts();
      const run = await runIn(workspace, ports);

      expect(run.status).toBe('completed');
      // 1) the run itself
      expect(run.workspaceId).toBe(workspace);
      // 2) the approval request
      expect(approvals).toHaveLength(1);
      expect(approvals[0]?.workspaceId).toBe(workspace);
      // 3) the CRM (mock) writeback request
      expect(writebacks).toHaveLength(1);
      expect(writebacks[0]?.workspaceId).toBe(workspace);
      // 4) every proof receipt — snake_case `workspace_id` in detailsPrivate
      expect(run.proofs.length).toBeGreaterThan(0);
      for (const proof of run.proofs) {
        expect(proof.detailsPrivate.workspace_id).toBe(workspace);
      }
    }
  });

  it('blocked and paused runs are still tagged with a workspace_id', async () => {
    const rejected = await createSalesCloserWorkflow({
      ports: createMockCloserPorts({ approval: { status: 'rejected' } }),
      workspace: 'demandara_internal',
      now: () => FIXED_NOW,
      newId: () => FIXED_ID,
    }).run(FIXTURE_LEAD);
    expect(rejected.status).toBe('blocked');
    expect(rejected.workspaceId).toBe('demandara_internal');

    const paused = await createSalesCloserWorkflow({
      ports: createMockCloserPorts({ approval: { status: 'pending' } }),
      workspace: 'budget_wheels_demo',
      now: () => FIXED_NOW,
      newId: () => FIXED_ID,
    }).run(FIXTURE_LEAD);
    expect(paused.status).toBe('awaiting_approval');
    expect(paused.workspaceId).toBe('budget_wheels_demo');
  });

  it('defaults to DEFAULT_WORKSPACE_ID when no workspace is supplied', async () => {
    let counter = 0;
    const run = await createSalesCloserWorkflow({
      ports: createMockCloserPorts(),
      now: () => FIXED_NOW,
      newId: () => `${FIXED_ID.slice(0, -1)}${counter++}`,
    }).run(FIXTURE_LEAD);
    expect(run.workspaceId).toBe(DEFAULT_WORKSPACE_ID);
    for (const proof of run.proofs) {
      expect(proof.detailsPrivate.workspace_id).toBe(DEFAULT_WORKSPACE_ID);
    }
  });

  it('introduces no contact PII into the run while tagging the workspace', async () => {
    const { ports } = recordingPorts();
    const run = await runIn('budget_wheels_demo', ports);
    const serialized = JSON.stringify(run);
    expect(serialized).not.toMatch(/@/);
    expect('contactEmail' in run.prospect).toBe(false);
    expect('contactPhone' in run.prospect).toBe(false);
  });
});
