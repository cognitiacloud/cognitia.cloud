import { randomUUID } from 'node:crypto';
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
import type { ExternalObjectMapsTable } from './schema.js';

/**
 * In-memory Repository for the MVP and tests. It emulates RLS by filtering
 * every read on tenant_id, so a query for Tenant A can never observe Tenant B
 * rows — the same invariant the production Kysely+RLS path enforces in Postgres.
 *
 * Not for production use (no durability); Postgres is the source of truth.
 */
export class InMemoryRepository implements Repository {
  private accounts = new Map<string, AccountRow>();
  private contacts = new Map<string, ContactRow>();
  private opportunities = new Map<string, OpportunityRow>();
  private events: EventRow[] = [];
  private runs = new Map<string, AgentRunRow>();
  private actions = new Map<string, AgentActionRow>();
  private audits: AuditEventRow[] = [];
  private proofs = new Map<string, ProofRow>();
  private agents = new Map<string, AgentRow>();
  private atcs = new Map<string, AtcRow>();
  private permissions = new Map<string, AgentPermissionRow>();
  private leadIntakes = new Map<string, LeadIntakeRow>();
  private leadOutcomes: LeadOutcomeRow[] = [];
  private skills = new Map<string, SkillRow>();
  private skillVersions = new Map<string, SkillVersionRow>();
  private skillProofs: SkillProofRow[] = [];
  private reputationEvents: ReputationEventRow[] = [];
  private reputationSnapshots: ReputationSnapshotRow[] = [];
  private creditsAccounts = new Map<string, CreditsAccountRow>();
  private creditsLedger: CreditsLedgerEntryRow[] = [];
  private walletBindings: WalletBindingRow[] = [];
  private workOrders = new Map<string, WorkOrderRow>();
  private disputeResolutions: DisputeResolutionRow[] = [];
  private marketplaceListings = new Map<string, MarketplaceListingRow>();
  private fabricNodes = new Map<string, FabricNodeRow>();
  private executionOrders = new Map<string, SkillExecutionOrderRow>();
  private externalMaps = new Map<string, ExternalObjectMapsTable>();
  private syncRuns = new Map<string, SyncRunRow>();
  private feedbackLabels: FeedbackLabelRow[] = [];
  private connections = new Map<string, IntegrationConnectionRow>();
  private closerSources = new Map<string, CloserSourceRow>();
  private closerScrapeRuns = new Map<string, CloserScrapeRunRow>();
  private closerRawRecords = new Map<string, CloserRawRecordRow>();
  private closerAccountProfiles = new Map<string, CloserAccountProfileRow>();
  private closerBriefs = new Map<string, CloserBriefRow>();

  // --- seed helpers (tests / fixtures) ---
  seedAccount(row: AccountRow): void {
    this.accounts.set(row.id, row);
  }
  seedContact(row: ContactRow): void {
    this.contacts.set(row.id, row);
  }
  seedOpportunity(row: OpportunityRow): void {
    this.opportunities.set(row.id, row);
  }
  seedIntegrationConnection(row: IntegrationConnectionRow): void {
    this.connections.set(`${row.tenant_id}|${row.external_system}`, row);
  }

  async getIntegrationConnection(
    tenantId: string,
    externalSystem: string,
  ): Promise<IntegrationConnectionRow | null> {
    return this.connections.get(`${tenantId}|${externalSystem}`) ?? null;
  }

  async updateIntegrationConnectionStatus(
    tenantId: string,
    externalSystem: string,
    status: string,
  ): Promise<IntegrationConnectionRow | null> {
    const key = `${tenantId}|${externalSystem}`;
    const row = this.connections.get(key);
    if (!row) return null;
    const updated = { ...row, status, updated_at: new Date().toISOString() };
    this.connections.set(key, updated);
    return updated;
  }

  /**
   * Key for the external_object_maps unique constraint
   * (tenant_id, external_system, external_type, external_id) from migration 0002.
   * Enforcing it here keeps in-memory behavior identical to Postgres.
   */
  private extKey(tenantId: string, system: string, type: string, externalId: string): string {
    return [tenantId, system, type, externalId].join('|');
  }

  private putExternalMap(
    tenantId: string,
    system: string,
    type: string,
    externalId: string,
    internalId: string,
  ): void {
    const now = new Date().toISOString();
    this.externalMaps.set(this.extKey(tenantId, system, type, externalId), {
      id: randomUUID(),
      tenant_id: tenantId,
      connection_id: null,
      external_system: system,
      external_type: type,
      external_id: externalId,
      internal_type: type,
      internal_id: internalId,
      created_at: now,
      updated_at: now,
    });
  }

  async listAccounts(tenantId: string): Promise<AccountRow[]> {
    return [...this.accounts.values()].filter((a) => a.tenant_id === tenantId);
  }
  async getAccount(tenantId: string, id: string): Promise<AccountRow | null> {
    const a = this.accounts.get(id);
    return a && a.tenant_id === tenantId ? a : null;
  }
  async listContactsByAccount(tenantId: string, accountId: string): Promise<ContactRow[]> {
    return [...this.contacts.values()].filter(
      (c) => c.tenant_id === tenantId && c.account_id === accountId,
    );
  }
  async getContact(tenantId: string, id: string): Promise<ContactRow | null> {
    const c = this.contacts.get(id);
    return c && c.tenant_id === tenantId ? c : null;
  }

  async insertEvent(event: EventRow): Promise<void> {
    this.events.push(event);
  }
  async listEvents(tenantId: string): Promise<EventRow[]> {
    return this.events.filter((e) => e.tenant_id === tenantId);
  }

  async createAgentRun(run: AgentRunRow): Promise<AgentRunRow> {
    this.runs.set(run.id, run);
    return run;
  }
  async getAgentRun(tenantId: string, id: string): Promise<AgentRunRow | null> {
    const r = this.runs.get(id);
    return r && r.tenant_id === tenantId ? r : null;
  }
  async listAgentRuns(tenantId: string): Promise<AgentRunRow[]> {
    return [...this.runs.values()]
      .filter((r) => r.tenant_id === tenantId)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }
  async updateAgentRunStatus(tenantId: string, id: string, status: string): Promise<void> {
    const r = this.runs.get(id);
    if (r && r.tenant_id === tenantId) {
      r.status = status;
      r.updated_at = new Date().toISOString();
    }
  }

  async createAgentAction(action: AgentActionRow): Promise<AgentActionRow> {
    // Enforce unique (tenant_id, idempotency_key) like the DB constraint.
    const existing = await this.findActionByIdempotencyKey(
      action.tenant_id,
      action.idempotency_key,
    );
    if (existing) return existing;
    this.actions.set(action.id, action);
    return action;
  }
  async getAgentAction(tenantId: string, id: string): Promise<AgentActionRow | null> {
    const a = this.actions.get(id);
    return a && a.tenant_id === tenantId ? a : null;
  }
  async findActionByIdempotencyKey(tenantId: string, key: string): Promise<AgentActionRow | null> {
    return (
      [...this.actions.values()].find(
        (a) => a.tenant_id === tenantId && a.idempotency_key === key,
      ) ?? null
    );
  }
  async listAgentActions(
    tenantId: string,
    filter: ListActionsFilter = {},
  ): Promise<AgentActionRow[]> {
    return [...this.actions.values()].filter(
      (a) =>
        a.tenant_id === tenantId &&
        (filter.approvalStatus === undefined || a.approval_status === filter.approvalStatus) &&
        (filter.executionStatus === undefined || a.execution_status === filter.executionStatus),
    );
  }
  async updateAgentAction(
    tenantId: string,
    id: string,
    patch: Partial<AgentActionRow>,
  ): Promise<AgentActionRow> {
    const a = this.actions.get(id);
    if (!a || a.tenant_id !== tenantId) {
      throw new Error('agent_action not found for tenant');
    }
    const updated = { ...a, ...patch, updated_at: new Date().toISOString() };
    this.actions.set(id, updated);
    return updated;
  }

  async listOpportunities(tenantId: string): Promise<OpportunityRow[]> {
    return [...this.opportunities.values()].filter((o) => o.tenant_id === tenantId);
  }
  async listOpportunitiesByAccount(tenantId: string, accountId: string): Promise<OpportunityRow[]> {
    return [...this.opportunities.values()].filter(
      (o) => o.tenant_id === tenantId && o.account_id === accountId,
    );
  }

  async insertAuditEvent(event: AuditEventRow): Promise<void> {
    this.audits.push(event);
  }
  async listAuditEvents(tenantId: string): Promise<AuditEventRow[]> {
    return this.audits.filter((e) => e.tenant_id === tenantId);
  }

  // --- proofs (append-only; only publish state mutates, mirroring 0009) ---
  async insertProof(row: ProofRow): Promise<ProofRow> {
    const stored = { ...row };
    this.proofs.set(stored.id, stored);
    return { ...stored };
  }
  async getProof(tenantId: string, id: string): Promise<ProofRow | null> {
    const row = this.proofs.get(id);
    return row && row.tenant_id === tenantId ? { ...row } : null;
  }
  async listProofs(tenantId: string, filter?: ListProofsFilter): Promise<ProofRow[]> {
    const rows = [...this.proofs.values()]
      .filter(
        (p) =>
          p.tenant_id === tenantId &&
          (filter?.evidenceTag === undefined || p.evidence_tag === filter.evidenceTag) &&
          (filter?.kind === undefined || p.kind === filter.kind) &&
          (filter?.publicSafe === undefined || p.public_safe === filter.publicSafe),
      )
      .map((p) => ({ ...p }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return filter?.limit !== undefined ? rows.slice(0, Math.max(0, filter.limit)) : rows;
  }
  // --- agents + ATCs + permissions (COG-004) ---
  async createAgent(row: AgentRow): Promise<AgentRow> {
    const duplicate = [...this.agents.values()].some(
      (a) => a.tenant_id === row.tenant_id && a.slug === row.slug,
    );
    if (duplicate) throw new Error(`duplicate key: agents (tenant_id, slug) ${row.slug}`);
    this.agents.set(row.id, { ...row });
    return { ...row };
  }
  async getAgent(tenantId: string, id: string): Promise<AgentRow | null> {
    const row = this.agents.get(id);
    return row && row.tenant_id === tenantId ? { ...row } : null;
  }
  async listAgents(tenantId: string): Promise<AgentRow[]> {
    return [...this.agents.values()]
      .filter((a) => a.tenant_id === tenantId)
      .map((a) => ({ ...a }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  async createAtc(row: AtcRow): Promise<AtcRow> {
    this.atcs.set(row.id, { ...row });
    return { ...row };
  }
  async getAtc(tenantId: string, id: string): Promise<AtcRow | null> {
    const row = this.atcs.get(id);
    return row && row.tenant_id === tenantId ? { ...row } : null;
  }
  async listAtcsByAgent(tenantId: string, agentId: string): Promise<AtcRow[]> {
    return [...this.atcs.values()]
      .filter((c) => c.tenant_id === tenantId && c.agent_id === agentId)
      .map((c) => ({ ...c }))
      .sort((a, b) => b.issued_at.localeCompare(a.issued_at));
  }
  async updateAtcStatus(tenantId: string, id: string, status: string): Promise<AtcRow | null> {
    const row = this.atcs.get(id);
    if (!row || row.tenant_id !== tenantId) return null;
    // Mirror the 0009 trigger: revoked is terminal.
    if (row.status === 'revoked' && status !== 'revoked') {
      throw new Error(`ATC ${id}: revoked credentials cannot change status`);
    }
    row.status = status;
    row.updated_at = new Date().toISOString();
    return { ...row };
  }
  async upsertAgentPermission(row: AgentPermissionRow): Promise<AgentPermissionRow> {
    const key = `${row.tenant_id}|${row.agent_id}|${row.action_key}`;
    const existing = this.permissions.get(key);
    const stored = existing
      ? {
          ...existing,
          effect: row.effect,
          constraints: row.constraints,
          updated_at: row.updated_at,
        }
      : { ...row };
    this.permissions.set(key, stored);
    return { ...stored };
  }
  async listAgentPermissions(tenantId: string, agentId: string): Promise<AgentPermissionRow[]> {
    return [...this.permissions.values()]
      .filter((p) => p.tenant_id === tenantId && p.agent_id === agentId)
      .map((p) => ({ ...p }))
      .sort((a, b) => a.action_key.localeCompare(b.action_key));
  }

  // --- MoverOS lead intakes (COG-006) ---
  async insertLeadIntake(row: LeadIntakeRow): Promise<LeadIntakeRow> {
    this.leadIntakes.set(row.id, { ...row });
    return { ...row };
  }
  async getLeadIntake(tenantId: string, id: string): Promise<LeadIntakeRow | null> {
    const row = this.leadIntakes.get(id);
    return row && row.tenant_id === tenantId ? { ...row } : null;
  }
  async listLeadIntakes(tenantId: string): Promise<LeadIntakeRow[]> {
    return [...this.leadIntakes.values()]
      .filter((l) => l.tenant_id === tenantId)
      .map((l) => ({ ...l }))
      .sort((a, b) => b.received_at.localeCompare(a.received_at));
  }
  async purgeLeadIntakePii(tenantId: string, id: string): Promise<LeadIntakeRow | null> {
    const row = this.leadIntakes.get(id);
    if (!row || row.tenant_id !== tenantId) return null;
    row.contact_name_enc = null;
    row.contact_phone_enc = null;
    row.message_body_enc = null;
    row.pii_status = 'purged';
    row.status = 'purged';
    row.updated_at = new Date().toISOString();
    return { ...row };
  }

  async updateLeadIntakeStatus(
    tenantId: string,
    id: string,
    status: string,
  ): Promise<LeadIntakeRow | null> {
    const row = this.leadIntakes.get(id);
    if (!row || row.tenant_id !== tenantId) return null;
    row.status = status;
    row.updated_at = new Date().toISOString();
    return { ...row };
  }

  // --- lead outcomes (COG-006) ---
  async insertLeadOutcome(row: LeadOutcomeRow): Promise<LeadOutcomeRow> {
    this.leadOutcomes.push({ ...row });
    return { ...row };
  }
  async listLeadOutcomes(tenantId: string, leadIntakeId?: string): Promise<LeadOutcomeRow[]> {
    return this.leadOutcomes
      .filter(
        (o) =>
          o.tenant_id === tenantId &&
          (leadIntakeId === undefined || o.lead_intake_id === leadIntakeId),
      )
      .map((o) => ({ ...o }));
  }

  // --- SkillProof (COG-005) ---
  async upsertSkill(row: SkillRow): Promise<SkillRow> {
    const existing = [...this.skills.values()].find(
      (s) => s.tenant_id === row.tenant_id && s.slug === row.slug,
    );
    if (existing) return { ...existing };
    this.skills.set(row.id, { ...row });
    return { ...row };
  }
  async getSkill(tenantId: string, id: string): Promise<SkillRow | null> {
    const row = this.skills.get(id);
    return row && row.tenant_id === tenantId ? { ...row } : null;
  }
  async listSkills(tenantId: string): Promise<SkillRow[]> {
    return [...this.skills.values()]
      .filter((s) => s.tenant_id === tenantId)
      .map((s) => ({ ...s }))
      .sort((a, b) => a.slug.localeCompare(b.slug));
  }
  async insertSkillVersion(row: SkillVersionRow): Promise<SkillVersionRow> {
    this.skillVersions.set(row.id, { ...row });
    return { ...row };
  }
  async getSkillVersion(tenantId: string, id: string): Promise<SkillVersionRow | null> {
    const row = this.skillVersions.get(id);
    return row && row.tenant_id === tenantId ? { ...row } : null;
  }
  async listSkillVersions(tenantId: string, skillId: string): Promise<SkillVersionRow[]> {
    return [...this.skillVersions.values()]
      .filter((v) => v.tenant_id === tenantId && v.skill_id === skillId)
      .map((v) => ({ ...v }));
  }
  async setSkillVersionTier(
    tenantId: string,
    id: string,
    tier: number,
  ): Promise<SkillVersionRow | null> {
    const row = this.skillVersions.get(id);
    if (!row || row.tenant_id !== tenantId) return null;
    // Mirror the 0013 trigger: tier >= 2 upgrades need a verified_fact
    // skill proof for this skill.
    if (tier >= 2 && tier > row.proof_tier) {
      const ok = this.skillProofs.some(
        (sp) =>
          sp.tenant_id === tenantId &&
          sp.skill_id === row.skill_id &&
          this.proofs.get(sp.proof_id)?.evidence_tag === 'verified_fact',
      );
      if (!ok) {
        throw new Error(`skill version ${id}: tier ${tier} requires a verified_fact proof`);
      }
    }
    row.proof_tier = tier;
    row.updated_at = new Date().toISOString();
    return { ...row };
  }
  async yankSkillVersion(
    tenantId: string,
    id: string,
    reason: string,
  ): Promise<SkillVersionRow | null> {
    const row = this.skillVersions.get(id);
    if (!row || row.tenant_id !== tenantId) return null;
    row.yanked = true;
    row.yank_reason = reason;
    row.updated_at = new Date().toISOString();
    return { ...row };
  }
  async insertSkillProof(row: SkillProofRow): Promise<SkillProofRow> {
    // Mirror the 0010 trigger: T2+ certification requires verified_fact proof.
    if (['T2_verified', 'T3_economically_proven'].includes(row.tier)) {
      const proof = this.proofs.get(row.proof_id);
      if (proof?.evidence_tag !== 'verified_fact') {
        throw new Error(`skill_proof tier ${row.tier} requires a verified_fact proof`);
      }
    }
    this.skillProofs.push({ ...row });
    return { ...row };
  }
  async listSkillProofs(tenantId: string, skillId?: string): Promise<SkillProofRow[]> {
    return this.skillProofs
      .filter(
        (sp) => sp.tenant_id === tenantId && (skillId === undefined || sp.skill_id === skillId),
      )
      .map((sp) => ({ ...sp }));
  }

  // --- reputation events (append-only; mirrors the 0010 guard trigger) ---
  async insertReputationEvent(row: ReputationEventRow): Promise<ReputationEventRow> {
    if (row.delta > 0) {
      const proof = this.proofs.get(row.proof_id);
      if (proof?.evidence_tag !== 'verified_fact') {
        throw new Error(
          `positive reputation requires a verified_fact proof (proof ${row.proof_id} is ${proof?.evidence_tag})`,
        );
      }
    }
    this.reputationEvents.push({ ...row });
    return { ...row };
  }
  async listReputationEvents(tenantId: string, agentId?: string): Promise<ReputationEventRow[]> {
    return this.reputationEvents
      .filter((e) => e.tenant_id === tenantId && (agentId === undefined || e.agent_id === agentId))
      .map((e) => ({ ...e }));
  }
  async countReputation(tenantId: string): Promise<PublicReputationCounts> {
    const rows = this.reputationEvents.filter((e) => e.tenant_id === tenantId);
    return {
      agents_with_reputation: new Set(rows.map((e) => e.agent_id)).size,
      total_events: rows.length,
      positive_events: rows.filter((e) => Number(e.delta) > 0).length,
    };
  }
  // --- internal credits + wallet placeholders (COG-009) ---
  async upsertCreditsAccount(row: CreditsAccountRow): Promise<CreditsAccountRow> {
    const existing = [...this.creditsAccounts.values()].find(
      (a) =>
        a.tenant_id === row.tenant_id &&
        a.owner_type === row.owner_type &&
        a.owner_id === row.owner_id,
    );
    if (existing) return { ...existing };
    this.creditsAccounts.set(row.id, { ...row });
    return { ...row };
  }
  async getCreditsAccount(tenantId: string, id: string): Promise<CreditsAccountRow | null> {
    const row = this.creditsAccounts.get(id);
    return row && row.tenant_id === tenantId ? { ...row } : null;
  }
  async listCreditsAccounts(tenantId: string): Promise<CreditsAccountRow[]> {
    return [...this.creditsAccounts.values()]
      .filter((a) => a.tenant_id === tenantId)
      .map((a) => ({ ...a }));
  }
  async insertCreditsLedgerPair(
    debit: CreditsLedgerEntryRow,
    credit: CreditsLedgerEntryRow,
  ): Promise<void> {
    // Mirror the 0012 invariants: unique (tenant, idempotency_key, direction),
    // amount > 0, internal rail only, distinct accounts, balanced pair.
    for (const row of [debit, credit]) {
      if (row.amount <= 0) throw new Error('ledger amount must be positive');
      if (row.rail !== 'internal_credits') throw new Error('ledger_internal_rail_only');
      if (row.account_id === row.counter_account_id) {
        throw new Error('ledger_distinct_accounts');
      }
      const duplicate = this.creditsLedger.some(
        (e) =>
          e.tenant_id === row.tenant_id &&
          e.idempotency_key === row.idempotency_key &&
          e.direction === row.direction,
      );
      if (duplicate) throw new Error(`duplicate key: ledger ${row.idempotency_key}`);
    }
    if (debit.amount !== credit.amount) throw new Error('ledger pair must balance');
    this.creditsLedger.push({ ...debit }, { ...credit });
  }
  async listCreditsLedgerEntries(
    tenantId: string,
    accountId?: string,
  ): Promise<CreditsLedgerEntryRow[]> {
    return this.creditsLedger
      .filter(
        (e) => e.tenant_id === tenantId && (accountId === undefined || e.account_id === accountId),
      )
      .map((e) => ({ ...e }));
  }
  async findCreditsLedgerByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<CreditsLedgerEntryRow[]> {
    return this.creditsLedger
      .filter((e) => e.tenant_id === tenantId && e.idempotency_key === idempotencyKey)
      .map((e) => ({ ...e }));
  }
  async insertWalletBinding(row: WalletBindingRow): Promise<WalletBindingRow> {
    // Mirror the 0012 check: placeholder is the only legal status in v1.1.
    if (row.status !== 'placeholder') {
      throw new Error('wallet_bindings status check: only placeholder is legal in v1.1');
    }
    this.walletBindings.push({ ...row });
    return { ...row };
  }
  async listWalletBindings(tenantId: string): Promise<WalletBindingRow[]> {
    return this.walletBindings.filter((w) => w.tenant_id === tenantId).map((w) => ({ ...w }));
  }
  async getWalletBinding(tenantId: string, id: string): Promise<WalletBindingRow | null> {
    const row = this.walletBindings.find((w) => w.id === id && w.tenant_id === tenantId);
    return row ? { ...row } : null;
  }
  async deactivateWalletBinding(tenantId: string, id: string): Promise<WalletBindingRow | null> {
    const row = this.walletBindings.find((w) => w.id === id && w.tenant_id === tenantId);
    if (!row) return null;
    row.status = 'deactivated';
    row.updated_at = new Date().toISOString();
    return { ...row };
  }

  async insertReputationSnapshot(row: ReputationSnapshotRow): Promise<ReputationSnapshotRow> {
    this.reputationSnapshots.push({ ...row });
    return { ...row };
  }
  async listReputationSnapshots(
    tenantId: string,
    agentId: string,
  ): Promise<ReputationSnapshotRow[]> {
    return this.reputationSnapshots
      .filter((s) => s.tenant_id === tenantId && s.agent_id === agentId)
      .map((s) => ({ ...s }))
      .sort((a, b) => b.computed_at.localeCompare(a.computed_at));
  }

  async setProofPublishState(
    tenantId: string,
    id: string,
    publicSafe: boolean,
    redactionCheckPassedAt: string | null,
  ): Promise<ProofRow | null> {
    const row = this.proofs.get(id);
    if (!row || row.tenant_id !== tenantId) return null;
    // Mirror the DB constraint: public requires a passed redaction check.
    if (publicSafe && !redactionCheckPassedAt) {
      throw new Error('proofs_public_requires_redaction');
    }
    row.public_safe = publicSafe;
    row.redaction_check_passed_at = redactionCheckPassedAt;
    return { ...row };
  }

  // --- Agent Economy Lab (AGENT-ECONOMY-001; mirrors the 0016 guards) ---
  async insertWorkOrder(row: WorkOrderRow): Promise<WorkOrderRow> {
    if (row.requested_credits <= 0) {
      throw new Error('work_orders requested_credits check violated: must be > 0');
    }
    this.workOrders.set(row.id, { ...row });
    return { ...row };
  }
  async getWorkOrder(tenantId: string, id: string): Promise<WorkOrderRow | null> {
    const row = this.workOrders.get(id);
    return row && row.tenant_id === tenantId ? { ...row } : null;
  }
  async listWorkOrders(tenantId: string, filter?: ListWorkOrdersFilter): Promise<WorkOrderRow[]> {
    return [...this.workOrders.values()]
      .filter(
        (w) =>
          w.tenant_id === tenantId &&
          (filter?.status === undefined || w.status === filter.status) &&
          (filter?.workerAgentId === undefined || w.worker_agent_id === filter.workerAgentId),
      )
      .map((w) => ({ ...w }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  async updateWorkOrder(
    tenantId: string,
    id: string,
    patch: Partial<WorkOrderRow>,
  ): Promise<WorkOrderRow | null> {
    const row = this.workOrders.get(id);
    if (!row || row.tenant_id !== tenantId) return null;
    const next = { ...row, ...patch };
    // Mirror the 0016/0017 trigger: terminal statuses never transition again.
    if (
      ['verified', 'rejected', 'canceled', 'resolved'].includes(row.status) &&
      next.status !== row.status
    ) {
      throw new Error(`work_order ${id}: ${row.status} is terminal`);
    }
    // Mirror the payout rule: verification / escrow release requires a
    // verified_fact proof (the proof row is the source of truth).
    const releasing =
      (next.status === 'verified' && row.status !== 'verified') ||
      (next.escrow_status === 'released' && row.escrow_status !== 'released');
    if (releasing) {
      if (!next.proof_id) throw new Error(`work_order ${id}: verification requires a proof`);
      const proof = this.proofs.get(next.proof_id);
      if (proof?.evidence_tag !== 'verified_fact') {
        throw new Error(
          `work_order ${id}: escrow release requires a verified_fact proof (got ${proof?.evidence_tag})`,
        );
      }
    }
    // Mirror 0017: resolution only from disputed, only with a verified_fact
    // RESOLUTION proof.
    if (next.status === 'resolved' && row.status !== 'resolved') {
      if (row.status !== 'disputed') {
        throw new Error(
          `work_order ${id}: only disputed orders can be resolved (was ${row.status})`,
        );
      }
      if (!next.resolution_proof_id) {
        throw new Error(`work_order ${id}: resolution requires a resolution proof`);
      }
      const proof = this.proofs.get(next.resolution_proof_id);
      if (proof?.evidence_tag !== 'verified_fact') {
        throw new Error(
          `work_order ${id}: resolution requires a verified_fact proof (got ${proof?.evidence_tag})`,
        );
      }
    }
    next.updated_at = new Date().toISOString();
    this.workOrders.set(id, next);
    return { ...next };
  }
  // --- marketplace listings (AGENT-ECONOMY-004; mirrors the 0018 guards) ---
  private guardListing(row: MarketplaceListingRow, status: string): void {
    const version = this.skillVersions.get(row.skill_version_id);
    if (!version || version.tenant_id !== row.tenant_id) {
      throw new Error(
        `marketplace_listing: skill version ${row.skill_version_id} not found for tenant`,
      );
    }
    if (version.skill_id !== row.skill_id) {
      throw new Error('marketplace_listing: skill_version does not belong to skill');
    }
    if (version.yanked && status === 'active') {
      throw new Error('marketplace_listing: yanked skill versions cannot be listed');
    }
  }
  async insertMarketplaceListing(row: MarketplaceListingRow): Promise<MarketplaceListingRow> {
    if (row.visibility !== 'internal') {
      throw new Error('marketplace_listings visibility check violated: internal only');
    }
    if (row.price_credits <= 0) {
      throw new Error('marketplace_listings price_credits check violated: must be > 0');
    }
    this.guardListing(row, row.status);
    const duplicate = [...this.marketplaceListings.values()].some(
      (l) =>
        l.tenant_id === row.tenant_id &&
        l.agent_id === row.agent_id &&
        l.skill_version_id === row.skill_version_id,
    );
    if (duplicate) {
      throw new Error('duplicate key: marketplace_listings (tenant, agent, skill_version)');
    }
    this.marketplaceListings.set(row.id, { ...row });
    return { ...row };
  }
  async getMarketplaceListing(tenantId: string, id: string): Promise<MarketplaceListingRow | null> {
    const row = this.marketplaceListings.get(id);
    return row && row.tenant_id === tenantId ? { ...row } : null;
  }
  async listMarketplaceListings(
    tenantId: string,
    status?: string,
  ): Promise<MarketplaceListingRow[]> {
    return [...this.marketplaceListings.values()]
      .filter((l) => l.tenant_id === tenantId && (status === undefined || l.status === status))
      .map((l) => ({ ...l }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  async updateMarketplaceListingStatus(
    tenantId: string,
    id: string,
    status: string,
  ): Promise<MarketplaceListingRow | null> {
    const row = this.marketplaceListings.get(id);
    if (!row || row.tenant_id !== tenantId) return null;
    if (!['active', 'withdrawn'].includes(status)) {
      throw new Error(`marketplace_listings status check violated: ${status}`);
    }
    // Mirror the 0018 update trigger: re-activation re-runs the yank guard.
    this.guardListing(row, status);
    const next = { ...row, status, updated_at: new Date().toISOString() };
    this.marketplaceListings.set(id, next);
    return { ...next };
  }

  // --- fabric nodes (LEGEND-001; mirrors the 0019 checks) ---
  private static readonly FABRIC_PLATFORMS = ['macos', 'windows', 'linux', 'cloud'];
  private static readonly FABRIC_STATUSES = ['active', 'quarantined'];
  async insertFabricNode(row: FabricNodeRow): Promise<FabricNodeRow> {
    if (!InMemoryRepository.FABRIC_PLATFORMS.includes(row.platform)) {
      throw new Error(`fabric_nodes platform check violated: ${row.platform}`);
    }
    if (!InMemoryRepository.FABRIC_STATUSES.includes(row.status)) {
      throw new Error(`fabric_nodes status check violated: ${row.status}`);
    }
    const duplicate = [...this.fabricNodes.values()].some(
      (n) => n.tenant_id === row.tenant_id && n.agent_id === row.agent_id && n.label === row.label,
    );
    if (duplicate) {
      throw new Error('duplicate key: fabric_nodes (tenant, agent, label)');
    }
    this.fabricNodes.set(row.id, { ...row });
    return { ...row };
  }
  async getFabricNode(tenantId: string, id: string): Promise<FabricNodeRow | null> {
    const row = this.fabricNodes.get(id);
    return row && row.tenant_id === tenantId ? { ...row } : null;
  }
  async listFabricNodes(tenantId: string, status?: string): Promise<FabricNodeRow[]> {
    return [...this.fabricNodes.values()]
      .filter((n) => n.tenant_id === tenantId && (status === undefined || n.status === status))
      .map((n) => ({ ...n }))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  async updateFabricNodeStatus(
    tenantId: string,
    id: string,
    status: string,
  ): Promise<FabricNodeRow | null> {
    const row = this.fabricNodes.get(id);
    if (!row || row.tenant_id !== tenantId) return null;
    if (!InMemoryRepository.FABRIC_STATUSES.includes(status)) {
      throw new Error(`fabric_nodes status check violated: ${status}`);
    }
    const next = { ...row, status, updated_at: new Date().toISOString() };
    this.fabricNodes.set(id, next);
    return { ...next };
  }

  // --- dispute resolutions (AGENT-ECONOMY-002; mirrors the 0017 guards) ---
  async insertDisputeResolution(row: DisputeResolutionRow): Promise<DisputeResolutionRow> {
    const wo = this.workOrders.get(row.work_order_id);
    if (!wo || wo.tenant_id !== row.tenant_id) {
      throw new Error(`dispute_resolution: work order ${row.work_order_id} not found for tenant`);
    }
    if (wo.status !== 'disputed') {
      throw new Error(
        `dispute_resolution: work order ${row.work_order_id} is not disputed (status ${wo.status})`,
      );
    }
    if (row.worker_credits + row.requester_credits !== Number(wo.requested_credits)) {
      throw new Error('dispute_resolution: split must conserve escrow');
    }
    if (row.decision === 'release' && row.requester_credits !== 0) {
      throw new Error('dispute_resolution: release means everything to the worker');
    }
    if (row.decision === 'refund' && row.worker_credits !== 0) {
      throw new Error('dispute_resolution: refund means everything to the requester');
    }
    const duplicate = this.disputeResolutions.some((r) => r.work_order_id === row.work_order_id);
    if (duplicate) throw new Error('duplicate key: dispute_resolutions (work_order_id)');
    this.disputeResolutions.push({ ...row });
    return { ...row };
  }
  async getDisputeResolutionByWorkOrder(
    tenantId: string,
    workOrderId: string,
  ): Promise<DisputeResolutionRow | null> {
    const row = this.disputeResolutions.find(
      (r) => r.tenant_id === tenantId && r.work_order_id === workOrderId,
    );
    return row ? { ...row } : null;
  }
  async listDisputeResolutions(tenantId: string): Promise<DisputeResolutionRow[]> {
    return this.disputeResolutions
      .filter((r) => r.tenant_id === tenantId)
      .map((r) => ({ ...r }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  async insertSkillExecutionOrder(row: SkillExecutionOrderRow): Promise<SkillExecutionOrderRow> {
    // Mirror the 0016 check: the lab executes nothing for real.
    if (row.simulation !== true) {
      throw new Error('skill_execution_orders simulation check violated: must be true');
    }
    this.executionOrders.set(row.id, { ...row });
    return { ...row };
  }
  async listSkillExecutionOrders(
    tenantId: string,
    workOrderId?: string,
  ): Promise<SkillExecutionOrderRow[]> {
    return [...this.executionOrders.values()]
      .filter(
        (e) =>
          e.tenant_id === tenantId &&
          (workOrderId === undefined || e.work_order_id === workOrderId),
      )
      .map((e) => ({ ...e }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  async updateSkillExecutionOrder(
    tenantId: string,
    id: string,
    patch: Partial<SkillExecutionOrderRow>,
  ): Promise<SkillExecutionOrderRow | null> {
    const row = this.executionOrders.get(id);
    if (!row || row.tenant_id !== tenantId) return null;
    const next = { ...row, ...patch, simulation: true as const };
    next.updated_at = new Date().toISOString();
    this.executionOrders.set(id, next);
    return { ...next };
  }

  async insertFeedbackLabel(row: FeedbackLabelRow): Promise<void> {
    this.feedbackLabels.push(row);
  }
  async listFeedbackLabels(tenantId: string, subjectRef?: string): Promise<FeedbackLabelRow[]> {
    return this.feedbackLabels.filter(
      (f) => f.tenant_id === tenantId && (subjectRef === undefined || f.subject_ref === subjectRef),
    );
  }

  async findInternalIdByExternal(
    tenantId: string,
    externalSystem: string,
    externalType: string,
    externalId: string,
  ): Promise<string | null> {
    const map = this.externalMaps.get(
      this.extKey(tenantId, externalSystem, externalType, externalId),
    );
    return map?.internal_id ?? null;
  }

  async ingestExternalAccount(input: IngestAccountInput): Promise<IngestResult> {
    const now = new Date().toISOString();
    const existingId = await this.findInternalIdByExternal(
      input.tenantId,
      input.externalSystem,
      'company',
      input.externalId,
    );
    if (existingId) {
      const a = this.accounts.get(existingId);
      if (a) {
        this.accounts.set(existingId, {
          ...a,
          name: input.account.name ?? a.name,
          domain: input.account.domain ?? a.domain,
          industry: input.account.industry ?? a.industry,
          employee_count: input.account.employeeCount ?? a.employee_count,
          region: input.account.region ?? a.region,
          updated_at: now,
        });
      }
      return { id: existingId, created: false };
    }
    const id = randomUUID();
    this.accounts.set(id, {
      id,
      tenant_id: input.tenantId,
      name: input.account.name,
      domain: input.account.domain ?? null,
      industry: input.account.industry ?? null,
      employee_count: input.account.employeeCount ?? null,
      region: input.account.region ?? null,
      fit_score: null,
      timing_score: null,
      attributes: {},
      created_at: now,
      updated_at: now,
    });
    this.putExternalMap(input.tenantId, input.externalSystem, 'company', input.externalId, id);
    return { id, created: true };
  }

  async ingestExternalContact(
    input: IngestContactInput,
  ): Promise<{ contactId: string; created: boolean }> {
    const now = new Date().toISOString();
    const existingId = await this.findInternalIdByExternal(
      input.tenantId,
      input.externalSystem,
      'contact',
      input.externalId,
    );
    if (existingId) {
      const contact = this.contacts.get(existingId);
      if (contact) {
        this.contacts.set(existingId, {
          ...contact,
          account_id: input.contact.accountId ?? contact.account_id,
          full_name: input.contact.fullName ?? contact.full_name,
          title: input.contact.title ?? contact.title,
          persona: input.contact.persona ?? contact.persona,
          email_hash: input.contact.emailHash ?? contact.email_hash,
          updated_at: now,
        });
      }
      return { contactId: existingId, created: false };
    }
    const contactId = randomUUID();
    this.contacts.set(contactId, {
      id: contactId,
      tenant_id: input.tenantId,
      account_id: input.contact.accountId ?? null,
      full_name: input.contact.fullName ?? null,
      title: input.contact.title ?? null,
      persona: input.contact.persona ?? null,
      email_hash: input.contact.emailHash ?? null,
      phone_hash: null,
      is_suppressed: false,
      attributes: {},
      created_at: now,
      updated_at: now,
    });
    this.putExternalMap(
      input.tenantId,
      input.externalSystem,
      'contact',
      input.externalId,
      contactId,
    );
    return { contactId, created: true };
  }

  async ingestExternalOpportunity(input: IngestOpportunityInput): Promise<IngestResult> {
    const now = new Date().toISOString();
    const existingId = await this.findInternalIdByExternal(
      input.tenantId,
      input.externalSystem,
      'deal',
      input.externalId,
    );
    if (existingId) {
      const o = this.opportunities.get(existingId);
      if (o) {
        this.opportunities.set(existingId, {
          ...o,
          account_id: input.opportunity.accountId ?? o.account_id,
          name: input.opportunity.name ?? o.name,
          stage: input.opportunity.stage ?? o.stage,
          amount: input.opportunity.amount ?? o.amount,
          owner_ref: input.opportunity.ownerRef ?? o.owner_ref,
          updated_at: now,
        });
      }
      return { id: existingId, created: false };
    }
    const id = randomUUID();
    this.opportunities.set(id, {
      id,
      tenant_id: input.tenantId,
      account_id: input.opportunity.accountId,
      name: input.opportunity.name,
      stage: input.opportunity.stage ?? 'open',
      amount: input.opportunity.amount ?? null,
      owner_ref: input.opportunity.ownerRef ?? null,
      attributes: {},
      created_at: now,
      updated_at: now,
    });
    this.putExternalMap(input.tenantId, input.externalSystem, 'deal', input.externalId, id);
    return { id, created: true };
  }

  async createSyncRun(input: {
    tenantId: string;
    connectionId?: string | null;
    status?: string;
  }): Promise<SyncRunRow> {
    const now = new Date().toISOString();
    const row: SyncRunRow = {
      id: randomUUID(),
      tenant_id: input.tenantId,
      connection_id: input.connectionId ?? null,
      status: input.status ?? 'running',
      started_at: now,
      finished_at: null,
      stats: {},
      created_at: now,
      updated_at: now,
    };
    this.syncRuns.set(row.id, row);
    return row;
  }

  async updateSyncRun(
    tenantId: string,
    id: string,
    patch: Partial<Pick<SyncRunRow, 'status' | 'finished_at' | 'stats'>>,
  ): Promise<SyncRunRow> {
    const row = this.syncRuns.get(id);
    if (!row || row.tenant_id !== tenantId) {
      throw new Error('sync_run not found for tenant');
    }
    const updated = { ...row, ...patch, updated_at: new Date().toISOString() };
    this.syncRuns.set(id, updated);
    return updated;
  }

  // --- Sales Closer: sources (mirrors the 0020 disallowed/active guard) ---
  async createCloserSource(row: CloserSourceRow): Promise<CloserSourceRow> {
    if (row.active && row.source_risk === 'disallowed') {
      throw new Error('closer_source: a disallowed source cannot be active');
    }
    this.closerSources.set(row.id, { ...row });
    return { ...row };
  }
  async getCloserSource(tenantId: string, id: string): Promise<CloserSourceRow | null> {
    const row = this.closerSources.get(id);
    return row && row.tenant_id === tenantId ? { ...row } : null;
  }
  async listCloserSources(
    tenantId: string,
    filter: ListCloserSourcesFilter = {},
  ): Promise<CloserSourceRow[]> {
    return [...this.closerSources.values()]
      .filter(
        (s) =>
          s.tenant_id === tenantId && (filter.active === undefined || s.active === filter.active),
      )
      .map((s) => ({ ...s }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  async updateCloserSource(
    tenantId: string,
    id: string,
    patch: Partial<
      Pick<
        CloserSourceRow,
        'label' | 'input' | 'source_risk' | 'max_results' | 'schedule' | 'active'
      >
    >,
  ): Promise<CloserSourceRow | null> {
    const row = this.closerSources.get(id);
    if (!row || row.tenant_id !== tenantId) return null;
    const next = { ...row, ...patch, updated_at: new Date().toISOString() };
    if (next.active && next.source_risk === 'disallowed') {
      throw new Error('closer_source: a disallowed source cannot be active');
    }
    this.closerSources.set(id, next);
    return { ...next };
  }

  // --- Sales Closer: scrape runs ---
  async createCloserScrapeRun(row: CloserScrapeRunRow): Promise<CloserScrapeRunRow> {
    // Mirror the 0020 check: a disallowed source can never produce a run.
    if ((row.source_risk as string) === 'disallowed') {
      throw new Error('closer_scrape_run: a disallowed source can never run');
    }
    this.closerScrapeRuns.set(row.id, { ...row });
    return { ...row };
  }
  async getCloserScrapeRun(tenantId: string, id: string): Promise<CloserScrapeRunRow | null> {
    const row = this.closerScrapeRuns.get(id);
    return row && row.tenant_id === tenantId ? { ...row } : null;
  }
  async listCloserScrapeRuns(
    tenantId: string,
    filter: ListCloserScrapeRunsFilter = {},
  ): Promise<CloserScrapeRunRow[]> {
    return [...this.closerScrapeRuns.values()]
      .filter(
        (r) =>
          r.tenant_id === tenantId && (filter.status === undefined || r.status === filter.status),
      )
      .map((r) => ({ ...r }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  async updateCloserScrapeRun(
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
    const row = this.closerScrapeRuns.get(id);
    if (!row || row.tenant_id !== tenantId) return null;
    const next = { ...row, ...patch, updated_at: new Date().toISOString() };
    this.closerScrapeRuns.set(id, next);
    return { ...next };
  }

  // --- Sales Closer: raw records (idempotent on (tenant, run, dedupe_key)) ---
  private closerRawKey(row: {
    tenant_id: string;
    scrape_run_id: string;
    dedupe_key: string;
  }): string {
    return [row.tenant_id, row.scrape_run_id, row.dedupe_key].join('|');
  }
  async insertCloserRawRecords(rows: CloserRawRecordRow[]): Promise<CloserRawIngestResult> {
    let inserted = 0;
    let skipped = 0;
    const seen = new Set<string>(
      [...this.closerRawRecords.values()].map((r) => this.closerRawKey(r)),
    );
    for (const row of rows) {
      const key = this.closerRawKey(row);
      if (seen.has(key)) {
        skipped += 1;
        continue;
      }
      seen.add(key);
      this.closerRawRecords.set(row.id, { ...row });
      inserted += 1;
    }
    return { inserted, skipped };
  }
  async listCloserRawRecordsByRun(
    tenantId: string,
    scrapeRunId: string,
  ): Promise<CloserRawRecordRow[]> {
    return [...this.closerRawRecords.values()]
      .filter((r) => r.tenant_id === tenantId && r.scrape_run_id === scrapeRunId)
      .map((r) => ({ ...r }))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  async linkCloserRawRecordToAccount(
    tenantId: string,
    id: string,
    accountId: string,
  ): Promise<CloserRawRecordRow | null> {
    const row = this.closerRawRecords.get(id);
    if (!row || row.tenant_id !== tenantId) return null;
    const next = { ...row, account_id: accountId };
    this.closerRawRecords.set(id, next);
    return { ...next };
  }

  // --- Sales Closer: account profiles (upsert on (tenant, account)) ---
  async upsertCloserAccountProfile(row: CloserAccountProfileRow): Promise<CloserAccountProfileRow> {
    const existing = [...this.closerAccountProfiles.values()].find(
      (p) => p.tenant_id === row.tenant_id && p.account_id === row.account_id,
    );
    if (existing) {
      const next = {
        ...existing,
        ...row,
        id: existing.id,
        created_at: existing.created_at,
        updated_at: new Date().toISOString(),
      };
      this.closerAccountProfiles.set(existing.id, next);
      return { ...next };
    }
    this.closerAccountProfiles.set(row.id, { ...row });
    return { ...row };
  }
  async getCloserAccountProfile(
    tenantId: string,
    accountId: string,
  ): Promise<CloserAccountProfileRow | null> {
    const row = [...this.closerAccountProfiles.values()].find(
      (p) => p.tenant_id === tenantId && p.account_id === accountId,
    );
    return row ? { ...row } : null;
  }
  async listCloserAccountProfiles(
    tenantId: string,
    filter: ListCloserAccountProfilesFilter = {},
  ): Promise<CloserAccountProfileRow[]> {
    return [...this.closerAccountProfiles.values()]
      .filter(
        (p) => p.tenant_id === tenantId && (filter.tier === undefined || p.tier === filter.tier),
      )
      .map((p) => ({ ...p }))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }

  // --- Sales Closer: briefs ---
  async createCloserBrief(row: CloserBriefRow): Promise<CloserBriefRow> {
    this.closerBriefs.set(row.id, { ...row });
    return { ...row };
  }
  async getCloserBrief(tenantId: string, id: string): Promise<CloserBriefRow | null> {
    const row = this.closerBriefs.get(id);
    return row && row.tenant_id === tenantId ? { ...row } : null;
  }
  async listCloserBriefsByAccount(tenantId: string, accountId: string): Promise<CloserBriefRow[]> {
    return [...this.closerBriefs.values()]
      .filter((b) => b.tenant_id === tenantId && b.account_id === accountId)
      .map((b) => ({ ...b }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  async updateCloserBriefStatus(
    tenantId: string,
    id: string,
    status: string,
  ): Promise<CloserBriefRow | null> {
    const row = this.closerBriefs.get(id);
    if (!row || row.tenant_id !== tenantId) return null;
    const next = { ...row, status, updated_at: new Date().toISOString() };
    this.closerBriefs.set(id, next);
    return { ...next };
  }
}
