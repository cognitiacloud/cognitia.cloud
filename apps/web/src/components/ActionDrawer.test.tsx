// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import axe from 'axe-core';
import { ActionDrawer } from './ActionDrawer';

/**
 * Drawer is the decision surface shared by the Approvals queue and Run detail.
 * These tests pin the two behaviours that protect governance: the structured
 * reason-code rule (note required for "Other") and that a server 403 is surfaced
 * as "operator role required" rather than swallowed — i.e. authz is not weakened
 * client-side, it is honestly reflected.
 */

const RATIONALE = {
  action_id: 'a1',
  target_ref: 'account:acme',
  account: { id: 'acc1', name: 'Acme', industry: 'SaaS', employee_count: 200, region: 'NA' },
  score: { fit: 0.9, timing: 0.8, combined: 0.86 },
  evidence: [{ claim: 'Acme operates in SaaS', source_ref: 'account:acc1#industry', score: 0.9 }],
  evidence_refs_on_action: 2,
  freshness: {
    data_updated_at: '2026-06-01T00:00:00.000Z',
    age_days: 9,
    proposed_at: '2026-06-05T00:00:00.000Z',
    stale_since_proposal: false,
  },
};
const PREVIEW = {
  action_id: 'a1',
  action_type: 'crm.task.create',
  target_ref: 'account:acme',
  risk_level: 'high',
  approval_status: 'proposed',
  execution_status: 'pending',
  would_execute: false,
  denial_reason: 'not_approved',
  idempotent_replay_expected: false,
  guardrail_results: [],
  evidence_refs: ['e1', 'e2'],
  plan: {
    system: 'hubspot',
    object: 'tasks',
    operation: 'create',
    target_ref: 'account:acme',
    idempotency_key: 'k1',
    idempotency_property: 'hs_idempotency',
    properties: { hs_task_subject: 'Follow up with Acme' },
  },
};

function stubFetch(
  decision?: (url: string, init?: RequestInit) => { status: number; body: unknown },
) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/rationale'))
        return { status: 200, json: async () => RATIONALE } as Response;
      if (url.includes('/preview')) return { status: 200, json: async () => PREVIEW } as Response;
      const d = decision?.(url, init) ?? { status: 200, body: { id: 'a1' } };
      return { status: d.status, json: async () => d.body } as Response;
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ActionDrawer', () => {
  it('renders evidence + write preview context, with no serious axe violations', async () => {
    stubFetch();
    const { container } = render(
      <ActionDrawer
        actionId="a1"
        approvalStatus="proposed"
        executionStatus="pending"
        actionType="crm.task.create"
        riskLevel="high"
        targetRef="account:acme"
        onClose={() => {}}
      />,
    );
    await screen.findByText('Acme operates in SaaS');
    expect(screen.getByText('hs_task_subject')).toBeTruthy();
    expect(screen.getByText('Follow up with Acme')).toBeTruthy();

    const results = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });
    const blocking = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(blocking.map((v) => v.id)).toEqual([]);
  });

  it('requires a note when the reason code is "other" before approve can submit', async () => {
    stubFetch();
    render(
      <ActionDrawer
        actionId="a1"
        approvalStatus="proposed"
        executionStatus="pending"
        onClose={() => {}}
      />,
    );
    await screen.findByText('Acme operates in SaaS');

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    const select = screen.getByLabelText(/reason code/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'other' } });

    const confirm = screen.getByRole('button', { name: 'Confirm approve' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); // note required for "other"

    fireEvent.change(screen.getByLabelText(/note/i), { target: { value: 'manually verified' } });
    expect(confirm.disabled).toBe(false);
  });

  it('surfaces a 403 as "operator role required" (authz not weakened)', async () => {
    stubFetch((url) =>
      url.includes('/approve')
        ? { status: 403, body: { error: 'forbidden' } }
        : { status: 200, body: { id: 'a1' } },
    );
    render(
      <ActionDrawer
        actionId="a1"
        approvalStatus="proposed"
        executionStatus="pending"
        onClose={() => {}}
      />,
    );
    await screen.findByText('Acme operates in SaaS');

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    fireEvent.change(screen.getByLabelText(/reason code/i), {
      target: { value: 'accurate_and_relevant' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm approve' }));

    expect(await screen.findByText(/operator role required/i)).toBeTruthy();
  });

  it('offers Undo on an executed action', async () => {
    stubFetch();
    render(
      <ActionDrawer
        actionId="a1"
        approvalStatus="approved"
        executionStatus="executed"
        onClose={() => {}}
      />,
    );
    await screen.findByText('Acme operates in SaaS');
    expect(screen.getByRole('button', { name: 'Undo write' })).toBeTruthy();
  });

  it('offers no decision on a rejected action', async () => {
    stubFetch();
    render(
      <ActionDrawer
        actionId="a1"
        approvalStatus="rejected"
        executionStatus="pending"
        onClose={() => {}}
      />,
    );
    await screen.findByText('Acme operates in SaaS');
    const foot = document.querySelector('.drawer-foot') as HTMLElement;
    expect(within(foot).getByText(/no decision available/i)).toBeTruthy();
  });
});
