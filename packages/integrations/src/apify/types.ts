import type { CloserSourceRisk, CloserRawRecordRow } from '@cognitia/db';

/**
 * Apify integration types (Phase 2). Governed, fixture-first ingestion scaffold
 * for the Sales Closer Intelligence Engine. No outreach, no LLM, no real network
 * by default. Pure modules (policy/normalizers/redaction/fixtures) never read
 * process.env — config is injected.
 */

/** Reuses the Phase-1 closer_sources.source_risk vocabulary (no separate `blocked`). */
export type ApifySourceRisk = CloserSourceRisk;

export type ApifyActorCategory =
  | 'business_directory'
  | 'maps'
  | 'website_profile'
  | 'social'
  | 'other';

/** Lifecycle maturity. Nothing is `production` by default. */
export type ApifyProductionStatus = 'fixture' | 'prototype' | 'production';

/** PII likelihood of an actor's raw output (drives redaction emphasis + flags). */
export type ApifyPiiRisk = 'none' | 'low' | 'medium' | 'high';

/** Static config for an allowlisted actor. */
export interface ApifyActorConfig {
  id: string;
  name: string;
  /** Apify actorId (e.g. "apify/website-content-crawler"). */
  actorId: string;
  category: ApifyActorCategory;
  sourceType: string;
  /** Maps onto closer_sources.source_risk. */
  riskLevel: ApifySourceRisk;
  allowedUse: string;
  disallowedUse: string;
  defaultInput: Record<string, unknown>;
  /** Per-actor item cap (one input to the hard clamp). */
  maxItems: number;
  productionStatus: ApifyProductionStatus;
  fieldsExpected: string[];
  piiRisk: ApifyPiiRisk;
  notes: string;
}

/** A request to ingest from a source. fixtureMode defaults to true (safe). */
export interface ApifyRunRequest {
  tenantId: string;
  sourceId: string;
  actorId: string;
  input?: Record<string, unknown>;
  requestedBy: string;
  /** Reserved: validate-only, never stages. */
  dryRun?: boolean;
  /** TRUE (default) = fixtures only, no network. FALSE = attempt live (gated). */
  fixtureMode?: boolean;
  /** Requested cap; clamped by actor/config/HARD_MAX. */
  maxItems?: number;
  /** Required to run a legal_review_required source. */
  humanReviewApproved?: boolean;
}

export type ApifyRunStatus = 'SUCCEEDED' | 'FAILED' | 'TIMED-OUT' | 'ABORTED' | 'RUNNING';

export type ApifyDatasetItem = Record<string, unknown>;

export interface ApifyRunResult {
  providerRunId: string;
  defaultDatasetId: string;
  status: ApifyRunStatus;
  startedAt: string;
  finishedAt: string | null;
  itemCount: number;
  usageSummary?: Record<string, unknown>;
  datasetItems: ApifyDatasetItem[];
}

/** Evidence/provenance kept with every normalized record (no PII). */
export interface CloserEvidence {
  sourceUrl: string | null;
  actorId: string;
  providerRunId: string | null;
  collectedAt: string;
}

/** Deterministic, redacted output of normalization. Company-level only. */
export interface NormalizedCloserRecord {
  sourceId: string;
  sourceUrl: string | null;
  accountName: string | null;
  website: string | null;
  city: string | null;
  provinceOrState: string | null;
  country: string | null;
  category: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  inventorySignal?: string | null;
  evidence: CloserEvidence;
  dedupeKey: string;
  /** Raw payload with direct PII keys stripped. Safe to persist. */
  rawRedacted: Record<string, unknown>;
  /** Business-level hashes only (never raw values), present only when needed. */
  contactHashes?: { emailHash?: string; phoneHash?: string };
  complianceFlags: string[];
  confidence: number;
}

/** The transport contract. FakeApifyClient (fixtures) + HttpApifyClient (live). */
export interface ApifyClient {
  runActor(req: {
    actorId: string;
    input: Record<string, unknown>;
    maxItems: number;
    timeoutMs: number;
  }): Promise<ApifyRunResult>;
  getRun(providerRunId: string): Promise<ApifyRunResult>;
  listDatasetItems(datasetId: string, opts: { limit: number }): Promise<ApifyDatasetItem[]>;
}

/** Resolved config (produced only by config.ts from env, or by tests). */
export interface ApifyConfig {
  token?: string;
  allowNetwork: boolean;
  liveTests: boolean;
  maxItems: number;
  defaultTimeoutMs: number;
}

/** Summary returned by ApifyAdapter.ingest. */
export interface ApifyIngestSummary {
  scrapeRunId: string;
  agentRunId: string;
  mode: 'fixture' | 'live';
  status: 'succeeded' | 'failed';
  read: number;
  inserted: number;
  duplicates: number;
  redacted: number;
  skipped: number;
  warnings: string[];
  /** Sanitized block/failure reason (never contains tokens or raw payloads). */
  reason?: string;
}

/** Result of a policy evaluation. */
export interface ApifyPolicyDecision {
  ok: boolean;
  /** Sanitized, enum-aligned reason, e.g. "blocked_by_policy:disallowed". */
  reason?: string;
}

/** Mapping rows passed to staging (mirrors CloserRawRecordRow minus generated ids). */
export type StageableRawRecord = Omit<CloserRawRecordRow, 'id' | 'created_at'>;
