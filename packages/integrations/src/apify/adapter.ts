import { randomUUID } from 'node:crypto';
import type {
  Repository,
  AgentRunRow,
  CloserScrapeRunRow,
  CloserRawRecordRow,
  CloserSourceRow,
} from '@cognitia/db';
import type {
  ApifyActorConfig,
  ApifyClient,
  ApifyConfig,
  ApifyDatasetItem,
  ApifyIngestSummary,
  ApifyPolicyDecision,
  ApifyRunRequest,
  ApifyRunResult,
  NormalizedCloserRecord,
} from './types.js';
import { FakeApifyClient } from './client.js';
import { ensureNoDirectPiiPersisted } from './redaction.js';
import { normalizeDatasetItems } from './normalizers.js';
import {
  getActorConfig,
  listAllowedActors,
  resolveEffectiveMaxItems,
  validateApifySourcePolicy,
} from './policy.js';

/**
 * ApifyAdapter — the governed ingestion orchestrator (like HubspotSyncService;
 * NOT an AdapterRegistry IntegrationAdapter). It runs an actor (fixture by
 * default), normalizes + redacts items, and stages them into the Phase-1
 * `closer_*` tables. It NEVER creates agent_actions, briefs, or outreach, and
 * never calls the network on the default (fixture) path.
 *
 * Config is injected (no process.env here). Live mode is impossible unless the
 * resolved config explicitly allows network AND supplies a token AND a live
 * client is wired AND policy passes.
 */
export interface ApifyAdapterDeps {
  repo: Repository;
  config: ApifyConfig;
  /** Defaults to an in-memory FakeApifyClient (fixtures). */
  fixtureClient?: ApifyClient;
  /** Only used on the gated live path. */
  liveClient?: ApifyClient;
  now?: () => Date;
  newId?: () => string;
}

export class ApifyAdapter {
  private readonly repo: Repository;
  private readonly config: ApifyConfig;
  private readonly fixtureClient: ApifyClient;
  private readonly liveClient?: ApifyClient;
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(deps: ApifyAdapterDeps) {
    this.repo = deps.repo;
    this.config = deps.config;
    this.fixtureClient = deps.fixtureClient ?? new FakeApifyClient();
    this.liveClient = deps.liveClient;
    this.now = deps.now ?? (() => new Date());
    this.newId = deps.newId ?? (() => randomUUID());
  }

  listAllowedActors(): readonly ApifyActorConfig[] {
    return listAllowedActors();
  }

  /** Validate a request against source + actor policy (does not run anything). */
  async validateRunRequest(request: ApifyRunRequest): Promise<ApifyPolicyDecision> {
    const source = await this.repo.getCloserSource(request.tenantId, request.sourceId);
    if (!source) return { ok: false, reason: 'source_not_found' };
    const actor = getActorConfig(request.actorId);
    return validateApifySourcePolicy(
      actor,
      { active: source.active, source_risk: source.source_risk },
      { humanReviewApproved: request.humanReviewApproved },
    );
  }

  /** Thin pass-through: run an actor via the mode-appropriate client. */
  async runActor(request: ApifyRunRequest, client: ApifyClient): Promise<ApifyRunResult> {
    const actor = getActorConfig(request.actorId);
    const maxItems = resolveEffectiveMaxItems({
      requestMax: request.maxItems,
      actorMax: actor?.maxItems,
      configMax: this.config.maxItems,
    });
    return client.runActor({
      actorId: request.actorId,
      input: request.input ?? actor?.defaultInput ?? {},
      maxItems,
      timeoutMs: this.config.defaultTimeoutMs,
    });
  }

  fetchDatasetItems(run: ApifyRunResult): ApifyDatasetItem[] {
    return run.datasetItems;
  }

  normalizeDatasetItems(
    source: CloserSourceRow,
    items: ApifyDatasetItem[],
    run: ApifyRunResult,
  ): NormalizedCloserRecord[] {
    const actor = getActorConfig(source.apify_actor_id);
    if (!actor) return [];
    return normalizeDatasetItems(items, {
      sourceId: source.id,
      actor,
      providerRunId: run.providerRunId,
      collectedAt: this.now().toISOString(),
    }).records;
  }

  /**
   * Stage normalized records into closer_raw_records. Runs the no-direct-PII
   * guard on EVERY record before persistence; idempotent via the Phase-1 unique
   * key. Returns repo ingest counts.
   */
  async stageRawRecords(
    tenantId: string,
    scrapeRunId: string,
    records: NormalizedCloserRecord[],
  ): Promise<{ inserted: number; duplicates: number }> {
    const rows: CloserRawRecordRow[] = records.map((record) => {
      ensureNoDirectPiiPersisted(record);
      return {
        id: this.newId(),
        tenant_id: tenantId,
        scrape_run_id: scrapeRunId,
        payload: record.rawRedacted,
        normalized: {
          accountName: record.accountName,
          website: record.website,
          city: record.city,
          provinceOrState: record.provinceOrState,
          country: record.country,
          category: record.category,
          rating: record.rating ?? null,
          reviewCount: record.reviewCount ?? null,
          inventorySignal: record.inventorySignal ?? null,
          sourceUrl: record.sourceUrl,
          evidence: record.evidence,
          contactHashes: record.contactHashes ?? null,
          complianceFlags: record.complianceFlags,
          confidence: record.confidence,
        },
        dedupe_key: record.dedupeKey,
        account_id: null,
        created_at: this.now().toISOString(),
      };
    });
    const result = await this.repo.insertCloserRawRecords(rows);
    return { inserted: result.inserted, duplicates: result.skipped };
  }

  /**
   * Full governed ingestion lifecycle. Default (fixtureMode !== false) runs with
   * zero network. Live mode requires all gates; otherwise the run is marked
   * failed with a sanitized reason and NO network call is made.
   */
  async ingest(request: ApifyRunRequest): Promise<ApifyIngestSummary> {
    const warnings: string[] = [];
    const mode: 'fixture' | 'live' = request.fixtureMode === false ? 'live' : 'fixture';
    const collectedAt = this.now().toISOString();

    const source = await this.repo.getCloserSource(request.tenantId, request.sourceId);
    const actor = getActorConfig(request.actorId);

    // Parent run is always an agent_run (agent='closer').
    const agentRun = await this.createAgentRun(request, mode);

    // A disallowed/missing source can never produce a scrape run (Phase-1 design:
    // closer_scrape_runs.source_risk excludes 'disallowed').
    if (!source) {
      await this.repo.updateAgentRunStatus(request.tenantId, agentRun.id, 'failed');
      return this.failedSummaryNoRun(agentRun.id, mode, 'source_not_found');
    }
    if (source.source_risk === 'disallowed') {
      await this.repo.updateAgentRunStatus(request.tenantId, agentRun.id, 'failed');
      return this.failedSummaryNoRun(agentRun.id, mode, 'blocked_by_policy:disallowed');
    }

    // Now we have a storable source_risk; create the scrape run.
    const scrapeRun = await this.createScrapeRun(request, agentRun.id, source);

    const policy = validateApifySourcePolicy(
      actor,
      { active: source.active, source_risk: source.source_risk },
      { humanReviewApproved: request.humanReviewApproved },
    );
    if (!policy.ok) {
      return this.failRun(
        request.tenantId,
        agentRun.id,
        scrapeRun.id,
        mode,
        policy.reason ?? 'blocked',
      );
    }

    // Pick the client by mode. Live mode is hard-gated.
    let client: ApifyClient;
    if (mode === 'live') {
      if (!this.config.allowNetwork) {
        return this.failRun(
          request.tenantId,
          agentRun.id,
          scrapeRun.id,
          mode,
          'network_not_allowed',
        );
      }
      if (!this.config.token) {
        return this.failRun(request.tenantId, agentRun.id, scrapeRun.id, mode, 'missing_token');
      }
      if (!this.liveClient) {
        return this.failRun(request.tenantId, agentRun.id, scrapeRun.id, mode, 'no_live_client');
      }
      client = this.liveClient;
    } else {
      client = this.fixtureClient;
    }

    const maxItems = resolveEffectiveMaxItems({
      requestMax: request.maxItems,
      actorMax: actor?.maxItems,
      configMax: this.config.maxItems,
    });

    let run: ApifyRunResult;
    try {
      run = await client.runActor({
        actorId: request.actorId,
        input: request.input ?? actor?.defaultInput ?? {},
        maxItems,
        timeoutMs: this.config.defaultTimeoutMs,
      });
    } catch {
      // Never surface the error object (may reference token/URL); use a generic code.
      return this.failRun(request.tenantId, agentRun.id, scrapeRun.id, mode, 'actor_run_error', {
        apify_run_id: null,
        dataset_id: null,
      });
    }

    if (run.status !== 'SUCCEEDED') {
      return this.failRun(
        request.tenantId,
        agentRun.id,
        scrapeRun.id,
        mode,
        `actor_run_${run.status.toLowerCase()}`,
        { apify_run_id: run.providerRunId, dataset_id: run.defaultDatasetId || null },
      );
    }

    const { records, skipped } = normalizeDatasetItems(run.datasetItems, {
      sourceId: source.id,
      actor: actor!,
      providerRunId: run.providerRunId,
      collectedAt,
    });
    const redacted = records.filter((r) =>
      r.complianceFlags.includes('redacted_contact_fields'),
    ).length;

    let staged: { inserted: number; duplicates: number };
    try {
      staged = await this.stageRawRecords(request.tenantId, scrapeRun.id, records);
    } catch {
      return this.failRun(
        request.tenantId,
        agentRun.id,
        scrapeRun.id,
        mode,
        'staging_guard_error',
        {
          apify_run_id: run.providerRunId,
          dataset_id: run.defaultDatasetId || null,
        },
      );
    }

    await this.repo.updateCloserScrapeRun(request.tenantId, scrapeRun.id, {
      status: 'succeeded',
      stage: 'staged',
      apify_run_id: run.providerRunId,
      dataset_id: run.defaultDatasetId || null,
      rows_in: run.datasetItems.length,
      accounts_upserted: staged.inserted,
      contacts_upserted: 0,
    });
    await this.repo.updateAgentRunStatus(request.tenantId, agentRun.id, 'completed');

    return {
      scrapeRunId: scrapeRun.id,
      agentRunId: agentRun.id,
      mode,
      status: 'succeeded',
      read: run.datasetItems.length,
      inserted: staged.inserted,
      duplicates: staged.duplicates,
      redacted,
      skipped,
      warnings,
    };
  }

  // --- helpers ---

  private async createAgentRun(
    request: ApifyRunRequest,
    mode: 'fixture' | 'live',
  ): Promise<AgentRunRow> {
    const ts = this.now().toISOString();
    const run: AgentRunRow = {
      id: this.newId(),
      tenant_id: request.tenantId,
      agent: 'closer',
      objective: `apify.ingest:${mode}`,
      input_refs: [`closer_source:${request.sourceId}`],
      status: 'running',
      trace_id: `apify-ingest-${this.newId()}`,
      created_at: ts,
      updated_at: ts,
    };
    return this.repo.createAgentRun(run);
  }

  private async createScrapeRun(
    request: ApifyRunRequest,
    agentRunId: string,
    source: CloserSourceRow,
  ): Promise<CloserScrapeRunRow> {
    const ts = this.now().toISOString();
    // source.source_risk is guaranteed not 'disallowed' here; safe to store.
    const row: CloserScrapeRunRow = {
      id: this.newId(),
      tenant_id: request.tenantId,
      agent_run_id: agentRunId,
      source_id: source.id,
      apify_run_id: null,
      dataset_id: null,
      source_risk: source.source_risk as CloserScrapeRunRow['source_risk'],
      status: 'running',
      stage: 'run_actor',
      rows_in: 0,
      accounts_upserted: 0,
      contacts_upserted: 0,
      error: null,
      created_at: ts,
      updated_at: ts,
    };
    return this.repo.createCloserScrapeRun(row);
  }

  private async failRun(
    tenantId: string,
    agentRunId: string,
    scrapeRunId: string,
    mode: 'fixture' | 'live',
    reason: string,
    extra: Partial<Pick<CloserScrapeRunRow, 'apify_run_id' | 'dataset_id'>> = {},
  ): Promise<ApifyIngestSummary> {
    await this.repo.updateCloserScrapeRun(tenantId, scrapeRunId, {
      status: 'failed',
      error: reason,
      ...extra,
    });
    await this.repo.updateAgentRunStatus(tenantId, agentRunId, 'failed');
    return {
      scrapeRunId,
      agentRunId,
      mode,
      status: 'failed',
      read: 0,
      inserted: 0,
      duplicates: 0,
      redacted: 0,
      skipped: 0,
      warnings: [],
      reason,
    };
  }

  private failedSummaryNoRun(
    agentRunId: string,
    mode: 'fixture' | 'live',
    reason: string,
  ): ApifyIngestSummary {
    return {
      scrapeRunId: '',
      agentRunId,
      mode,
      status: 'failed',
      read: 0,
      inserted: 0,
      duplicates: 0,
      redacted: 0,
      skipped: 0,
      warnings: [],
      reason,
    };
  }
}
