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
  CreditsAccountRow,
  CreditsLedgerEntryRow,
  WalletBindingRow,
  ListActionsFilter,
  ListProofsFilter,
  ListFieldProvenanceFilter,
  TenantRow,
  FieldProvenanceRow,
  IngestResult,
  IngestAccountInput,
  IngestContactInput,
  IngestOpportunityInput,
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
  private tenants = new Map<string, TenantRow>();
  private fieldProvenance = new Map<string, FieldProvenanceRow>();
  private externalMaps = new Map<string, ExternalObjectMapsTable>();
  private syncRuns = new Map<string, SyncRunRow>();
  private feedbackLabels: FeedbackLabelRow[] = [];
  private connections = new Map<string, IntegrationConnectionRow>();

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
    return [...this.proofs.values()]
      .filter(
        (p) =>
          p.tenant_id === tenantId &&
          (filter?.evidenceTag === undefined || p.evidence_tag === filter.evidenceTag) &&
          (filter?.kind === undefined || p.kind === filter.kind) &&
          (filter?.publicSafe === undefined || p.public_safe === filter.publicSafe),
      )
      .map((p) => ({ ...p }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
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

  // --- tenants (COG-012 provisioning) ---
  async createTenant(row: TenantRow): Promise<TenantRow> {
    const existing = [...this.tenants.values()].find((t) => t.slug === row.slug);
    if (existing) return { ...existing };
    this.tenants.set(row.id, { ...row });
    return { ...row };
  }
  async getTenantBySlug(slug: string): Promise<TenantRow | null> {
    const row = [...this.tenants.values()].find((t) => t.slug === slug);
    return row ? { ...row } : null;
  }
  async listTenants(): Promise<TenantRow[]> {
    return [...this.tenants.values()].map((t) => ({ ...t }));
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

  // --- field provenance (COG-016; mirrors the 0015 constraints + triggers) ---
  async insertFieldProvenance(row: FieldProvenanceRow): Promise<FieldProvenanceRow> {
    if (!['account', 'contact', 'opportunity'].includes(row.entity_type)) {
      throw new Error(`field_provenance entity_type check violated: ${row.entity_type}`);
    }
    if (!['ingest', 'human_entry', 'agent_inference', 'enrichment', 'verification'].includes(row.method)) {
      throw new Error(`field_provenance method check violated: ${row.method}`);
    }
    if (row.confidence < 0 || row.confidence > 1) {
      throw new Error('field_provenance confidence check violated: must be in [0, 1]');
    }
    if (row.evidence_tag === 'verified_fact' && (!row.evidence_ref || !row.verifier_ref)) {
      throw new Error('field_provenance_verified_fact_requires_refs');
    }
    if (row.supersedes_provenance_id) {
      const prior = this.fieldProvenance.get(row.supersedes_provenance_id);
      if (!prior) {
        throw new Error(`field_provenance: supersedes target ${row.supersedes_provenance_id} not found`);
      }
      if (
        prior.tenant_id !== row.tenant_id ||
        prior.entity_type !== row.entity_type ||
        prior.entity_id !== row.entity_id ||
        prior.field_name !== row.field_name
      ) {
        throw new Error('field_provenance: supersession must target the same tenant/entity/field');
      }
      const alreadySuperseded = [...this.fieldProvenance.values()].some(
        (p) => p.supersedes_provenance_id === row.supersedes_provenance_id,
      );
      if (alreadySuperseded) {
        throw new Error('duplicate key: uq_field_provenance_supersedes');
      }
    }
    this.fieldProvenance.set(row.id, { ...row });
    return { ...row };
  }
  async getFieldProvenance(tenantId: string, id: string): Promise<FieldProvenanceRow | null> {
    const row = this.fieldProvenance.get(id);
    return row && row.tenant_id === tenantId ? { ...row } : null;
  }
  async listFieldProvenance(
    tenantId: string,
    filter?: ListFieldProvenanceFilter,
  ): Promise<FieldProvenanceRow[]> {
    return [...this.fieldProvenance.values()]
      .filter(
        (p) =>
          p.tenant_id === tenantId &&
          (filter?.entityType === undefined || p.entity_type === filter.entityType) &&
          (filter?.entityId === undefined || p.entity_id === filter.entityId) &&
          (filter?.fieldName === undefined || p.field_name === filter.fieldName) &&
          (filter?.evidenceTag === undefined || p.evidence_tag === filter.evidenceTag),
      )
      .map((p) => ({ ...p }))
      .sort((a, b) => b.observed_at.localeCompare(a.observed_at));
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
}
