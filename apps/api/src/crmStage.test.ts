import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  InMemoryRepository,
  type EventRow,
  type OpportunityRow,
  type AccountRow,
} from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { FakeHubspotClient } from '@cognitia/integrations';
import { ApiHandlers, type ApiRequest } from './handlers.js';
import { grantMiraExecution } from './passportTestKit.js';
import { STAGE_ADVANCE_RULE } from './stageReview.js';

/**
 * CRM-2 — approval-gated stage-update write-back, end to end. Signal (booked
 * meeting on the event stream) → proposed crm.stage.update (medium risk: never
 * auto-approved) → human approval → ONE idempotent write →
 * crm.opportunity.stage_updated.v1; crm.push.failed.v1 on adapter error;
 * rollback restores the prior stage. Preview==write holds via payload_ref.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const ts = '2026-06-10T00:00:00.000Z';
const OPP_ID = 'aaaaaaaa-1111-2222-3333-444444444444';
const EXTERNAL_DEAL = 'deal-77';

function seedOpportunity(
  repo: InMemoryRepository,
  stage: string = STAGE_ADVANCE_RULE.from_stage,
): void {
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
  const opp: OpportunityRow = {
    id: OPP_ID,
    tenant_id: TENANT,
    account_id: 'acc-1',
    name: 'Acme Expansion',
    stage,
    amount: 50000,
    owner_ref: null,
    attributes: {},
    created_at: ts,
    updated_at: ts,
  };
  repo.seedOpportunity(opp);
}

function event(name: string, payload: Record<string, unknown>, occurredAt = ts): EventRow {
  return {
    id: randomUUID(),
    tenant_id: TENANT,
    event_name: name,
    entity_type: 'opportunity',
    entity_id: OPP_ID,
    source: 'test',
    occurred_at: occurredAt,
    ingested_at: occurredAt,
    payload,
    trace_id: 'trace-stage',
    created_at: occurredAt,
  };
}

/** Synced external id + the booked-meeting signal on the immutable stream. */
async function seedSignal(repo: InMemoryRepository): Promise<void> {
  await repo.insertEvent(event('crm.opportunity.created.v1', { external_id: EXTERNAL_DEAL }));
  await repo.insertEvent(
    event(
      STAGE_ADVANCE_RULE.signal,
      { meeting_ref: 'meeting:booked-1' },
      '2026-06-11T00:00:00.000Z',
    ),
  );
}

const operator = (over: Partial<ApiRequest> = {}): ApiRequest => ({
  tenantId: TENANT,
  role: 'operator',
  userRef: 'olivia',
  traceId: 'trace-stage',
  ...over,
});
const owner = (over: Partial<ApiRequest> = {}): ApiRequest => operator({ role: 'owner', ...over });

interface Stack {
  repo: InMemoryRepository;
  client: FakeHubspotClient;
  handlers: ApiHandlers;
}

function makeStack(): Stack {
  const repo = new InMemoryRepository();
  const client = new FakeHubspotClient();
  client.deals = [{ externalId: EXTERNAL_DEAL, stage: STAGE_ADVANCE_RULE.from_stage }];
  const handlers = new ApiHandlers(
    repo,
    createGtmServices({ repo, v1Mode: true, hubspotClient: client }),
  );
  return { repo, client, handlers };
}

async function proposeOne(s: Stack): Promise<string> {
  const res = await s.handlers.stageReview(operator());
  const body = res.body as { proposedActionIds: string[] };
  expect(body.proposedActionIds).toHaveLength(1);
  return body.proposedActionIds[0]!;
}

const approve = (s: Stack, id: string) =>
  s.handlers.approveAction(
    operator({ params: { id }, body: { reason: { reason_code: 'meets_playbook' } } }),
  );
const execute = (s: Stack, id: string) => s.handlers.executeAction(operator({ params: { id } }));

describe('CRM-2 — signal → proposed stage update', () => {
  let s: Stack;
  beforeEach(() => {
    s = makeStack();
    seedOpportunity(s.repo);
  });

  it('a booked-meeting signal proposes one medium-risk, approval-gated update', async () => {
    await seedSignal(s.repo);
    const id = await proposeOne(s);
    const action = await s.repo.getAgentAction(TENANT, id);
    expect(action!.action_type).toBe('crm.stage.update');
    expect(action!.risk_level).toBe('medium');
    expect(action!.approval_status).toBe('proposed');
    expect(action!.target_ref).toBe(`opportunity:${OPP_ID}`);
    // The typed plan was resolved from synced facts at proposal time.
    expect(action!.payload_ref).toBe(
      `stage:${EXTERNAL_DEAL}:${STAGE_ADVANCE_RULE.from_stage}:${STAGE_ADVANCE_RULE.to_stage}`,
    );
    // Grounded: the signal event is the evidence.
    expect(action!.evidence_refs).toHaveLength(1);
  });

  it('no signal ⇒ no proposal; wrong stage or missing external id ⇒ skipped with reason', async () => {
    // No events at all.
    let res = await s.handlers.stageReview(operator());
    expect((res.body as { proposedActionIds: string[] }).proposedActionIds).toHaveLength(0);

    // Signal exists but the opportunity already advanced.
    const advanced = makeStack();
    seedOpportunity(advanced.repo, 'meeting_scheduled');
    await seedSignal(advanced.repo);
    res = await advanced.handlers.stageReview(operator());
    let body = res.body as { proposedActionIds: string[]; skipped: Array<{ reason: string }> };
    expect(body.proposedActionIds).toHaveLength(0);
    expect(body.skipped[0]!.reason).toBe('stage_is_meeting_scheduled');

    // Signal exists but no synced external id ⇒ refuse rather than guess.
    const unsynced = makeStack();
    seedOpportunity(unsynced.repo);
    await unsynced.repo.insertEvent(event(STAGE_ADVANCE_RULE.signal, {}));
    res = await unsynced.handlers.stageReview(operator());
    body = res.body as { proposedActionIds: string[]; skipped: Array<{ reason: string }> };
    expect(body.proposedActionIds).toHaveLength(0);
    expect(body.skipped[0]!.reason).toBe('external_id_unresolved');
  });

  it('replayed review collapses to the same proposal (idempotent)', async () => {
    await seedSignal(s.repo);
    const first = await proposeOne(s);
    const second = await proposeOne(s);
    expect(second).toBe(first);
  });

  it('stage review is operator-gated (viewer 403)', async () => {
    const err = await s.handlers.stageReview(operator({ role: 'viewer' })).catch((e) => e);
    expect(err.status).toBe(403);
  });
});

describe('CRM-2 — approve → one idempotent write → events → rollback', () => {
  let s: Stack;
  let actionId: string;

  beforeEach(async () => {
    s = makeStack();
    seedOpportunity(s.repo);
    await seedSignal(s.repo);
    await grantMiraExecution(s.repo, TENANT, {
      riskMax: 'medium',
      extraScopes: [{ actionType: 'crm.stage.update', integration: 'hubspot' }],
    });
    actionId = await proposeOne(s);
  });

  it('refuses execution before approval (409) — approval-gated', async () => {
    const err = await execute(s, actionId).catch((e) => e);
    expect(err.status).toBe(409);
    expect(s.client.dealStageLog).toHaveLength(0);
  });

  it('approve → execute performs exactly ONE write; replay is idempotent', async () => {
    await approve(s, actionId);
    const res = await execute(s, actionId);
    expect(res.status).toBe(200);
    expect(s.client.dealStageLog).toEqual([
      { externalId: EXTERNAL_DEAL, stage: STAGE_ADVANCE_RULE.to_stage },
    ]);
    expect(s.client.deals[0]!.stage).toBe(STAGE_ADVANCE_RULE.to_stage);

    // Replay: ledger guard collapses it — still one write.
    await execute(s, actionId);
    expect(s.client.dealStageLog).toHaveLength(1);

    // crm.opportunity.stage_updated.v1 emitted with the typed transition.
    const events = await s.repo.listEvents(TENANT);
    const updated = events.filter((e) => e.event_name === 'crm.opportunity.stage_updated.v1');
    expect(updated).toHaveLength(1);
    expect(updated[0]!.payload).toEqual({
      external_id: EXTERNAL_DEAL,
      from_stage: STAGE_ADVANCE_RULE.from_stage,
      to_stage: STAGE_ADVANCE_RULE.to_stage,
    });
  });

  it('adapter failure emits crm.push.failed.v1 and marks the action failed', async () => {
    await approve(s, actionId);
    s.client.updateDealStage = () => Promise.reject(new Error('hubspot 500'));
    const err = await execute(s, actionId).catch((e) => e);
    expect(err.status).toBeDefined();

    const action = await s.repo.getAgentAction(TENANT, actionId);
    expect(action!.execution_status).toBe('failed');
    const events = await s.repo.listEvents(TENANT);
    const pushFailed = events.filter((e) => e.event_name === 'crm.push.failed.v1');
    expect(pushFailed).toHaveLength(1);
    expect(pushFailed[0]!.payload).toEqual({
      action_type: 'crm.stage.update',
      reason: 'adapter_error',
    });
  });

  it('rollback restores the prior stage (reversible write, structured reason)', async () => {
    await approve(s, actionId);
    await execute(s, actionId);
    expect(s.client.deals[0]!.stage).toBe(STAGE_ADVANCE_RULE.to_stage);

    const res = await s.handlers.rollbackAction(
      owner({ params: { id: actionId }, body: { reason: { reason_code: 'wrong_target' } } }),
    );
    expect(res.status).toBe(200);
    expect(s.client.deals[0]!.stage).toBe(STAGE_ADVANCE_RULE.from_stage);
    const action = await s.repo.getAgentAction(TENANT, actionId);
    expect(action!.execution_status).toBe('rolled_back');
  });
});
