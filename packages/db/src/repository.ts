import type {
  AccountsTable,
  ContactsTable,
  EventsTable,
  AgentRunsTable,
  AgentActionsTable,
  AuditEventsTable,
  OpportunitiesTable,
  SyncRunsTable,
  IntegrationConnectionsTable,
  FeedbackLabelsTable,
  ProofsTable,
  AgentsTable,
  AgentTrustCredentialsTable,
  AgentPermissionsTable,
  LeadIntakesTable,
  LeadOutcomesTable,
  SkillsTable,
  SkillVersionsTable,
  SkillProofsTable,
  ReputationEventsTable,
  ReputationSnapshotsTable,
  CreditsAccountsTable,
  CreditsLedgerEntriesTable,
  WalletBindingsTable,
  WorkOrdersTable,
  SkillExecutionOrdersTable,
  DisputeResolutionsTable,
  MarketplaceListingsTable,
  FabricNodesTable,
  CloserSourcesTable,
  CloserScrapeRunsTable,
  CloserRawRecordsTable,
  CloserAccountProfilesTable,
  CloserBriefsTable,
} from './schema.js';

export type AccountRow = AccountsTable;
export type ContactRow = ContactsTable;
export type EventRow = EventsTable;
export type AgentRunRow = AgentRunsTable;
export type AgentActionRow = AgentActionsTable;
export type AuditEventRow = AuditEventsTable;
export type OpportunityRow = OpportunitiesTable;
export type SyncRunRow = SyncRunsTable;
export type FeedbackLabelRow = FeedbackLabelsTable;
export type IntegrationConnectionRow = IntegrationConnectionsTable;
export type ProofRow = ProofsTable;
export type AgentRow = AgentsTable;
export type AtcRow = AgentTrustCredentialsTable;
export type AgentPermissionRow = AgentPermissionsTable;
export type LeadIntakeRow = LeadIntakesTable;
export type LeadOutcomeRow = LeadOutcomesTable;
export type SkillRow = SkillsTable;
export type SkillVersionRow = SkillVersionsTable;
export type SkillProofRow = SkillProofsTable;
export type ReputationEventRow = ReputationEventsTable;
export type ReputationSnapshotRow = ReputationSnapshotsTable;
export type CreditsAccountRow = CreditsAccountsTable;
export type CreditsLedgerEntryRow = CreditsLedgerEntriesTable;
export type WalletBindingRow = WalletBindingsTable;
export type WorkOrderRow = WorkOrdersTable;
export type SkillExecutionOrderRow = SkillExecutionOrdersTable;
export type DisputeResolutionRow = DisputeResolutionsTable;
export type MarketplaceListingRow = MarketplaceListingsTable;
export type FabricNodeRow = FabricNodesTable;
export type CloserSourceRow = CloserSourcesTable;
export type CloserScrapeRunRow = CloserScrapeRunsTable;
export type CloserRawRecordRow = CloserRawRecordsTable;
export type CloserAccountProfileRow = CloserAccountProfilesTable;
export type CloserBriefRow = CloserBriefsTable;

export interface ListActionsFilter {
  approvalStatus?: string;
  executionStatus?: string;
}

export interface ListProofsFilter {
  evidenceTag?: string;
  kind?: string;
  publicSafe?: boolean;
  /** Hard cap on rows returned (bounds the DB read for public surfaces). */
  limit?: number;
}

/**
 * Aggregate reputation counts for a tenant — the ONLY reputation shape a public
 * surface may see. Counts only: no agent ids, no per-agent scores, no event
 * bodies. Computed by the repository (COUNT/DISTINCT) so the public feed never
 * has to load every event row into memory.
 */
export interface PublicReputationCounts {
  agents_with_reputation: number;
  total_events: number;
  positive_events: number;
}

export interface ListWorkOrdersFilter {
  status?: string;
  workerAgentId?: string;
}

export interface ListCloserSourcesFilter {
  active?: boolean;
}

export interface ListCloserScrapeRunsFilter {
  status?: string;
}

export interface ListCloserAccountProfilesFilter {
  tier?: string;
}

/** Result of an idempotent bulk raw-record ingest. */
export interface CloserRawIngestResult {
  inserted: number;
  skipped: number;
}

/** Result of an idempotent ingest: the internal id and whether it was new. */
export interface IngestResult {
  id: string;
  created: boolean;
}

/**
 * Data-access contract used by agents and the API. Every method is explicitly
 * tenant-scoped; implementations MUST NOT return rows from another tenant
 * (the production Kysely impl relies on RLS; the in-memory impl filters).
 */
export interface Repository {
  // --- accounts / contacts ---
  listAccounts(tenantId: string): Promise<AccountRow[]>;
  getAccount(tenantId: string, id: string): Promise<AccountRow | null>;
  listContactsByAccount(tenantId: string, accountId: string): Promise<ContactRow[]>;
  getContact(tenantId: string, id: string): Promise<ContactRow | null>;

  // --- events (immutable, insert-only) ---
  insertEvent(event: EventRow): Promise<void>;
  listEvents(tenantId: string): Promise<EventRow[]>;

  // --- agent runs ---
  createAgentRun(run: AgentRunRow): Promise<AgentRunRow>;
  getAgentRun(tenantId: string, id: string): Promise<AgentRunRow | null>;
  /** RUN-1: all runs for a tenant (newest first), for the run/plan surface. */
  listAgentRuns(tenantId: string): Promise<AgentRunRow[]>;
  updateAgentRunStatus(tenantId: string, id: string, status: string): Promise<void>;

  // --- agent actions (the audit unit) ---
  createAgentAction(action: AgentActionRow): Promise<AgentActionRow>;
  getAgentAction(tenantId: string, id: string): Promise<AgentActionRow | null>;
  /** Idempotent lookup by the unique (tenant_id, idempotency_key). */
  findActionByIdempotencyKey(tenantId: string, key: string): Promise<AgentActionRow | null>;
  listAgentActions(tenantId: string, filter?: ListActionsFilter): Promise<AgentActionRow[]>;
  updateAgentAction(
    tenantId: string,
    id: string,
    patch: Partial<AgentActionRow>,
  ): Promise<AgentActionRow>;

  // --- integrations ---
  /** Resolve a tenant's connection (incl. credential_ref) for an external system. */
  getIntegrationConnection(
    tenantId: string,
    externalSystem: string,
  ): Promise<IntegrationConnectionRow | null>;
  /**
   * ENF-1 — flip the tenant kill switch ('active' | 'paused' | 'error').
   * Returns the updated row, or null when no connection exists.
   */
  updateIntegrationConnectionStatus(
    tenantId: string,
    externalSystem: string,
    status: string,
  ): Promise<IntegrationConnectionRow | null>;

  // --- opportunities (deals) ---
  listOpportunities(tenantId: string): Promise<OpportunityRow[]>;
  listOpportunitiesByAccount(tenantId: string, accountId: string): Promise<OpportunityRow[]>;

  // --- audit trail (append-only) ---
  insertAuditEvent(event: AuditEventRow): Promise<void>;
  listAuditEvents(tenantId: string): Promise<AuditEventRow[]>;

  // --- proofs (Cognitia Proof Registry; append-only, COG-003) ---
  /** Insert a proof. The row is immutable after insert except publish state. */
  insertProof(row: ProofRow): Promise<ProofRow>;
  getProof(tenantId: string, id: string): Promise<ProofRow | null>;
  listProofs(tenantId: string, filter?: ListProofsFilter): Promise<ProofRow[]>;
  /**
   * The ONLY legal proof mutation (mirrors the 0009 update-guard trigger):
   * set the publish-state pair after a redaction check. Returns the updated
   * row, or null when the proof does not exist for the tenant.
   */
  setProofPublishState(
    tenantId: string,
    id: string,
    publicSafe: boolean,
    redactionCheckPassedAt: string | null,
  ): Promise<ProofRow | null>;

  // --- agents + Agent Trust Credentials + permissions (COG-004) ---
  createAgent(row: AgentRow): Promise<AgentRow>;
  getAgent(tenantId: string, id: string): Promise<AgentRow | null>;
  listAgents(tenantId: string): Promise<AgentRow[]>;
  createAtc(row: AtcRow): Promise<AtcRow>;
  getAtc(tenantId: string, id: string): Promise<AtcRow | null>;
  listAtcsByAgent(tenantId: string, agentId: string): Promise<AtcRow[]>;
  /**
   * Status transition (the only ATC mutation). Returns the updated row, or
   * null when missing. Revoked-is-terminal is enforced by the 0009 trigger
   * in Postgres; implementations must mirror it.
   */
  updateAtcStatus(tenantId: string, id: string, status: string): Promise<AtcRow | null>;
  /** Insert-or-update on the unique (tenant, agent, action_key). */
  upsertAgentPermission(row: AgentPermissionRow): Promise<AgentPermissionRow>;
  listAgentPermissions(tenantId: string, agentId: string): Promise<AgentPermissionRow[]>;

  // --- MoverOS lead intakes (COG-006; sole home of encrypted raw PII) ---
  insertLeadIntake(row: LeadIntakeRow): Promise<LeadIntakeRow>;
  getLeadIntake(tenantId: string, id: string): Promise<LeadIntakeRow | null>;
  listLeadIntakes(tenantId: string): Promise<LeadIntakeRow[]>;
  /**
   * PIPEDA/BC PIPA purge: blanks the *_enc PII columns and sets
   * pii_status='purged' (the 0011 check constraint requires both together).
   * Returns the updated row, or null when missing for the tenant.
   */
  purgeLeadIntakePii(tenantId: string, id: string): Promise<LeadIntakeRow | null>;
  /** 0013 lifecycle transition. Returns null when missing for the tenant. */
  updateLeadIntakeStatus(
    tenantId: string,
    id: string,
    status: string,
  ): Promise<LeadIntakeRow | null>;

  // --- lead outcomes (COG-006; evidence-tagged economic results) ---
  insertLeadOutcome(row: LeadOutcomeRow): Promise<LeadOutcomeRow>;
  listLeadOutcomes(tenantId: string, leadIntakeId?: string): Promise<LeadOutcomeRow[]>;

  // --- SkillProof (COG-005; internal-only, never a public marketplace) ---
  /** Insert-or-return-existing on the unique (tenant, slug). */
  upsertSkill(row: SkillRow): Promise<SkillRow>;
  getSkill(tenantId: string, id: string): Promise<SkillRow | null>;
  listSkills(tenantId: string): Promise<SkillRow[]>;
  insertSkillVersion(row: SkillVersionRow): Promise<SkillVersionRow>;
  getSkillVersion(tenantId: string, id: string): Promise<SkillVersionRow | null>;
  listSkillVersions(tenantId: string, skillId: string): Promise<SkillVersionRow[]>;
  /**
   * The only skill-version mutations: tier upgrades (DB trigger requires a
   * verified_fact proof for tier >= 2) and yanking. Returns null when missing.
   */
  setSkillVersionTier(tenantId: string, id: string, tier: number): Promise<SkillVersionRow | null>;
  yankSkillVersion(tenantId: string, id: string, reason: string): Promise<SkillVersionRow | null>;
  insertSkillProof(row: SkillProofRow): Promise<SkillProofRow>;
  listSkillProofs(tenantId: string, skillId?: string): Promise<SkillProofRow[]>;

  // --- reputation events (append-only; positive delta requires verified_fact proof) ---
  insertReputationEvent(row: ReputationEventRow): Promise<ReputationEventRow>;
  listReputationEvents(tenantId: string, agentId?: string): Promise<ReputationEventRow[]>;
  /**
   * Tenant-scoped aggregate counts for the public feed (no ids, no scores).
   * Uses COUNT/DISTINCT in the DB rather than loading every event row.
   */
  countReputation(tenantId: string): Promise<PublicReputationCounts>;
  /** Snapshots are insert-only; recompute appends, never rewrites (COG-008). */
  insertReputationSnapshot(row: ReputationSnapshotRow): Promise<ReputationSnapshotRow>;
  listReputationSnapshots(tenantId: string, agentId: string): Promise<ReputationSnapshotRow[]>;

  // --- internal credits + wallet placeholders (COG-009, Lane C) ---
  /** Insert-or-return-existing on the unique (tenant, owner_type, owner_id). */
  upsertCreditsAccount(row: CreditsAccountRow): Promise<CreditsAccountRow>;
  getCreditsAccount(tenantId: string, id: string): Promise<CreditsAccountRow | null>;
  listCreditsAccounts(tenantId: string): Promise<CreditsAccountRow[]>;
  /**
   * Append one balanced debit+credit pair ATOMICALLY (single transaction in
   * Postgres). The ledger is append-only — there are deliberately no update
   * or delete methods for entries anywhere on this interface.
   */
  insertCreditsLedgerPair(
    debit: CreditsLedgerEntryRow,
    credit: CreditsLedgerEntryRow,
  ): Promise<void>;
  listCreditsLedgerEntries(tenantId: string, accountId?: string): Promise<CreditsLedgerEntryRow[]>;
  findCreditsLedgerByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<CreditsLedgerEntryRow[]>;
  /** Wallet bindings are inert placeholders in v1.1 (status check-locked). */
  insertWalletBinding(row: WalletBindingRow): Promise<WalletBindingRow>;
  listWalletBindings(tenantId: string): Promise<WalletBindingRow[]>;
  getWalletBinding(tenantId: string, id: string): Promise<WalletBindingRow | null>;
  /** placeholder → deactivated (0014). The ONLY legal transition; no activation. */
  deactivateWalletBinding(tenantId: string, id: string): Promise<WalletBindingRow | null>;

  // --- Agent Economy Lab (AGENT-ECONOMY-001; 0016) ---
  insertWorkOrder(row: WorkOrderRow): Promise<WorkOrderRow>;
  getWorkOrder(tenantId: string, id: string): Promise<WorkOrderRow | null>;
  listWorkOrders(tenantId: string, filter?: ListWorkOrdersFilter): Promise<WorkOrderRow[]>;
  /**
   * The only work-order mutation. Implementations must mirror the 0016
   * guards: verified/rejected/canceled are terminal, and a transition to
   * verified (or escrow_status released) requires the linked proof to be
   * verified_fact. Returns null when missing for the tenant.
   */
  updateWorkOrder(
    tenantId: string,
    id: string,
    patch: Partial<
      Pick<
        WorkOrderRow,
        | 'status'
        | 'worker_agent_id'
        | 'skill_version_id'
        | 'escrow_status'
        | 'escrow_account_id'
        | 'proof_id'
        | 'outcome_type'
        | 'evidence_tag'
        | 'resolution_proof_id'
      >
    >,
  ): Promise<WorkOrderRow | null>;
  /**
   * AGENT-ECONOMY-002: append-only arbitration records (one per work order).
   * Implementations must mirror the 0017 guards: disputed-origin and the
   * conserved split (worker + requester = requested_credits).
   */
  insertDisputeResolution(row: DisputeResolutionRow): Promise<DisputeResolutionRow>;
  getDisputeResolutionByWorkOrder(
    tenantId: string,
    workOrderId: string,
  ): Promise<DisputeResolutionRow | null>;
  listDisputeResolutions(tenantId: string): Promise<DisputeResolutionRow[]>;
  /**
   * AGENT-ECONOMY-004: internal marketplace listings. Implementations must
   * mirror the 0018 guards: yanked skill versions cannot hold an active
   * listing; one listing per (agent, skill version); visibility is locked
   * to 'internal'.
   */
  insertMarketplaceListing(row: MarketplaceListingRow): Promise<MarketplaceListingRow>;
  getMarketplaceListing(tenantId: string, id: string): Promise<MarketplaceListingRow | null>;
  listMarketplaceListings(tenantId: string, status?: string): Promise<MarketplaceListingRow[]>;
  /** active ↔ withdrawn (the only mutation; re-activation re-runs the yank guard). */
  updateMarketplaceListingStatus(
    tenantId: string,
    id: string,
    status: string,
  ): Promise<MarketplaceListingRow | null>;
  /**
   * LEGEND-001: Agent Fabric Lab node registry. Implementations mirror the 0019
   * checks: platform ∈ {macos,windows,linux,cloud}; status ∈ {active,quarantined};
   * one node per (agent, label). Simulation-only metadata — no execution surface.
   */
  insertFabricNode(row: FabricNodeRow): Promise<FabricNodeRow>;
  getFabricNode(tenantId: string, id: string): Promise<FabricNodeRow | null>;
  listFabricNodes(tenantId: string, status?: string): Promise<FabricNodeRow[]>;
  /** active ↔ quarantined (the per-node kill switch). */
  updateFabricNodeStatus(
    tenantId: string,
    id: string,
    status: string,
  ): Promise<FabricNodeRow | null>;
  insertSkillExecutionOrder(row: SkillExecutionOrderRow): Promise<SkillExecutionOrderRow>;
  listSkillExecutionOrders(
    tenantId: string,
    workOrderId?: string,
  ): Promise<SkillExecutionOrderRow[]>;
  /** Status/result/proof transitions only; `simulation` is check-locked true. */
  updateSkillExecutionOrder(
    tenantId: string,
    id: string,
    patch: Partial<
      Pick<SkillExecutionOrderRow, 'status' | 'result' | 'proof_id' | 'started_at' | 'finished_at'>
    >,
  ): Promise<SkillExecutionOrderRow | null>;

  // --- feedback labels (decision flywheel; feeds evals/scorecards/autonomy) ---
  insertFeedbackLabel(row: FeedbackLabelRow): Promise<void>;
  listFeedbackLabels(tenantId: string, subjectRef?: string): Promise<FeedbackLabelRow[]>;

  // --- external object maps (idempotent ingest backbone) ---
  /**
   * Resolve the internal id for an external object via external_object_maps.
   * Backed by the unique (tenant_id, external_system, external_type, external_id)
   * constraint (migration 0002).
   */
  findInternalIdByExternal(
    tenantId: string,
    externalSystem: string,
    externalType: string,
    externalId: string,
  ): Promise<string | null>;

  /** Idempotent ingest of an external account (company). */
  ingestExternalAccount(input: IngestAccountInput): Promise<IngestResult>;

  /**
   * Idempotent ingest of an external contact. Resolves via external_object_maps;
   * a repeated (system, external_id) updates the same contact instead of
   * creating a new one — so duplicate webhooks/syncs never duplicate contacts.
   */
  ingestExternalContact(
    input: IngestContactInput,
  ): Promise<{ contactId: string; created: boolean }>;

  /** Idempotent ingest of an external opportunity (deal). */
  ingestExternalOpportunity(input: IngestOpportunityInput): Promise<IngestResult>;

  // --- sync runs (bookkeeping) ---
  createSyncRun(input: {
    tenantId: string;
    connectionId?: string | null;
    status?: string;
  }): Promise<SyncRunRow>;
  updateSyncRun(
    tenantId: string,
    id: string,
    patch: Partial<Pick<SyncRunRow, 'status' | 'finished_at' | 'stats'>>,
  ): Promise<SyncRunRow>;

  // --- Sales Closer: sources (Apify import configs) ---
  /**
   * Create a source. A 'disallowed' source can never be active (mirrors the
   * 0020 check); implementations reject active+disallowed.
   */
  createCloserSource(row: CloserSourceRow): Promise<CloserSourceRow>;
  getCloserSource(tenantId: string, id: string): Promise<CloserSourceRow | null>;
  listCloserSources(tenantId: string, filter?: ListCloserSourcesFilter): Promise<CloserSourceRow[]>;
  /** Returns null when missing for the tenant. Re-runs the disallowed/active guard. */
  updateCloserSource(
    tenantId: string,
    id: string,
    patch: Partial<
      Pick<
        CloserSourceRow,
        'label' | 'input' | 'source_risk' | 'max_results' | 'schedule' | 'active'
      >
    >,
  ): Promise<CloserSourceRow | null>;

  // --- Sales Closer: scrape runs (Apify metadata; child of agent_runs) ---
  /** A scrape run can never run a 'disallowed' source (mirrors the 0020 check). */
  createCloserScrapeRun(row: CloserScrapeRunRow): Promise<CloserScrapeRunRow>;
  getCloserScrapeRun(tenantId: string, id: string): Promise<CloserScrapeRunRow | null>;
  listCloserScrapeRuns(
    tenantId: string,
    filter?: ListCloserScrapeRunsFilter,
  ): Promise<CloserScrapeRunRow[]>;
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
  ): Promise<CloserScrapeRunRow | null>;

  // --- Sales Closer: raw records (staging; idempotent on unique key) ---
  /** Idempotent on (tenant_id, scrape_run_id, dedupe_key): repeats are skipped. */
  insertCloserRawRecords(rows: CloserRawRecordRow[]): Promise<CloserRawIngestResult>;
  listCloserRawRecordsByRun(tenantId: string, scrapeRunId: string): Promise<CloserRawRecordRow[]>;
  /** Link a staged row to its deduped account. Returns null when missing. */
  linkCloserRawRecordToAccount(
    tenantId: string,
    id: string,
    accountId: string,
  ): Promise<CloserRawRecordRow | null>;

  // --- Sales Closer: account profiles (1:1 with account; history via events) ---
  /** Insert-or-update on the unique (tenant_id, account_id). */
  upsertCloserAccountProfile(row: CloserAccountProfileRow): Promise<CloserAccountProfileRow>;
  getCloserAccountProfile(
    tenantId: string,
    accountId: string,
  ): Promise<CloserAccountProfileRow | null>;
  listCloserAccountProfiles(
    tenantId: string,
    filter?: ListCloserAccountProfilesFilter,
  ): Promise<CloserAccountProfileRow[]>;

  // --- Sales Closer: briefs (approval/handoff flows through agent_actions) ---
  createCloserBrief(row: CloserBriefRow): Promise<CloserBriefRow>;
  getCloserBrief(tenantId: string, id: string): Promise<CloserBriefRow | null>;
  listCloserBriefsByAccount(tenantId: string, accountId: string): Promise<CloserBriefRow[]>;
  /** draft → approved → sent. Returns null when missing for the tenant. */
  updateCloserBriefStatus(
    tenantId: string,
    id: string,
    status: string,
  ): Promise<CloserBriefRow | null>;
}

export interface IngestAccountInput {
  tenantId: string;
  externalSystem: string;
  externalId: string;
  account: {
    name: string;
    domain?: string | null;
    industry?: string | null;
    employeeCount?: number | null;
    region?: string | null;
  };
}

export interface IngestContactInput {
  tenantId: string;
  externalSystem: string;
  externalId: string;
  contact: {
    accountId?: string | null;
    fullName?: string | null;
    title?: string | null;
    persona?: string | null;
    emailHash?: string | null;
  };
}

export interface IngestOpportunityInput {
  tenantId: string;
  externalSystem: string;
  externalId: string;
  opportunity: {
    accountId: string;
    name: string;
    stage?: string;
    amount?: number | null;
    ownerRef?: string | null;
  };
}
