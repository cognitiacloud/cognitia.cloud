import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers, type ApiRequest } from './handlers.js';
import { TENANT_SPECS } from './tenantProvisioning.js';

/**
 * COG-012 — tenant provisioning foundation. One GTM Control Plane, four
 * mapped tenants (MoverOS Tenant Zero, Demandara, Skillucate, AlphaInvesto):
 * owner-only, idempotent, bootstraps agents + ATCs + Core 20 inside the NEW
 * tenant's scope with deny-by-default real-send permissions, and the
 * AlphaInvesto spec carries the strict no-investment-claims guardrail.
 */

const ACTING_TENANT = '11111111-1111-1111-1111-111111111111';

const asRole = (
  role: 'viewer' | 'operator' | 'owner',
  over: Partial<ApiRequest> = {},
): ApiRequest => ({ tenantId: ACTING_TENANT, role, traceId: 'trace-provision', ...over });

describe('Tenant provisioning (COG-012)', () => {
  let handlers: ApiHandlers;
  let repo: InMemoryRepository;

  beforeEach(() => {
    repo = new InMemoryRepository();
    handlers = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }));
  });

  const provision = (slug: string) => handlers.provisionTenant(asRole('owner', { body: { slug } }));

  it('provisions all four mapped tenants with their specs (#moveros #demandara #skillucate #alphainvesto)', async () => {
    for (const slug of ['moveros', 'demandara', 'skillucate', 'alphainvesto']) {
      const res = await provision(slug);
      expect(res.status).toBe(201);
      const body = res.body as {
        tenant: { id: string; slug: string; settings: Record<string, unknown> };
        agents_created: number;
        atcs_issued: number;
        skills_imported: number;
      };
      expect(body.tenant.slug).toBe(slug);
      expect(body.agents_created).toBe(1);
      expect(body.atcs_issued).toBe(1);
      expect(body.skills_imported).toBe(20);

      // Bootstrap landed in the NEW tenant: agent with deny-by-default SMS.
      const agents = await repo.listAgents(body.tenant.id);
      expect(agents).toHaveLength(1);
      const perms = await repo.listAgentPermissions(body.tenant.id, agents[0]!.id);
      expect(perms.find((p) => p.action_key === 'sms.send_real')?.effect).toBe('deny');
      const atcs = await repo.listAtcsByAgent(body.tenant.id, agents[0]!.id);
      expect(atcs[0]!.status).toBe('active');
      expect((atcs[0]!.claims as { scope: string[] }).scope).toEqual(
        TENANT_SPECS[slug]!.default_agents[0]!.atc_scopes,
      );
      // Spec metadata persisted on the tenant row.
      expect(body.tenant.settings.vertical).toBe(TENANT_SPECS[slug]!.vertical);
    }
    // Nothing leaked into the ACTING tenant.
    expect(await repo.listAgents(ACTING_TENANT)).toHaveLength(0);
    expect(await repo.listSkills(ACTING_TENANT)).toHaveLength(0);
  });

  it('MoverOS is Tenant Zero: moving vertical, front-desk agent, rescue metrics', () => {
    const spec = TENANT_SPECS.moveros!;
    expect(spec.display_name).toContain('Tenant Zero');
    expect(spec.vertical).toBe('moving-services');
    expect(spec.default_agents[0]!.kind).toBe('front_desk');
    expect(spec.outcome_metrics).toContain('verified_booked_value_cents');
  });

  it('AlphaInvesto carries the strict no-investment-claims guardrail (#compliance)', async () => {
    const spec = TENANT_SPECS.alphainvesto!;
    expect(spec.forbid_financial_claims).toBe(true);
    expect(spec.guardrails.join(' ')).toMatch(/no investment advice/i);
    expect(spec.compliance_notes.join(' ')).toMatch(/never advice/i);

    const res = await provision('alphainvesto');
    const tenant = (res.body as { tenant: { settings: Record<string, unknown> } }).tenant;
    expect(tenant.settings.forbid_financial_claims).toBe(true);
  });

  it('is idempotent and owner-only; unknown specs are 404', async () => {
    await provision('moveros');
    const again = await provision('moveros');
    expect(again.status).toBe(200);
    expect((again.body as { already_existed: boolean }).already_existed).toBe(true);
    expect((again.body as { agents_created: number }).agents_created).toBe(0);

    await expect(
      handlers.provisionTenant(asRole('operator', { body: { slug: 'moveros' } })),
    ).rejects.toMatchObject({ status: 403 });
    await expect(provision('not-a-tenant')).rejects.toMatchObject({ status: 404 });
  });

  it('listTenants reports specs + provisioning state (owner-only)', async () => {
    await provision('moveros');
    const res = await handlers.listTenants(asRole('owner'));
    const rows = (res.body as { tenants: Array<{ spec: { slug: string }; provisioned: boolean }> })
      .tenants;
    expect(rows).toHaveLength(4);
    expect(rows.find((r) => r.spec.slug === 'moveros')?.provisioned).toBe(true);
    expect(rows.find((r) => r.spec.slug === 'demandara')?.provisioned).toBe(false);
    await expect(handlers.listTenants(asRole('operator'))).rejects.toMatchObject({ status: 403 });
  });
});
