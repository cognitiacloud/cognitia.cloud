import { type Kysely, type RawBuilder, sql } from 'kysely';
import type { Database } from './schema.js';
import { withTenant } from './client.js';
import type {
  Repository,
  AccountRow,
  ContactRow,
  EventRow,
  AgentRunRow,
  AgentActionRow,
  AuditEventRow,
  OpportunityRow,
  SyncRunRow,
  IntegrationConnectionRow,
  FeedbackLabelRow,
  ProofRow,
  AgentRow,
  AtcRow,
  AgentPermissionRow,
  LeadIntakeRow,
  LeadOutcomeRow,
  SkillRow,
  SkillVersionRow,
  SkillProofRow,
  ReputationEventRow,
  ReputationSnapshotRow,
  PublicReputationCounts,
  CreditsAccountRow,
  CreditsLedgerEntryRow,
  WalletBindingRow,
  ListActionsFilter,
  ListProofsFilter,
  ListWorkOrdersFilter,
  WorkOrderRow,
  SkillExecutionOrderRow,
  DisputeResolutionRow,
  MarketplaceListingRow,
  FabricNodeRow,
  IngestResult,
  IngestAccountInput,
  IngestContactInput,
  IngestOpportunityInput,
  CloserSourceRow,
  CloserScrapeRunRow,
  CloserRawRecordRow,
  CloserAccountProfileRow,
  CloserBriefRow,
  ListCloserSourcesFilter,
  ListCloserScrapeRunsFilter,
  ListCloserAccountProfilesFilter,
  CloserRawIngestResult,
} from './repository.js';

/** Wrap a JS value as a jsonb literal (node-postgres mis-encodes JS arrays as PG arrays). */
function jb<T>(value: T): RawBuilder<T> {
  return sql<T>`${JSON.stringify(value ?? null)}::jsonb`;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Production Repository over Kysely + Postgres. Every method runs inside a
 * `withTenant` transaction, which sets the transaction-local `app.current_tenant_id`
 * GUC that RLS reads — so isolation is enforced by Postgres, not app code. A
 * redundant `tenant_id =` predicate is added to reads as defense in depth.
 *
 * Idempotent ingest resolves through `external_object_maps`
 * (unique (tenant_id, external_system, external_type, external_id), migration 0002),
 * matching the InMemoryRepository contract used by the test suite.
 */
export class KyselyRepository implements Repository {
  constructor(private readonly db: Kysely<Database>) {}

  private run<T>(tenantId: string, fn: (trx: Kysely<Database>) => Promise<T>): Promise<T> {
    return withTenant(this.db, tenantId, fn);
  }

  // --- accounts / contacts ---

  listAccounts(tenantId: string): Promise<AccountRow[]> {
    return this.run(tenantId, (trx) =>
      trx.selectFrom('accounts').selectAll().where('tenant_id', '=', tenantId).execute(),
    );
  }
  getAccount(tenantId: string, id: string): Promise<AccountRow | null> {
    return this.run(
      tenantId,
      async (trx) =>
        (await trx
          .selectFrom('accounts')
          .selectAll()
          .where('tenant_id', '=', tenantId)
          .where('id', '=', id)
          .executeTakeFirst()) ?? null,
    );
  }
  listContactsByAccount(tenantId: string, accountId: string): Promise<ContactRow[]> {
    return this.run(tenantId, (trx) =>
      trx
        .selectFrom('contacts')
        .selectAll()
        .where('tenant_id', '=', tenantId)
        .where('account_id', '=', accountId)
        .execute(),
    );
  }
  getContact(tenantId: string, id: string): Promise<ContactRow | null> {
    return this.run(
      tenantId,
      async (trx) =>
        (await trx
          .selectFrom('contacts')
          .selectAll()
          .where('tenant_id', '=', tenantId)
          .where('id', '=', id)
          .executeTakeFirst()) ?? null,
    );
  }

  // --- events (immutable, insert-only) ---

  insertEvent(event: EventRow): Promise<void> {
    return this.run(event.tenant_id, async (trx) => {
      await trx
        .insertInto('events')
        .values({ ...event, payload: jb(event.payload) })
        .execute();
    });
  }
  listEvents(tenantId: string): Promise<EventRow[]> {
    return this.run(tenantId, (trx) =>
      trx.selectFrom('events').selectAll().where('tenant_id', '=', tenantId).execute(),
    );
  }

  // --- agent runs ---

  createAgentRun(run: AgentRunRow): Promise<AgentRunRow> {
    return this.run(run.tenant_id, async (trx) => {
      await trx
        .insertInto('agent_runs')
        .values({ ...run, input_refs: jb(run.input_refs) })
        .execute();
      return run;
    });
  }
  getAgentRun(tenantId: string, id: string): Promise<AgentRunRow | null> {
    return this.run(
      tenantId,
      async (trx) =>
        (await trx
          .selectFrom('agent_runs')
          .selectAll()
          .where('tenant_id', '=', tenantId)
          .where('id', '=', id)
          .executeTakeFirst()) ?? null,
    );
  }
  listAgentRuns(tenantId: string): Promise<AgentRunRow[]> {
    return this.run(tenantId, (trx) =>
      trx
        .selectFrom('agent_runs')
        .selectAll()
        .where('tenant_id', '=', tenantId)
        .orderBy('created_at', 'desc')
        .execute(),
    );
  }
  updateAgentRunStatus(tenantId: string, id: string, status: string): Promise<void> {
    return this.run(tenantId, async (trx) => {
      await trx
        .updateTable('agent_runs')
        .set({ status, updated_at: nowIso() })
        .where('tenant_id', '=', tenantId)
        .where('id', '=', id)
        .execute();
    });
  }

  // --- agent actions ---

  createAgentAction(action: AgentActionRow): Promise<AgentActionRow> {
    return this.run(action.tenant_id, async (trx) => {
      const existing = await trx
        .selectFrom('agent_actions')
        .selectAll()
        .where('tenant_id', '=', action.tenant_id)
        .where('idempotency_key', '=', action.idempotency_key)
        .executeTakeFirst();
      if (existing) return existing;
      await trx
        .insertInto('agent_actions')
        .values({
          ...action,
          evidence_refs: jb(action.evidence_refs),
          guardrail_results: jb(action.guardrail_results),
          result: action.result === null ? null : jb(action.result),
        })
        .execute();
      return action;
    });
  }
  getAgentAction(tenantId: string, id: string): Promise<AgentActionRow | null> {
    return this.run(
      tenantId,
      async (trx) =>
        (await trx
          .selectFrom('agent_actions')
          .selectAll()
          .where('tenant_id', '=', tenantId)
          .where('id', '=', id)
          .executeTakeFirst()) ?? null,
    );
  }
  findActionByIdempotencyKey(tenantId: string, key: string): Promise<AgentActionRow | null> {
    return this.run(
      tenantId,
      async (trx) =>
        (await trx
          .selectFrom('agent_actions')
          .selectAll()
          .where('tenant_id', '=', tenantId)
          .where('idempotency_key', '=', key)
          .executeTakeFirst()) ?? null,
    );
  }
  listAgentActions(tenantId: string, filter: ListActionsFilter = {}): Promise<AgentActionRow[]> {
    return this.run(tenantId, (trx) => {
      let q = trx.selectFrom('agent_actions').selectAll().where('tenant_id', '=', tenantId);
      if (filter.approvalStatus !== undefined) {
        q = q.where('approval_status', '=', filter.approvalStatus);
      }
      if (filter.executionStatus !== undefined) {
        q = q.where('execution_status', '=', filter.executionStatus);
      }
      return q.execute();
    });
  }
  updateAgentAction(
    tenantId: string,
    id: string,
    patch: Partial<AgentActionRow>,
  ): Promise<AgentActionRow> {
    return this.run(tenantId, async (trx) => {
      // Map only provided fields; jsonb columns are cast explicitly.
      const set: Record<string, unknown> = { updated_at: nowIso() };
      for (const [k, v] of Object.entries(patch)) {
        if (k === 'updated_at') continue;
        if (k === 'evidence_refs' || k === 'guardrail_results') {
          set[k] = jb(v);
        } else if (k === 'result') {
          set[k] = v === null ? null : jb(v);
        } else {
          set[k] = v;
        }
      }
      const updated = await trx
        .updateTable('agent_actions')
        .set(set as never)
        .where('tenant_id', '=', tenantId)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();
      if (!updated) throw new Error('agent_action not found for tenant');
      return updated;
    });
  }

  // --- integrations ---

  getIntegrationConnection(
    tenantId: string,
    externalSystem: string,
  ): Promise<IntegrationConnectionRow | null> {
    return this.run(
      tenantId,
      async (trx) =>
        (await trx
          .selectFrom('integration_connections')
          .selectAll()
          .where('tenant_id', '=', tenantId)
          .where('external_system', '=', externalSystem)
          .executeTakeFirst()) ?? null,
    );
  }

  updateIntegrationConnectionStatus(
    tenantId: string,
    externalSystem: string,
    status: string,
  ): Promise<IntegrationConnectionRow | null> {
    return this.run(
      tenantId,
      async (trx) =>
        (await trx
          .updateTable('integration_connections')
          .set({ status, updated_at: new Date().toISOString() })
          .where('tenant_id', '=', tenantId)
          .where('external_system', '=', externalSystem)
          .returningAll()
          .executeTakeFirst()) ?? null,
    );
  }

  // --- opportunities ---

  listOpportunities(tenantId: string): Promise<OpportunityRow[]> {
    return this.run(tenantId, (trx) =>
      trx.selectFrom('opportunities').selectAll().where('tenant_id', '=', tenantId).execute(),
    );
  }
  listOpportunitiesByAccount(tenantId: string, accountId: string): Promise<OpportunityRow[]> {
    return this.run(tenantId, (trx) =>
      trx
        .selectFrom('opportunities')
        .selectAll()
        .where('tenant_id', '=', tenantId)
        .where('account_id', '=', accountId)
        .execute(),
    );
  }

  // --- audit trail (append-only) ---

  insertAuditEvent(event: AuditEventRow): Promise<void> {
    return this.run(event.tenant_id, async (trx) => {
      await trx
        .insertInto('audit_events')
        .values({ ...event, detail: jb(event.detail) })
        .execute();
    });
  }
  listAuditEvents(tenantId: string): Promise<AuditEventRow[]> {
    return this.run(tenantId, (trx) =>
      trx.selectFrom('audit_events').selectAll().where('tenant_id', '=', tenantId).execute(),
    );
  }

  // --- proofs (Cognitia Proof Registry; append-only per 0009 triggers) ---

  insertProof(row: ProofRow): Promise<ProofRow> {
    return this.run(row.tenant_id, async (trx) => {
      await trx
        .insertInto('proofs')
        .values({ ...row, details_private: jb(row.details_private) })
        .execute();
      return row;
    });
  }
  getProof(tenantId: string, id: string): Promise<ProofRow | null> {
    return this.run(tenantId, (trx) =>
      trx
        .selectFrom('proofs')
        .selectAll()
        .where('tenant_id', '=', tenantId)
        .where('id', '=', id)
        .executeTakeFirst()
        .then((r) => r ?? null),
    );
  }
  listProofs(tenantId: string, filter?: ListProofsFilter): Promise<ProofRow[]> {
    return this.run(tenantId, (trx) => {
      let q = trx.selectFrom('proofs').selectAll().where('tenant_id', '=', tenantId);
      if (filter?.evidenceTag !== undefined) {
        q = q.where('evidence_tag', '=', filter.evidenceTag as ProofRow['evidence_tag']);
      }
      if (filter?.kind !== undefined) q = q.where('kind', '=', filter.kind);
      if (filter?.publicSafe !== undefined) q = q.where('public_safe', '=', filter.publicSafe);
      q = q.orderBy('created_at', 'desc');
      if (filter?.limit !== undefined) q = q.limit(Math.max(0, filter.limit));
      return q.execute();
    });
  }
  setProofPublishState(
    tenantId: string,
    id: string,
    publicSafe: boolean,
    redactionCheckPassedAt: string | null,
  ): Promise<ProofRow | null> {
    // Only the publish-state pair changes — anything else is rejected by the
    // 0009 update-guard trigger, which stays the authoritative enforcement.
    return this.run(tenantId, (trx) =>
      trx
        .updateTable('proofs')
        .set({ public_safe: publicSafe, redaction_check_passed_at: redactionCheckPassedAt })
        .where('tenant_id', '=', tenantId)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst()
        .then((r) => r ?? null),
    );
  }

  // --- agents + Agent Trust Credentials + permissions (COG-004) ---

  createAgent(row: AgentRow): Promise<AgentRow> {
    return this.run(row.tenant_id, async (trx) => {
      await trx.insertInto('agents').values(row).execute();
      return row;
    });
  }
  getAgent(tenantId: string, id: string): Promise<AgentRow | null> {
    return this.run(tenantId, (trx) =>
      trx
        .selectFrom('agents')
        .selectAll()
        .where('tenant_id', '=', tenantId)
        .where('id', '=', id)
        .executeTakeFirst()
        .then((r) => r ?? null),
    );
  }
  listAgents(tenantId: string): Promise<AgentRow[]> {
    return this.run(tenantId, (trx) =>
      trx
        .selectFrom('agents')
        .selectAll()
        .where('tenant_id', '=', tenantId)
        .orderBy('name')
        .execute(),
    );
  }
  createAtc(row: AtcRow): Promise<AtcRow> {
    return this.run(row.tenant_id, async (trx) => {
      await trx
        .insertInto('agent_trust_credentials')
        .values({ ...row, claims: jb(row.claims) })
        .execute();
      return row;
    });
  }
  getAtc(tenantId: string, id: string): Promise<AtcRow | null> {
    return this.run(tenantId, (trx) =>
      trx
        .selectFrom('agent_trust_credentials')
        .selectAll()
        .where('tenant_id', '=', tenantId)
        .where('id', '=', id)
        .executeTakeFirst()
        .then((r) => r ?? null),
    );
  }
  listAtcsByAgent(tenantId: string, agentId: string): Promise<AtcRow[]> {
    return this.run(tenantId, (trx) =>
      trx
        .selectFrom('agent_trust_credentials')
        .selectAll()
        .where('tenant_id', '=', tenantId)
        .where('agent_id', '=', agentId)
        .orderBy('issued_at', 'desc')
        .execute(),
    );
  }
  updateAtcStatus(tenantId: string, id: string, status: string): Promise<AtcRow | null> {
    // Revoked-is-terminal is enforced by the 0009 trigger; the raised error
    // propagates to the service layer.
    return this.run(tenantId, (trx) =>
      trx
        .updateTable('agent_trust_credentials')
        .set({ status, updated_at: nowIso() })
        .where('tenant_id', '=', tenantId)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst()
        .then((r) => r ?? null),
    );
  }
  upsertAgentPermission(row: AgentPermissionRow): Promise<AgentPermissionRow> {
    return this.run(row.tenant_id, (trx) =>
      trx
        .insertInto('agent_permissions')
        .values({ ...row, constraints: jb(row.constraints) })
        .onConflict((oc) =>
          oc.columns(['tenant_id', 'agent_id', 'action_key']).doUpdateSet({
            effect: row.effect,
            constraints: jb(row.constraints),
            updated_at: nowIso(),
          }),
        )
        .returningAll()
        .executeTakeFirstOrThrow(),
    );
  }
  listAgentPermissions(tenantId: string, agentId: string): Promise<AgentPermissionRow[]> {
    return this.run(tenantId, (trx) =>
      trx
        .selectFrom('agent_permissions')
        .selectAll()
        .where('tenant_id', '=', tenantId)
        .where('agent_id', '=', agentId)
        .orderBy('action_key')
        .execute(),
    );
  }

  // --- MoverOS lead intakes (COG-006) ---

  insertLeadIntake(row: LeadIntakeRow): Promise<LeadIntakeRow> {
    return this.run(row.tenant_id, async (trx) => {
      await trx.insertInto('lead_intakes').values(row).execute();
      return row;
    });
  }
  getLeadIntake(tenantId: string, id: string): Promise<LeadIntakeRow | null> {
    return this.run(tenantId, (trx) =>
      trx
        .selectFrom('lead_intakes')
        .selectAll()
        .where('tenant_id', '=', tenantId)
        .where('id', '=', id)
        .executeTakeFirst()
        .then((r) => r ?? null),
    );
  }
  listLeadIntakes(tenantId: string): Promise<LeadIntakeRow[]> {
    return this.run(tenantId, (trx) =>
      trx
        .selectFrom('lead_intakes')
        .selectAll()
        .where('tenant_id', '=', tenantId)
        .orderBy('received_at', 'desc')
        .execute(),
    );
  }
  purgeLeadIntakePii(tenantId: string, id: string): Promise<LeadIntakeRow | null> {
    return this.run(tenantId, (trx) =>
      trx
        .updateTable('lead_intakes')
        .set({
          contact_name_enc: null,
          contact_phone_enc: null,
          message_body_enc: null,
          pii_status: 'purged',
          status: 'purged',
          updated_at: nowIso(),
        })
        .where('tenant_id', '=', tenantId)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst()
        .then((r) => r ?? null),
    );
  }

  updateLeadIntakeStatus(
    tenantId: string,
    id: string,
    status: string,
  ): Promise<LeadIntakeRow | null> {
    return this.run(tenantId, (trx) =>
      trx
        .updateTable('lead_intakes')
        .set({ status, updated_at: nowIso() })
        .where('tenant_id', '=', tenantId)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst()
        .then((r) => r ?? null),
    );
  }

  // --- lead outcomes (COG-006) ---

  insertLeadOutcome(row: LeadOutcomeRow): Promise<LeadOutcomeRow> {
    return this.run(row.tenant_id, async (trx) => {
      await trx.insertInto('lead_outcomes').values(row).execute();
      return row;
    });
  }
  listLeadOutcomes(tenantId: string, leadIntakeId?: string): Promise<LeadOutcomeRow[]> {
    return this.run(tenantId, (trx) => {
      let q = trx.selectFrom('lead_outcomes').selectAll().where('tenant_id', '=', tenantId);
      if (leadIntakeId !== undefined) q = q.where('lead_intake_id', '=', leadIntakeId);
      return q.orderBy('created_at', 'desc').execute();
    });
  }

  // --- SkillProof (COG-005) ---

  upsertSkill(row: SkillRow): Promise<SkillRow> {
    return this.run(row.tenant_id, (trx) =>
      trx
        .insertInto('skills')
        .values(row)
        .onConflict((oc) => oc.columns(['tenant_id', 'slug']).doNothing())
        .returningAll()
        .executeTakeFirst()
        .then(
          (inserted) =>
            inserted ??
            trx
              .selectFrom('skills')
              .selectAll()
              .where('tenant_id', '=', row.tenant_id)
              .where('slug', '=', row.slug)
              .executeTakeFirstOrThrow(),
        ),
    );
  }
  getSkill(tenantId: string, id: string): Promise<SkillRow | null> {
    return this.run(tenantId, (trx) =>
      trx
        .selectFrom('skills')
        .selectAll()
        .where('tenant_id', '=', tenantId)
        .where('id', '=', id)
        .executeTakeFirst()
        .then((r) => r ?? null),
    );
  }
  listSkills(tenantId: string): Promise<SkillRow[]> {
    return this.run(tenantId, (trx) =>
      trx
        .selectFrom('skills')
        .selectAll()
        .where('tenant_id', '=', tenantId)
        .orderBy('slug')
        .execute(),
    );
  }
  insertSkillVersion(row: SkillVersionRow): Promise<SkillVersionRow> {
    return this.run(row.tenant_id, async (trx) => {
      await trx
        .insertInto('skill_versions')
        .values({ ...row, spec: jb(row.spec), metadata: jb(row.metadata) })
        .execute();
      return row;
    });
  }
  getSkillVersion(tenantId: string, id: string): Promise<SkillVersionRow | null> {
    return this.run(tenantId, (trx) =>
      trx
        .selectFrom('skill_versions')
        .selectAll()
        .where('tenant_id', '=', tenantId)
        .where('id', '=', id)
        .executeTakeFirst()
        .then((r) => r ?? null),
    );
  }
  listSkillVersions(tenantId: string, skillId: string): Promise<SkillVersionRow[]> {
    return this.run(tenantId, (trx) =>
      trx
        .selectFrom('skill_versions')
        .selectAll()
        .where('tenant_id', '=', tenantId)
        .where('skill_id', '=', skillId)
        .orderBy('created_at', 'desc')
        .execute(),
    );
  }
  setSkillVersionTier(tenantId: string, id: string, tier: number): Promise<SkillVersionRow | null> {
    // Tier >= 2 gating is enforced by the 0013 trigger (and mirrored in memory).
    return this.run(tenantId, (trx) =>
      trx
        .updateTable('skill_versions')
        .set({ proof_tier: tier, updated_at: nowIso() })
        .where('tenant_id', '=', tenantId)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst()
        .then((r) => r ?? null),
    );
  }
  yankSkillVersion(tenantId: string, id: string, reason: string): Promise<SkillVersionRow | null> {
    return this.run(tenantId, (trx) =>
      trx
        .updateTable('skill_versions')
        .set({ yanked: true, yank_reason: reason, updated_at: nowIso() })
        .where('tenant_id', '=', tenantId)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst()
        .then((r) => r ?? null),
    );
  }
  insertSkillProof(row: SkillProofRow): Promise<SkillProofRow> {
    return this.run(row.tenant_id, async (trx) => {
      await trx.insertInto('skill_proofs').values(row).execute();
      return row;
    });
  }
  listSkillProofs(tenantId: string, skillId?: string): Promise<SkillProofRow[]> {
    return this.run(tenantId, (trx) => {
      let q = trx.selectFrom('skill_proofs').selectAll().where('tenant_id', '=', tenantId);
      if (skillId !== undefined) q = q.where('skill_id', '=', skillId);
      return q.execute();
    });
  }

  // --- reputation events (append-only; 0010 trigger guards positive deltas) ---

  insertReputationEvent(row: ReputationEventRow): Promise<ReputationEventRow> {
    return this.run(row.tenant_id, async (trx) => {
      await trx.insertInto('reputation_events').values(row).execute();
      return row;
    });
  }
  listReputationEvents(tenantId: string, agentId?: string): Promise<ReputationEventRow[]> {
    return this.run(tenantId, (trx) => {
      let q = trx.selectFrom('reputation_events').selectAll().where('tenant_id', '=', tenantId);
      if (agentId !== undefined) q = q.where('agent_id', '=', agentId);
      return q.orderBy('created_at', 'desc').execute();
    });
  }
  countReputation(tenantId: string): Promise<PublicReputationCounts> {
    return this.run(tenantId, async (trx) => {
      const row = await trx
        .selectFrom('reputation_events')
        .where('tenant_id', '=', tenantId)
        .select((eb) => [
          eb.fn.countAll<string | number>().as('total_events'),
          eb.fn.count<string | number>('agent_id').distinct().as('agents_with_reputation'),
          eb.fn.countAll<string | number>().filterWhere('delta', '>', 0).as('positive_events'),
        ])
        .executeTakeFirst();
      return {
        agents_with_reputation: Number(row?.agents_with_reputation ?? 0),
        total_events: Number(row?.total_events ?? 0),
        positive_events: Number(row?.positive_events ?? 0),
      };
    });
  }
  // --- internal credits + wallet placeholders (COG-009) ---

  upsertCreditsAccount(row: CreditsAccountRow): Promise<CreditsAccountRow> {
    return this.run(row.tenant_id, (trx) =>
      trx
        .insertInto('credits_accounts')
        .values(row)
        .onConflict((oc) => oc.columns(['tenant_id', 'owner_type', 'owner_id']).doNothing())
        .returningAll()
        .executeTakeFirst()
        .then(
          (inserted) =>
            inserted ??
            trx
              .selectFrom('credits_accounts')
              .selectAll()
              .where('tenant_id', '=', row.tenant_id)
              .where('owner_type', '=', row.owner_type)
              .where('owner_id', '=', row.owner_id)
              .executeTakeFirstOrThrow(),
        ),
    );
  }
  getCreditsAccount(tenantId: string, id: string): Promise<CreditsAccountRow | null> {
    return this.run(tenantId, (trx) =>
      trx
        .selectFrom('credits_accounts')
        .selectAll()
        .where('tenant_id', '=', tenantId)
        .where('id', '=', id)
        .executeTakeFirst()
        .then((r) => r ?? null),
    );
  }
  listCreditsAccounts(tenantId: string): Promise<CreditsAccountRow[]> {
    return this.run(tenantId, (trx) =>
      trx
        .selectFrom('credits_accounts')
        .selectAll()
        .where('tenant_id', '=', tenantId)
        .orderBy('created_at')
        .execute(),
    );
  }
  insertCreditsLedgerPair(
    debit: CreditsLedgerEntryRow,
    credit: CreditsLedgerEntryRow,
  ): Promise<void> {
    // One withTenant transaction: the pair lands atomically or not at all.
    // Append-only invariants (unique key+direction, positive amount, internal
    // rail, distinct accounts, no update/delete) are 0012 constraints+triggers.
    return this.run(debit.tenant_id, async (trx) => {
      await trx.insertInto('credits_ledger_entries').values([debit, credit]).execute();
    });
  }
  listCreditsLedgerEntries(tenantId: string, accountId?: string): Promise<CreditsLedgerEntryRow[]> {
    return this.run(tenantId, (trx) => {
      let q = trx
        .selectFrom('credits_ledger_entries')
        .selectAll()
        .where('tenant_id', '=', tenantId);
      if (accountId !== undefined) q = q.where('account_id', '=', accountId);
      return q.orderBy('created_at', 'desc').execute();
    });
  }
  findCreditsLedgerByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<CreditsLedgerEntryRow[]> {
    return this.run(tenantId, (trx) =>
      trx
        .selectFrom('credits_ledger_entries')
        .selectAll()
        .where('tenant_id', '=', tenantId)
        .where('idempotency_key', '=', idempotencyKey)
        .execute(),
    );
  }
  insertWalletBinding(row: WalletBindingRow): Promise<WalletBindingRow> {
    return this.run(row.tenant_id, async (trx) => {
      await trx.insertInto('wallet_bindings').values(row).execute();
      return row;
    });
  }
  listWalletBindings(tenantId: string): Promise<WalletBindingRow[]> {
    return this.run(tenantId, (trx) =>
      trx
        .selectFrom('wallet_bindings')
        .selectAll()
        .where('tenant_id', '=', tenantId)
        .orderBy('created_at')
        .execute(),
    );
  }
  getWalletBinding(tenantId: string, id: string): Promise<WalletBindingRow | null> {
    return this.run(tenantId, (trx) =>
      trx
        .selectFrom('wallet_bindings')
        .selectAll()
        .where('tenant_id', '=', tenantId)
        .where('id', '=', id)
        .executeTakeFirst()
        .then((r) => r ?? null),
    );
  }
  deactivateWalletBinding(tenantId: string, id: string): Promise<WalletBindingRow | null> {
    return this.run(tenantId, (trx) =>
      trx
        .updateTable('wallet_bindings')
        .set({ status: 'deactivated', updated_at: nowIso() })
        .where('tenant_id', '=', tenantId)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst()
        .then((r) => r ?? null),
    );
  }

  insertReputationSnapshot(row: ReputationSnapshotRow): Promise<ReputationSnapshotRow> {
    return this.run(row.tenant_id, async (trx) => {
      await trx.insertInto('reputation_snapshots').values(row).execute();
      return row;
    });
  }
  listReputationSnapshots(tenantId: string, agentId: string): Promise<ReputationSnapshotRow[]> {
    return this.run(tenantId, (trx) =>
      trx
        .selectFrom('reputation_snapshots')
        .selectAll()
        .where('tenant_id', '=', tenantId)
        .where('agent_id', '=', agentId)
        .orderBy('computed_at', 'desc')
        .execute(),
    );
  }

  // --- Agent Economy Lab (AGENT-ECONOMY-001; the 0016 trigger + checks are
  // the authoritative enforcement of terminal states and the payout rule) ---

  insertWorkOrder(row: WorkOrderRow): Promise<WorkOrderRow> {
    return this.run(row.tenant_id, async (trx) => {
      await trx.insertInto('work_orders').values(row).execute();
      return row;
    });
  }
  getWorkOrder(tenantId: string, id: string): Promise<WorkOrderRow | null> {
    return this.run(tenantId, (trx) =>
      trx
        .selectFrom('work_orders')
        .selectAll()
        .where('tenant_id', '=', tenantId)
        .where('id', '=', id)
        .executeTakeFirst()
        .then((r) => r ?? null),
    );
  }
  listWorkOrders(tenantId: string, filter?: ListWorkOrdersFilter): Promise<WorkOrderRow[]> {
    return this.run(tenantId, (trx) => {
      let q = trx.selectFrom('work_orders').selectAll().where('tenant_id', '=', tenantId);
      if (filter?.status !== undefined) q = q.where('status', '=', filter.status);
      if (filter?.workerAgentId !== undefined) {
        q = q.where('worker_agent_id', '=', filter.workerAgentId);
      }
      return q.orderBy('created_at', 'desc').execute();
    });
  }
  updateWorkOrder(
    tenantId: string,
    id: string,
    patch: Partial<WorkOrderRow>,
  ): Promise<WorkOrderRow | null> {
    return this.run(tenantId, (trx) =>
      trx
        .updateTable('work_orders')
        .set(patch)
        .where('tenant_id', '=', tenantId)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst()
        .then((r) => r ?? null),
    );
  }
  insertSkillExecutionOrder(row: SkillExecutionOrderRow): Promise<SkillExecutionOrderRow> {
    return this.run(row.tenant_id, async (trx) => {
      await trx
        .insertInto('skill_execution_orders')
        .values({ ...row, result: jb(row.result) })
        .execute();
      return row;
    });
  }
  listSkillExecutionOrders(
    tenantId: string,
    workOrderId?: string,
  ): Promise<SkillExecutionOrderRow[]> {
    return this.run(tenantId, (trx) => {
      let q = trx
        .selectFrom('skill_execution_orders')
        .selectAll()
        .where('tenant_id', '=', tenantId);
      if (workOrderId !== undefined) q = q.where('work_order_id', '=', workOrderId);
      return q.orderBy('created_at', 'desc').execute();
    });
  }
  updateSkillExecutionOrder(
    tenantId: string,
    id: string,
    patch: Partial<SkillExecutionOrderRow>,
  ): Promise<SkillExecutionOrderRow | null> {
    const { result, ...rest } = patch;
    return this.run(tenantId, (trx) =>
      trx
        .updateTable('skill_execution_orders')
        .set(result !== undefined ? { ...rest, result: jb(result) } : rest)
        .where('tenant_id', '=', tenantId)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst()
        .then((r) => r ?? null),
    );
  }

  // --- marketplace listings (AGENT-ECONOMY-004; the 0018 trigger enforces
  // the yank guard and skill/version coherence) ---

  insertMarketplaceListing(row: MarketplaceListingRow): Promise<MarketplaceListingRow> {
    return this.run(row.tenant_id, async (trx) => {
      await trx.insertInto('marketplace_listings').values(row).execute();
      return row;
    });
  }
  getMarketplaceListing(tenantId: string, id: string): Promise<MarketplaceListingRow | null> {
    return this.run(
      tenantId,
      async (trx) =>
        (await trx
          .selectFrom('marketplace_listings')
          .selectAll()
          .where('tenant_id', '=', tenantId)
          .where('id', '=', id)
          .executeTakeFirst()) ?? null,
    );
  }
  listMarketplaceListings(tenantId: string, status?: string): Promise<MarketplaceListingRow[]> {
    return this.run(tenantId, (trx) => {
      let q = trx.selectFrom('marketplace_listings').selectAll().where('tenant_id', '=', tenantId);
      if (status !== undefined) q = q.where('status', '=', status);
      return q.orderBy('created_at', 'desc').execute();
    });
  }
  updateMarketplaceListingStatus(
    tenantId: string,
    id: string,
    status: string,
  ): Promise<MarketplaceListingRow | null> {
    return this.run(tenantId, (trx) =>
      trx
        .updateTable('marketplace_listings')
        .set({ status })
        .where('tenant_id', '=', tenantId)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst()
        .then((r) => r ?? null),
    );
  }

  // --- fabric nodes (LEGEND-001; the 0019 checks enforce platform/status) ---

  insertFabricNode(row: FabricNodeRow): Promise<FabricNodeRow> {
    return this.run(row.tenant_id, async (trx) => {
      await trx
        .insertInto('fabric_nodes')
        .values({ ...row, capabilities: jb(row.capabilities) })
        .execute();
      return row;
    });
  }
  getFabricNode(tenantId: string, id: string): Promise<FabricNodeRow | null> {
    return this.run(
      tenantId,
      async (trx) =>
        (await trx
          .selectFrom('fabric_nodes')
          .selectAll()
          .where('tenant_id', '=', tenantId)
          .where('id', '=', id)
          .executeTakeFirst()) ?? null,
    );
  }
  listFabricNodes(tenantId: string, status?: string): Promise<FabricNodeRow[]> {
    return this.run(tenantId, (trx) => {
      let q = trx.selectFrom('fabric_nodes').selectAll().where('tenant_id', '=', tenantId);
      if (status !== undefined) q = q.where('status', '=', status);
      return q.orderBy('created_at', 'asc').execute();
    });
  }
  updateFabricNodeStatus(
    tenantId: string,
    id: string,
    status: string,
  ): Promise<FabricNodeRow | null> {
    return this.run(tenantId, (trx) =>
      trx
        .updateTable('fabric_nodes')
        .set({ status })
        .where('tenant_id', '=', tenantId)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst()
        .then((r) => r ?? null),
    );
  }

  // --- dispute resolutions (AGENT-ECONOMY-002; the 0017 trigger is the
  // authoritative enforcement of disputed-origin + conserved split) ---

  insertDisputeResolution(row: DisputeResolutionRow): Promise<DisputeResolutionRow> {
    return this.run(row.tenant_id, async (trx) => {
      await trx.insertInto('dispute_resolutions').values(row).execute();
      return row;
    });
  }
  getDisputeResolutionByWorkOrder(
    tenantId: string,
    workOrderId: string,
  ): Promise<DisputeResolutionRow | null> {
    return this.run(
      tenantId,
      async (trx) =>
        (await trx
          .selectFrom('dispute_resolutions')
          .selectAll()
          .where('tenant_id', '=', tenantId)
          .where('work_order_id', '=', workOrderId)
          .executeTakeFirst()) ?? null,
    );
  }
  listDisputeResolutions(tenantId: string): Promise<DisputeResolutionRow[]> {
    return this.run(tenantId, (trx) =>
      trx
        .selectFrom('dispute_resolutions')
        .selectAll()
        .where('tenant_id', '=', tenantId)
        .orderBy('created_at', 'desc')
        .execute(),
    );
  }

  // --- feedback labels (decision flywheel) ---

  insertFeedbackLabel(row: FeedbackLabelRow): Promise<void> {
    return this.run(row.tenant_id, async (trx) => {
      await trx
        .insertInto('feedback_labels')
        .values({ ...row, detail: jb(row.detail) })
        .execute();
    });
  }
  listFeedbackLabels(tenantId: string, subjectRef?: string): Promise<FeedbackLabelRow[]> {
    return this.run(tenantId, (trx) => {
      let q = trx.selectFrom('feedback_labels').selectAll().where('tenant_id', '=', tenantId);
      if (subjectRef !== undefined) q = q.where('subject_ref', '=', subjectRef);
      return q.execute();
    });
  }

  // --- external object maps + idempotent ingest ---

  findInternalIdByExternal(
    tenantId: string,
    externalSystem: string,
    externalType: string,
    externalId: string,
  ): Promise<string | null> {
    return this.run(tenantId, (trx) =>
      this.resolveExternal(trx, tenantId, externalSystem, externalType, externalId),
    );
  }

  private async resolveExternal(
    trx: Kysely<Database>,
    tenantId: string,
    system: string,
    type: string,
    externalId: string,
  ): Promise<string | null> {
    const row = await trx
      .selectFrom('external_object_maps')
      .select('internal_id')
      .where('tenant_id', '=', tenantId)
      .where('external_system', '=', system)
      .where('external_type', '=', type)
      .where('external_id', '=', externalId)
      .executeTakeFirst();
    return row?.internal_id ?? null;
  }

  private async putExternalMap(
    trx: Kysely<Database>,
    tenantId: string,
    system: string,
    type: string,
    externalId: string,
    internalId: string,
  ): Promise<void> {
    const ts = nowIso();
    await trx
      .insertInto('external_object_maps')
      .values({
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        connection_id: null,
        external_system: system,
        external_type: type,
        external_id: externalId,
        internal_type: type,
        internal_id: internalId,
        created_at: ts,
        updated_at: ts,
      })
      .execute();
  }

  ingestExternalAccount(input: IngestAccountInput): Promise<IngestResult> {
    return this.run(input.tenantId, async (trx) => {
      const existingId = await this.resolveExternal(
        trx,
        input.tenantId,
        input.externalSystem,
        'company',
        input.externalId,
      );
      if (existingId) {
        await trx
          .updateTable('accounts')
          .set({
            name: input.account.name,
            domain: input.account.domain ?? null,
            industry: input.account.industry ?? null,
            employee_count: input.account.employeeCount ?? null,
            region: input.account.region ?? null,
            updated_at: nowIso(),
          })
          .where('tenant_id', '=', input.tenantId)
          .where('id', '=', existingId)
          .execute();
        return { id: existingId, created: false };
      }
      const id = crypto.randomUUID();
      const ts = nowIso();
      await trx
        .insertInto('accounts')
        .values({
          id,
          tenant_id: input.tenantId,
          name: input.account.name,
          domain: input.account.domain ?? null,
          industry: input.account.industry ?? null,
          employee_count: input.account.employeeCount ?? null,
          region: input.account.region ?? null,
          fit_score: null,
          timing_score: null,
          attributes: jb({}),
          created_at: ts,
          updated_at: ts,
        })
        .execute();
      await this.putExternalMap(
        trx,
        input.tenantId,
        input.externalSystem,
        'company',
        input.externalId,
        id,
      );
      return { id, created: true };
    });
  }

  ingestExternalContact(
    input: IngestContactInput,
  ): Promise<{ contactId: string; created: boolean }> {
    return this.run(input.tenantId, async (trx) => {
      const existingId = await this.resolveExternal(
        trx,
        input.tenantId,
        input.externalSystem,
        'contact',
        input.externalId,
      );
      if (existingId) {
        await trx
          .updateTable('contacts')
          .set({
            account_id: input.contact.accountId ?? null,
            full_name: input.contact.fullName ?? null,
            title: input.contact.title ?? null,
            persona: input.contact.persona ?? null,
            email_hash: input.contact.emailHash ?? null,
            updated_at: nowIso(),
          })
          .where('tenant_id', '=', input.tenantId)
          .where('id', '=', existingId)
          .execute();
        return { contactId: existingId, created: false };
      }
      const id = crypto.randomUUID();
      const ts = nowIso();
      await trx
        .insertInto('contacts')
        .values({
          id,
          tenant_id: input.tenantId,
          account_id: input.contact.accountId ?? null,
          full_name: input.contact.fullName ?? null,
          title: input.contact.title ?? null,
          persona: input.contact.persona ?? null,
          email_hash: input.contact.emailHash ?? null,
          phone_hash: null,
          is_suppressed: false,
          attributes: jb({}),
          created_at: ts,
          updated_at: ts,
        })
        .execute();
      await this.putExternalMap(
        trx,
        input.tenantId,
        input.externalSystem,
        'contact',
        input.externalId,
        id,
      );
      return { contactId: id, created: true };
    });
  }

  ingestExternalOpportunity(input: IngestOpportunityInput): Promise<IngestResult> {
    return this.run(input.tenantId, async (trx) => {
      const existingId = await this.resolveExternal(
        trx,
        input.tenantId,
        input.externalSystem,
        'deal',
        input.externalId,
      );
      if (existingId) {
        await trx
          .updateTable('opportunities')
          .set({
            account_id: input.opportunity.accountId,
            name: input.opportunity.name,
            stage: input.opportunity.stage ?? 'open',
            amount: input.opportunity.amount ?? null,
            owner_ref: input.opportunity.ownerRef ?? null,
            updated_at: nowIso(),
          })
          .where('tenant_id', '=', input.tenantId)
          .where('id', '=', existingId)
          .execute();
        return { id: existingId, created: false };
      }
      const id = crypto.randomUUID();
      const ts = nowIso();
      await trx
        .insertInto('opportunities')
        .values({
          id,
          tenant_id: input.tenantId,
          account_id: input.opportunity.accountId,
          name: input.opportunity.name,
          stage: input.opportunity.stage ?? 'open',
          amount: input.opportunity.amount ?? null,
          owner_ref: input.opportunity.ownerRef ?? null,
          attributes: jb({}),
          created_at: ts,
          updated_at: ts,
        })
        .execute();
      await this.putExternalMap(
        trx,
        input.tenantId,
        input.externalSystem,
        'deal',
        input.externalId,
        id,
      );
      return { id, created: true };
    });
  }

  // --- sync runs ---

  createSyncRun(input: {
    tenantId: string;
    connectionId?: string | null;
    status?: string;
  }): Promise<SyncRunRow> {
    return this.run(input.tenantId, async (trx) => {
      const ts = nowIso();
      const row: SyncRunRow = {
        id: crypto.randomUUID(),
        tenant_id: input.tenantId,
        connection_id: input.connectionId ?? null,
        status: input.status ?? 'running',
        started_at: ts,
        finished_at: null,
        stats: {},
        created_at: ts,
        updated_at: ts,
      };
      await trx
        .insertInto('sync_runs')
        .values({ ...row, stats: jb(row.stats) })
        .execute();
      return row;
    });
  }
  updateSyncRun(
    tenantId: string,
    id: string,
    patch: Partial<Pick<SyncRunRow, 'status' | 'finished_at' | 'stats'>>,
  ): Promise<SyncRunRow> {
    return this.run(tenantId, async (trx) => {
      const set: Record<string, unknown> = { updated_at: nowIso() };
      if (patch.status !== undefined) set.status = patch.status;
      if (patch.finished_at !== undefined) set.finished_at = patch.finished_at;
      if (patch.stats !== undefined) set.stats = jb(patch.stats);
      const updated = await trx
        .updateTable('sync_runs')
        .set(set as never)
        .where('tenant_id', '=', tenantId)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();
      if (!updated) throw new Error('sync_run not found for tenant');
      return updated as SyncRunRow;
    });
  }

  // --- Sales Closer: sources (the 0020 check is the authoritative guard) ---

  createCloserSource(row: CloserSourceRow): Promise<CloserSourceRow> {
    if (row.active && row.source_risk === 'disallowed') {
      throw new Error('closer_source: a disallowed source cannot be active');
    }
    return this.run(row.tenant_id, async (trx) => {
      await trx
        .insertInto('closer_sources')
        .values({ ...row, input: jb(row.input) })
        .execute();
      return row;
    });
  }
  getCloserSource(tenantId: string, id: string): Promise<CloserSourceRow | null> {
    return this.run(
      tenantId,
      async (trx) =>
        (await trx
          .selectFrom('closer_sources')
          .selectAll()
          .where('tenant_id', '=', tenantId)
          .where('id', '=', id)
          .executeTakeFirst()) ?? null,
    );
  }
  listCloserSources(
    tenantId: string,
    filter: ListCloserSourcesFilter = {},
  ): Promise<CloserSourceRow[]> {
    return this.run(tenantId, (trx) => {
      let q = trx.selectFrom('closer_sources').selectAll().where('tenant_id', '=', tenantId);
      if (filter.active !== undefined) q = q.where('active', '=', filter.active);
      return q.orderBy('created_at', 'desc').execute();
    });
  }
  updateCloserSource(
    tenantId: string,
    id: string,
    patch: Partial<
      Pick<
        CloserSourceRow,
        'label' | 'input' | 'source_risk' | 'max_results' | 'schedule' | 'active'
      >
    >,
  ): Promise<CloserSourceRow | null> {
    return this.run(tenantId, async (trx) => {
      const current = await trx
        .selectFrom('closer_sources')
        .selectAll()
        .where('tenant_id', '=', tenantId)
        .where('id', '=', id)
        .executeTakeFirst();
      if (!current) return null;
      const nextActive = patch.active ?? current.active;
      const nextRisk = patch.source_risk ?? current.source_risk;
      if (nextActive && nextRisk === 'disallowed') {
        throw new Error('closer_source: a disallowed source cannot be active');
      }
      const set: Record<string, unknown> = { updated_at: nowIso() };
      for (const [k, v] of Object.entries(patch)) {
        set[k] = k === 'input' ? jb(v) : v;
      }
      return (
        (await trx
          .updateTable('closer_sources')
          .set(set as never)
          .where('tenant_id', '=', tenantId)
          .where('id', '=', id)
          .returningAll()
          .executeTakeFirst()) ?? null
      );
    });
  }

  // --- Sales Closer: scrape runs ---

  createCloserScrapeRun(row: CloserScrapeRunRow): Promise<CloserScrapeRunRow> {
    return this.run(row.tenant_id, async (trx) => {
      await trx.insertInto('closer_scrape_runs').values(row).execute();
      return row;
    });
  }
  getCloserScrapeRun(tenantId: string, id: string): Promise<CloserScrapeRunRow | null> {
    return this.run(
      tenantId,
      async (trx) =>
        (await trx
          .selectFrom('closer_scrape_runs')
          .selectAll()
          .where('tenant_id', '=', tenantId)
          .where('id', '=', id)
          .executeTakeFirst()) ?? null,
    );
  }
  listCloserScrapeRuns(
    tenantId: string,
    filter: ListCloserScrapeRunsFilter = {},
  ): Promise<CloserScrapeRunRow[]> {
    return this.run(tenantId, (trx) => {
      let q = trx.selectFrom('closer_scrape_runs').selectAll().where('tenant_id', '=', tenantId);
      if (filter.status !== undefined) q = q.where('status', '=', filter.status);
      return q.orderBy('created_at', 'desc').execute();
    });
  }
  updateCloserScrapeRun(
    tenantId: string,
    id: string,
    patch: Partial<
      Pick<
        CloserScrapeRunRow,
        | 'status'
        | 'stage'
        | 'apify_run_id'
        | 'dataset_id'
        | 'rows_in'
        | 'accounts_upserted'
        | 'contacts_upserted'
        | 'error'
      >
    >,
  ): Promise<CloserScrapeRunRow | null> {
    return this.run(
      tenantId,
      async (trx) =>
        (await trx
          .updateTable('closer_scrape_runs')
          .set({ ...patch, updated_at: nowIso() })
          .where('tenant_id', '=', tenantId)
          .where('id', '=', id)
          .returningAll()
          .executeTakeFirst()) ?? null,
    );
  }

  // --- Sales Closer: raw records (idempotent on the unique key) ---

  insertCloserRawRecords(rows: CloserRawRecordRow[]): Promise<CloserRawIngestResult> {
    if (rows.length === 0) return Promise.resolve({ inserted: 0, skipped: 0 });
    const tenantId = rows[0]!.tenant_id;
    return this.run(tenantId, async (trx) => {
      const inserted = await trx
        .insertInto('closer_raw_records')
        .values(rows.map((r) => ({ ...r, payload: jb(r.payload), normalized: jb(r.normalized) })))
        .onConflict((oc) => oc.columns(['tenant_id', 'scrape_run_id', 'dedupe_key']).doNothing())
        .returning('id')
        .execute();
      return { inserted: inserted.length, skipped: rows.length - inserted.length };
    });
  }
  listCloserRawRecordsByRun(tenantId: string, scrapeRunId: string): Promise<CloserRawRecordRow[]> {
    return this.run(tenantId, (trx) =>
      trx
        .selectFrom('closer_raw_records')
        .selectAll()
        .where('tenant_id', '=', tenantId)
        .where('scrape_run_id', '=', scrapeRunId)
        .orderBy('created_at', 'asc')
        .execute(),
    );
  }
  linkCloserRawRecordToAccount(
    tenantId: string,
    id: string,
    accountId: string,
  ): Promise<CloserRawRecordRow | null> {
    return this.run(
      tenantId,
      async (trx) =>
        (await trx
          .updateTable('closer_raw_records')
          .set({ account_id: accountId })
          .where('tenant_id', '=', tenantId)
          .where('id', '=', id)
          .returningAll()
          .executeTakeFirst()) ?? null,
    );
  }

  // --- Sales Closer: account profiles (upsert on (tenant, account)) ---

  upsertCloserAccountProfile(row: CloserAccountProfileRow): Promise<CloserAccountProfileRow> {
    return this.run(row.tenant_id, (trx) =>
      trx
        .insertInto('closer_account_profiles')
        .values({
          ...row,
          dimensions: jb(row.dimensions),
          oem_brands: jb(row.oem_brands),
          funnel_audit: jb(row.funnel_audit),
        })
        .onConflict((oc) =>
          oc.columns(['tenant_id', 'account_id']).doUpdateSet({
            tier: row.tier,
            score: row.score,
            dimensions: jb(row.dimensions),
            rationale: row.rationale,
            model: row.model,
            crm_vendor: row.crm_vendor,
            monthly_lead_volume: row.monthly_lead_volume,
            rooftops: row.rooftops,
            oem_brands: jb(row.oem_brands),
            funnel_audit: jb(row.funnel_audit),
            scored_at: row.scored_at,
            updated_at: nowIso(),
          }),
        )
        .returningAll()
        .executeTakeFirstOrThrow(),
    );
  }
  getCloserAccountProfile(
    tenantId: string,
    accountId: string,
  ): Promise<CloserAccountProfileRow | null> {
    return this.run(
      tenantId,
      async (trx) =>
        (await trx
          .selectFrom('closer_account_profiles')
          .selectAll()
          .where('tenant_id', '=', tenantId)
          .where('account_id', '=', accountId)
          .executeTakeFirst()) ?? null,
    );
  }
  listCloserAccountProfiles(
    tenantId: string,
    filter: ListCloserAccountProfilesFilter = {},
  ): Promise<CloserAccountProfileRow[]> {
    return this.run(tenantId, (trx) => {
      let q = trx
        .selectFrom('closer_account_profiles')
        .selectAll()
        .where('tenant_id', '=', tenantId);
      if (filter.tier !== undefined) q = q.where('tier', '=', filter.tier);
      return q.orderBy('score', 'desc').execute();
    });
  }

  // --- Sales Closer: briefs ---

  createCloserBrief(row: CloserBriefRow): Promise<CloserBriefRow> {
    return this.run(row.tenant_id, async (trx) => {
      await trx
        .insertInto('closer_briefs')
        .values({ ...row, structured: jb(row.structured), claims: jb(row.claims) })
        .execute();
      return row;
    });
  }
  getCloserBrief(tenantId: string, id: string): Promise<CloserBriefRow | null> {
    return this.run(
      tenantId,
      async (trx) =>
        (await trx
          .selectFrom('closer_briefs')
          .selectAll()
          .where('tenant_id', '=', tenantId)
          .where('id', '=', id)
          .executeTakeFirst()) ?? null,
    );
  }
  listCloserBriefsByAccount(tenantId: string, accountId: string): Promise<CloserBriefRow[]> {
    return this.run(tenantId, (trx) =>
      trx
        .selectFrom('closer_briefs')
        .selectAll()
        .where('tenant_id', '=', tenantId)
        .where('account_id', '=', accountId)
        .orderBy('created_at', 'desc')
        .execute(),
    );
  }
  updateCloserBriefStatus(
    tenantId: string,
    id: string,
    status: string,
  ): Promise<CloserBriefRow | null> {
    return this.run(
      tenantId,
      async (trx) =>
        (await trx
          .updateTable('closer_briefs')
          .set({ status, updated_at: nowIso() })
          .where('tenant_id', '=', tenantId)
          .where('id', '=', id)
          .returningAll()
          .executeTakeFirst()) ?? null,
    );
  }
}
