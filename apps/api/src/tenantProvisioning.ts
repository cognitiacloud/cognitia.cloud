import { randomUUID } from 'node:crypto';
import type { Repository, TenantRow } from '@cognitia/db';
import type { GtmServices } from '@cognitia/agents';
import { registerAgent, issueAtc } from './atc.js';
import { importCoreSkills } from './skillproof.js';

/**
 * COG-012 — Tenant provisioning foundation for the Cognitia GTM Control
 * Plane. One platform, many tenants (Architecture Lock A1): MoverOS is
 * Tenant Zero; Demandara, Skillucate, and AlphaInvesto are the next tenants.
 *
 * A tenant spec is the complete onboarding definition: identity, vertical,
 * default agents with ATC scopes, default skill set, proof categories,
 * outcome metrics, safety guardrails, and compliance notes. Provisioning is
 * OWNER-only and creates the tenant row (service-role/trusted path per 0001)
 * plus its default agents/ATCs (with deny-by-default real-send permissions
 * seeded by registerAgent) and the Core 20 skill base — all inside the NEW
 * tenant's RLS scope.
 */

export interface TenantSpec {
  slug: string;
  display_name: string;
  vertical: string;
  default_agents: Array<{
    name: string;
    slug: string;
    kind: 'front_desk' | 'internal_ops' | 'other';
    atc_scopes: string[];
  }>;
  /** 'core20' imports the standard internal skill base. */
  default_skills: 'core20' | 'none';
  proof_categories: string[];
  outcome_metrics: string[];
  /** Enforced platform-wide; restated per tenant for the onboarding record. */
  guardrails: string[];
  compliance_notes: string[];
  /** AlphaInvesto: hard content rule checked by callers producing copy. */
  forbid_financial_claims: boolean;
}

const BASE_GUARDRAILS = [
  'real SMS deny-by-default (sms.send_real owner-gated)',
  'human approval required for customer-facing actions',
  'raw PII confined to encrypted lead_intakes; masked everywhere else',
  'only verified_fact evidence adds reputation or counts as verified value',
  'no token marketing on any surface (doctrine guards)',
];

export const TENANT_SPECS: Record<string, TenantSpec> = {
  moveros: {
    slug: 'moveros',
    display_name: 'MoverOS (Tenant Zero)',
    vertical: 'moving-services',
    default_agents: [
      {
        name: 'MoverOS Front Desk',
        slug: 'moveros-front-desk',
        kind: 'front_desk',
        atc_scopes: ['lead.read', 'sms.draft'],
      },
    ],
    default_skills: 'core20',
    proof_categories: ['lead_response', 'booking', 'revenue_outcome'],
    outcome_metrics: ['response_time_ms', 'rescued_leads', 'verified_booked_value_cents'],
    guardrails: BASE_GUARDRAILS,
    compliance_notes: ['PIPEDA / BC PIPA purge supported', 'CASL review required before live SMS'],
    forbid_financial_claims: false,
  },
  demandara: {
    slug: 'demandara',
    display_name: 'Demandara',
    vertical: 'demand-generation',
    default_agents: [
      {
        name: 'Demandara Pipeline Agent',
        slug: 'demandara-pipeline',
        kind: 'internal_ops',
        atc_scopes: ['lead.read', 'crm.read', 'email.draft'],
      },
    ],
    default_skills: 'core20',
    proof_categories: ['lead_response', 'booking', 'revenue_outcome', 'skill_demo'],
    outcome_metrics: ['qualified_meetings', 'reply_rate', 'pipeline_value_cents'],
    guardrails: BASE_GUARDRAILS,
    compliance_notes: [
      'CASL applies to outbound email/SMS',
      'CRM evidence refs required for verified pipeline value',
    ],
    forbid_financial_claims: false,
  },
  skillucate: {
    slug: 'skillucate',
    display_name: 'Skillucate',
    vertical: 'education-funnel',
    default_agents: [
      {
        name: 'Skillucate Enrollment Desk',
        slug: 'skillucate-enrollment',
        kind: 'front_desk',
        atc_scopes: ['lead.read', 'sms.draft'],
      },
    ],
    default_skills: 'core20',
    proof_categories: ['lead_response', 'revenue_outcome'],
    outcome_metrics: ['inquiries_answered', 'enrollments_verified', 'enrollment_value_cents'],
    guardrails: BASE_GUARDRAILS,
    compliance_notes: ['Enrollments are verified_fact only with a payment/registration reference'],
    forbid_financial_claims: false,
  },
  alphainvesto: {
    slug: 'alphainvesto',
    display_name: 'AlphaInvesto',
    vertical: 'investor-research-content',
    default_agents: [
      {
        name: 'AlphaInvesto Research Agent',
        slug: 'alphainvesto-research',
        kind: 'internal_ops',
        atc_scopes: ['research.read', 'content.draft'],
      },
    ],
    default_skills: 'core20',
    proof_categories: ['skill_demo', 'system'],
    outcome_metrics: ['briefs_produced', 'subscriber_growth', 'content_throughput'],
    guardrails: [
      ...BASE_GUARDRAILS,
      'STRICT: no investment advice, no return/performance claims, no buy/sell recommendations in any agent output',
    ],
    compliance_notes: [
      'Hard rule: research/education content only — never advice, never predicted returns',
      'Securities-adjacent content requires counsel review before any external publication',
    ],
    forbid_financial_claims: true,
  },
};

export interface ProvisionResult {
  tenant: TenantRow;
  already_existed: boolean;
  agents_created: number;
  atcs_issued: number;
  skills_imported: number;
  spec: TenantSpec;
}

/** Provision (idempotently) one of the mapped tenants. Owner-only at the API. */
export async function provisionTenant(
  repo: Repository,
  services: GtmServices,
  specSlug: string,
  actorRef: string,
  repoRoot: string,
): Promise<ProvisionResult> {
  const spec = TENANT_SPECS[specSlug];
  if (!spec) throw new UnknownTenantSpecError(specSlug);

  const existing = await repo.getTenantBySlug(spec.slug);
  const ts = new Date().toISOString();
  const tenant =
    existing ??
    (await repo.createTenant({
      id: randomUUID(),
      name: spec.display_name,
      slug: spec.slug,
      settings: {
        vertical: spec.vertical,
        provisioned_by: 'cognitia-gtm-control-plane',
        forbid_financial_claims: spec.forbid_financial_claims,
        guardrails: spec.guardrails,
        compliance_notes: spec.compliance_notes,
        outcome_metrics: spec.outcome_metrics,
        proof_categories: spec.proof_categories,
      },
      created_at: ts,
      updated_at: ts,
    }));

  // Bootstrap inside the NEW tenant's scope: agents (registerAgent seeds the
  // sms.send_real deny), ATCs with the spec's scopes, and the skill base.
  let agentsCreated = 0;
  let atcsIssued = 0;
  const existingAgents = await repo.listAgents(tenant.id);
  for (const a of spec.default_agents) {
    if (existingAgents.some((e) => e.slug === a.slug)) continue;
    const { agent } = await registerAgent(
      repo,
      tenant.id,
      { name: a.name, slug: a.slug, kind: a.kind },
      actorRef,
      `provision-${spec.slug}`,
    );
    agentsCreated += 1;
    await issueAtc(
      repo,
      tenant.id,
      agent.id,
      { claims: { scope: a.atc_scopes, vertical: spec.vertical, policy_refs: ['doctrine:A1'] } },
      actorRef,
      `provision-${spec.slug}`,
    );
    atcsIssued += 1;
  }

  let skillsImported = 0;
  if (spec.default_skills === 'core20') {
    const summary = await importCoreSkills(repo, tenant.id, repoRoot, actorRef);
    skillsImported = summary.imported;
  }

  await repo.insertAuditEvent({
    id: randomUUID(),
    tenant_id: tenant.id,
    actor_ref: actorRef,
    action: 'tenant.provisioned.v1',
    subject_ref: `tenant:${tenant.id}`,
    detail: {
      slug: spec.slug,
      vertical: spec.vertical,
      agents_created: agentsCreated,
      skills_imported: skillsImported,
      already_existed: !!existing,
    },
    occurred_at: ts,
    created_at: ts,
  });

  return {
    tenant,
    already_existed: !!existing,
    agents_created: agentsCreated,
    atcs_issued: atcsIssued,
    skills_imported: skillsImported,
    spec,
  };
}

export class UnknownTenantSpecError extends Error {
  constructor(slug: string) {
    super(
      `unknown tenant spec '${slug}' — mapped tenants: ${Object.keys(TENANT_SPECS).join(', ')}`,
    );
    this.name = 'UnknownTenantSpecError';
  }
}
