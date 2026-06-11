import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers, type ApiRequest } from './handlers.js';

/**
 * COG-004 — Agent Trust Credential lifecycle at the API surface:
 * deny-by-default real SMS on registration, strict (PII-rejecting) claims,
 * explicit status transitions with revoked-terminal, owner-only revoke and
 * owner-only sms.send_real escalation, audit on every mutation.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';

const asRole = (
  role: 'viewer' | 'operator' | 'owner',
  over: Partial<ApiRequest> = {},
): ApiRequest => ({
  tenantId: TENANT,
  role,
  traceId: 'trace-atc',
  ...over,
});

describe('Agent Trust Credential (COG-004)', () => {
  let handlers: ApiHandlers;
  let repo: InMemoryRepository;

  beforeEach(() => {
    repo = new InMemoryRepository();
    handlers = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }));
  });

  const register = async (over: Record<string, unknown> = {}) => {
    const res = await handlers.registerAgent(
      asRole('operator', {
        body: { name: 'Front Desk', slug: 'front-desk', kind: 'front_desk', ...over },
      }),
    );
    return (res.body as { agent: { id: string } }).agent.id;
  };

  const issue = async (agentId: string, body: Record<string, unknown> = {}) => {
    const res = await handlers.issueAtc(asRole('operator', { params: { id: agentId }, body }));
    return (res.body as { atc: { id: string; status: string } }).atc;
  };

  it('registration seeds sms.send_real → deny and writes audit', async () => {
    const agentId = await register();
    const perms = await handlers.listAgentPermissions(
      asRole('viewer', { params: { id: agentId } }),
    );
    const rows = (perms.body as { permissions: Array<{ action_key: string; effect: string }> })
      .permissions;
    expect(rows).toEqual([
      expect.objectContaining({ action_key: 'sms.send_real', effect: 'deny' }),
    ]);
    const audits = await repo.listAuditEvents(TENANT);
    expect(audits.some((a) => a.action === 'agent.registered.v1')).toBe(true);
  });

  it('registration is role-gated and slug-unique', async () => {
    await expect(
      handlers.registerAgent(asRole('viewer', { body: { name: 'X', slug: 'x' } })),
    ).rejects.toMatchObject({ status: 403 });
    await register();
    await expect(register()).rejects.toMatchObject({ status: 409 });
  });

  it('ATC claims are strict: unknown keys (potential customer PII) are rejected', async () => {
    const agentId = await register();
    await expect(
      issue(agentId, { claims: { scope: ['lead.read'], customer_phone: '604-555-0123' } }),
    ).rejects.toMatchObject({ status: 400 });
    const atc = await issue(agentId, { claims: { scope: ['lead.read'], vertical: 'moveros' } });
    expect(atc.status).toBe('active');
  });

  it('lifecycle: suspend → resume works; illegal transitions are 409', async () => {
    const agentId = await register();
    const atc = await issue(agentId);

    // Cannot resume an active credential.
    await expect(
      handlers.atcTransition(asRole('operator', { params: { id: atc.id } }), 'resume'),
    ).rejects.toMatchObject({ status: 409 });

    const suspended = await handlers.atcTransition(
      asRole('operator', { params: { id: atc.id } }),
      'suspend',
    );
    expect((suspended.body as { atc: { status: string } }).atc.status).toBe('suspended');

    const resumed = await handlers.atcTransition(
      asRole('operator', { params: { id: atc.id } }),
      'resume',
    );
    expect((resumed.body as { atc: { status: string } }).atc.status).toBe('active');

    // Every transition wrote an audit row.
    const audits = await repo.listAuditEvents(TENANT);
    expect(audits.filter((a) => a.action === 'atc.suspend.v1')).toHaveLength(1);
    expect(audits.filter((a) => a.action === 'atc.resume.v1')).toHaveLength(1);
  });

  it('revoke is owner-only and terminal; no delete surface exists', async () => {
    const agentId = await register();
    const atc = await issue(agentId);

    await expect(
      handlers.atcTransition(asRole('operator', { params: { id: atc.id } }), 'revoke'),
    ).rejects.toMatchObject({ status: 403 });

    const revoked = await handlers.atcTransition(
      asRole('owner', { params: { id: atc.id } }),
      'revoke',
    );
    expect((revoked.body as { atc: { status: string } }).atc.status).toBe('revoked');

    // Terminal: no transition leaves revoked (suspend is an illegal 409;
    // resume hits the repo's revoked-terminal mirror as well).
    for (const action of ['suspend', 'resume', 'expire'] as const) {
      await expect(
        handlers.atcTransition(asRole('owner', { params: { id: atc.id } }), action),
      ).rejects.toMatchObject({ status: 409 });
    }

    const names = Object.getOwnPropertyNames(Object.getPrototypeOf(handlers));
    expect(names.some((n) => /atc|agent/i.test(n) && /delete/i.test(n))).toBe(false);
  });

  it('allowing sms.send_real is owner-only; deny stays operator-settable', async () => {
    const agentId = await register();

    await expect(
      handlers.putAgentPermissions(
        asRole('operator', {
          params: { id: agentId },
          body: { permissions: [{ action_key: 'sms.send_real', effect: 'allow' }] },
        }),
      ),
    ).rejects.toMatchObject({ status: 403 });

    const ownerSet = await handlers.putAgentPermissions(
      asRole('owner', {
        params: { id: agentId },
        body: {
          permissions: [
            {
              action_key: 'sms.send_real',
              effect: 'allow',
              constraints: { approval_required: true },
            },
          ],
        },
      }),
    );
    expect(ownerSet.status).toBe(200);

    // Operators may still tighten (deny) and manage other keys.
    const tightened = await handlers.putAgentPermissions(
      asRole('operator', {
        params: { id: agentId },
        body: {
          permissions: [
            { action_key: 'sms.send_real', effect: 'deny' },
            { action_key: 'sms.draft', effect: 'allow' },
          ],
        },
      }),
    );
    expect(tightened.status).toBe(200);
    const perms = await handlers.listAgentPermissions(
      asRole('viewer', { params: { id: agentId } }),
    );
    const byKey = new Map(
      (
        perms.body as { permissions: Array<{ action_key: string; effect: string }> }
      ).permissions.map((p) => [p.action_key, p.effect]),
    );
    expect(byKey.get('sms.send_real')).toBe('deny');
    expect(byKey.get('sms.draft')).toBe('allow');
  });

  it('agent list embeds newest ATC status; detail returns full history', async () => {
    const agentId = await register();
    expect(
      (
        (await handlers.listAgentsWithAtc(asRole('viewer'))).body as {
          agents: Array<{ atc_status: string }>;
        }
      ).agents[0]!.atc_status,
    ).toBe('none');

    await issue(agentId);
    const list = await handlers.listAgentsWithAtc(asRole('viewer'));
    expect((list.body as { agents: Array<{ atc_status: string }> }).agents[0]!.atc_status).toBe(
      'active',
    );

    const detail = await handlers.getAgentDetail(asRole('viewer', { params: { id: agentId } }));
    const body = detail.body as { atcs: unknown[]; permissions: unknown[] };
    expect(body.atcs).toHaveLength(1);
    expect(body.permissions).toHaveLength(1);

    await expect(
      handlers.getAgentDetail(asRole('viewer', { params: { id: 'missing' } })),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('agents and ATCs are tenant-scoped', async () => {
    await register();
    const other = await handlers.listAgentsWithAtc(
      asRole('viewer', { tenantId: '22222222-2222-2222-2222-222222222222' }),
    );
    expect((other.body as { agents: unknown[] }).agents).toHaveLength(0);
  });
});
