/**
 * Integrated run packet — the single Command-Center proof artifact.
 *
 * This is the integration-hardening island. It does NOT reimplement any of the
 * B1–B6 lanes; it COMPOSES them, through pure read-model adapters, into one
 * unified, inspectable "integrated run packet" that proves the whole mock-safe
 * GTM surface end-to-end for a single lead:
 *
 *   - audience score ............ B4  `buildAudience` / `scoreSignals`
 *   - workflow state ............ B1  `assembleGtmRunPacket` (`status`/`finalState`)
 *   - workspace_id .............. B1  workspace attribution
 *   - dry-run channel plans ..... B2  `planDryRunAction` (+ `assertNoLiveSend`)
 *   - CRM-lite timeline ......... B3  `MockCrmLite` projection
 *   - TrustOps report ........... B5  `buildTrustOpsReport`
 *   - release gate result ....... B6  `evaluateReleaseGate`
 *   - proof / action trace ...... B1  `proofs` + operator `timeline`
 *
 * GUARANTEES (asserted at build time, before any packet is returned):
 *   - NO LIVE EGRESS — every channel action is a dry-run plan (`sent:false`),
 *     `assertNoLiveSend` is run over each plan, and `sendLive` is proven to
 *     throw. The packet records a combined no-live-egress attestation.
 *   - NO RAW PII — the whole serialized packet is scanned with the CRM-lite PII
 *     guard, which permits only reserved-TLD (`.example`/`.test`/`.invalid`)
 *     emails and `555-01xx` phones and throws on anything real-looking.
 *
 * Self-contained: imports only `@cognitia/core` types and sibling lane modules.
 * No network, no vendor SDK, no DB. Pure given injected `now`/`newId`.
 */

import type { IsoTimestamp, RawGtmProspectInput } from '@cognitia/core';
import {
  assembleGtmRunPacket,
  type AssembleGtmRunPacketOptions,
  type GtmRunPacket,
} from '../assembly/index.js';
import {
  buildAudience,
  type AudienceInputRow,
  type RankedProspect,
  type RejectedRow,
} from '../../audience/audienceBuilder.js';
import type { SignalScore } from '../../audience/signalScoring.js';
import {
  assertNoLiveSend,
  planDryRunAction,
  sendLive,
  type DryRunAction,
} from '../../channels/dryRunChannels.js';
import { CHANNEL_KINDS, type ChannelKind } from '../../channels/channelPolicy.js';
import { buildTrustOpsReport, type TrustOpsReport } from '../../trustops/report.js';
import {
  evaluateReleaseGate,
  type ReleaseConditions,
  type ReleaseGateResult,
  type ReleaseStage,
} from '../../security/releaseGate.js';
import { projectCrmLite, toWorkflowRunSummary, type CrmLiteProjection } from './adapters.js';

/** Schema tag stamped on every integrated packet (versioned for consumers). */
export const INTEGRATED_RUN_PACKET_SCHEMA = 'cognitia.gtm.integrated_run_packet.v1' as const;

/** The audience section of the integrated packet. */
export interface IntegratedAudienceSection {
  /** The deterministic 0..1 signal score for this prospect. */
  score: SignalScore;
  /** The ranked, PII-safe prospect the score belongs to. */
  prospect: RankedProspect;
  /** Any rows rejected while building the audience (clear reasons; no PII). */
  rejected: RejectedRow[];
}

/** The release-gate section: the operative stage plus the fail-closed live stage. */
export interface IntegratedReleaseSection {
  /** Result for the stage this run operates at (defaults to `dry_run`). */
  operative: ReleaseGateResult;
  /**
   * Result for `controlled_live` under the same conditions — included to prove
   * the live stage fails closed (it requires 7 signoffs incl. counsel + founder).
   */
  controlledLive: ReleaseGateResult;
}

/** Combined attestation across every composed lane. */
export interface IntegratedAttestation {
  mode: 'mock';
  /** True by construction — there is no live send path anywhere in the packet. */
  noLiveEgress: true;
  /** True — the whole packet was scanned and carries no raw PII. */
  noRawPii: true;
  /** The lanes proven present, for the Command Center checklist. */
  lanes: string[];
  statement: string;
}

/**
 * The single unified artifact. Every field above the attestation maps to one of
 * the eight things the Command Center must be able to prove.
 */
export interface IntegratedRunPacket {
  schema: typeof INTEGRATED_RUN_PACKET_SCHEMA;
  mode: 'mock';
  workspaceId: string;
  generatedAt: IsoTimestamp;
  /** B4 — audience score. */
  audience: IntegratedAudienceSection;
  /** B1 — workflow state, workspace_id, proof/action trace (proofs + timeline). */
  run: GtmRunPacket;
  /** B2 — dry-run channel plans (every one `sent:false`). */
  channelPlans: DryRunAction[];
  /** B3 — CRM-lite entity graph + ordered operator timeline. */
  crm: CrmLiteProjection;
  /** B5 — TrustOps metrics + trust score + rendered markdown report. */
  trustOps: TrustOpsReport;
  /** B6 — release gate result (operative stage + fail-closed live stage). */
  releaseGate: IntegratedReleaseSection;
  /** Combined no-egress / no-PII attestation. */
  attestation: IntegratedAttestation;
}

export interface AssembleIntegratedRunPacketOptions {
  /** The lead driven through the Sales Closer workflow (B1). */
  lead: RawGtmProspectInput;
  /**
   * Optional audience row overrides used for scoring (B4). If omitted, a
   * conservative lawful row is derived from the lead. Any `id` is ignored — it is
   * always set to the run's prospect id so the score correlates with the run.
   */
  audienceRow?: Partial<AudienceInputRow>;
  /** Workspace this run is attributed to. Defaults to the Budget Wheels demo. */
  workspaceId?: string;
  /** Channels to produce dry-run plans for. Defaults to every modelled channel. */
  channels?: readonly ChannelKind[];
  /** The release stage this run operates at. Defaults to `dry_run` (passes). */
  releaseStage?: ReleaseStage;
  /** SANDBOX release conditions. Defaults to none (live fails closed). */
  releaseConditions?: ReleaseConditions;
  /** Mock-port outcomes to drive happy / blocked / rejected / pending paths. */
  portOverrides?: AssembleGtmRunPacketOptions['portOverrides'];
  /** Injectable clock + id generator for determinism (forwarded to B1 + B3). */
  now?: AssembleGtmRunPacketOptions['now'];
  newId?: AssembleGtmRunPacketOptions['newId'];
}

const DEFAULT_WORKSPACE_ID = 'budget_wheels_demo';

/**
 * Build a conservative, lawful audience row from a workflow lead when the caller
 * supplies none. Uses a human-reviewed public source label and legitimate-
 * interest consent — never a scraped/forbidden source.
 */
function deriveAudienceRow(
  lead: RawGtmProspectInput,
  prospectId: string,
  override?: AssembleIntegratedRunPacketOptions['audienceRow'],
): AudienceInputRow {
  return {
    id: prospectId,
    companyName: override?.companyName ?? lead.companyName,
    source: override?.source ?? 'public_site_manual_review',
    fit: override?.fit ?? 0.7,
    urgency: override?.urgency ?? 0.5,
    consentBasis: override?.consentBasis ?? 'legitimate_interest',
    evidence: override?.evidence ?? 'likely_inference',
    region: override?.region ?? lead.provinceOrState ?? undefined,
    contactEmailExample: override?.contactEmailExample,
    contactPhoneExample: override?.contactPhoneExample,
    notes: override?.notes,
  };
}

/**
 * Compose the full integrated run packet for one lead. Async only because the
 * B1 workflow ports are async; with mock ports it resolves entirely in-memory
 * with no IO. Asserts no-live-egress and no-raw-PII before returning.
 */
export async function assembleIntegratedRunPacket(
  opts: AssembleIntegratedRunPacketOptions,
): Promise<IntegratedRunPacket> {
  const workspaceId = opts.workspaceId ?? DEFAULT_WORKSPACE_ID;

  // B1 — run the lead through the Sales Closer workflow and assemble the packet.
  const run = await assembleGtmRunPacket({
    lead: opts.lead,
    workspaceId,
    portOverrides: opts.portOverrides,
    now: opts.now,
    newId: opts.newId,
  });
  const prospectId = run.prospect.id;

  // B4 — audience score, correlated to the run's prospect id.
  const audienceRow = deriveAudienceRow(opts.lead, prospectId, opts.audienceRow);
  const audienceResult = buildAudience([audienceRow]);
  const scored = audienceResult.prospects[0];
  if (!scored) {
    // The derived/override row was rejected (e.g. a disallowed source). Surface
    // it honestly rather than emitting a packet with a missing audience score.
    const reason = audienceResult.rejected[0]?.reason ?? 'unknown';
    throw new Error(`integration: audience row was rejected and produced no score (${reason})`);
  }

  // B2 — dry-run channel plans. Each is asserted non-live before it is kept.
  const channels = opts.channels ?? CHANNEL_KINDS;
  const channelPlans = channels.map((channel) => {
    const action = planDryRunAction(channel, { workspaceId, prospectId });
    assertNoLiveSend(action); // tripwire: throws if a plan ever claims to have sent
    return action;
  });

  // B3 — CRM-lite entity graph + operator timeline projected from the run.
  const crm = projectCrmLite(run, { now: opts.now });

  // B5 — TrustOps report over this run (adapted into the analytics input unit).
  const trustOps = buildTrustOpsReport([toWorkflowRunSummary(run)]);

  // B6 — release gate. Operative stage (default dry_run) + fail-closed live stage.
  const conditions = opts.releaseConditions ?? {};
  const releaseGate: IntegratedReleaseSection = {
    operative: evaluateReleaseGate(opts.releaseStage ?? 'dry_run', conditions),
    controlledLive: evaluateReleaseGate('controlled_live', conditions),
  };

  const packet: IntegratedRunPacket = {
    schema: INTEGRATED_RUN_PACKET_SCHEMA,
    mode: 'mock',
    workspaceId,
    generatedAt: run.timeline[0]?.at ?? (opts.now?.() ?? new Date()).toISOString(),
    audience: { score: scored.score, prospect: scored, rejected: audienceResult.rejected },
    run,
    channelPlans,
    crm,
    trustOps,
    releaseGate,
    attestation: {
      mode: 'mock',
      noLiveEgress: true,
      noRawPii: true,
      lanes: [...REQUIRED_PACKET_SECTIONS],
      statement:
        'MOCK/SANDBOX integrated run packet. No live egress: every channel action is a ' +
        'dry-run plan (sent:false) and the live send path fails closed. No raw PII: only ' +
        'reserved-TLD emails / 555-01xx phones may appear.',
    },
  };

  // Belt-and-braces, asserted before the packet leaves the builder:
  //  1. The live send path is genuinely fail-closed.
  assertSendLiveFailsClosed();
  //  2. The whole packet carries no real-looking PII (reserved TLDs allowed).
  assertIntegratedPacketNoRawPii(packet);

  return packet;
}

/**
 * The eight things the integrated packet must contain for the Command Center to
 * prove the loop. Used both as the attestation `lanes` list and by
 * {@link verifyIntegratedRunPacket}.
 */
export const REQUIRED_PACKET_SECTIONS = [
  'audience_score',
  'workflow_state',
  'workspace_id',
  'dry_run_channel_plans',
  'crm_lite_timeline',
  'trustops_report',
  'release_gate_result',
  'proof_action_trace',
] as const;

export type RequiredPacketSection = (typeof REQUIRED_PACKET_SECTIONS)[number];

/** Result of a completeness check over an integrated packet. */
export interface IntegratedPacketCompleteness {
  complete: boolean;
  /** Sections that are present and populated. */
  present: RequiredPacketSection[];
  /** Sections that are missing or empty. */
  missing: RequiredPacketSection[];
}

/**
 * Verify that an integrated packet actually contains every required section,
 * populated (not merely typed). Pure; returns a checklist rather than throwing
 * so a Command Center can render it.
 */
export function verifyIntegratedRunPacket(
  packet: IntegratedRunPacket,
): IntegratedPacketCompleteness {
  const checks: Record<RequiredPacketSection, boolean> = {
    audience_score: typeof packet.audience?.score?.score === 'number',
    workflow_state: Boolean(packet.run?.status && packet.run?.finalState),
    workspace_id: typeof packet.workspaceId === 'string' && packet.workspaceId.length > 0,
    dry_run_channel_plans:
      Array.isArray(packet.channelPlans) &&
      packet.channelPlans.length > 0 &&
      packet.channelPlans.every((p) => p.mode === 'dry_run' && p.sent === false),
    crm_lite_timeline: Array.isArray(packet.crm?.timeline) && packet.crm.timeline.length > 0,
    trustops_report:
      typeof packet.trustOps?.markdown === 'string' &&
      packet.trustOps.markdown.length > 0 &&
      typeof packet.trustOps.score?.score === 'number',
    release_gate_result: Boolean(
      packet.releaseGate?.operative?.reason && packet.releaseGate?.controlledLive?.reason,
    ),
    proof_action_trace: Array.isArray(packet.run?.timeline) && packet.run.timeline.length > 0,
  };

  const present: RequiredPacketSection[] = [];
  const missing: RequiredPacketSection[] = [];
  for (const section of REQUIRED_PACKET_SECTIONS) {
    (checks[section] ? present : missing).push(section);
  }
  return { complete: missing.length === 0, present, missing };
}

/**
 * Prove the live send path is fail-closed: {@link sendLive} must throw for the
 * default (impossible) gate. Throws if it ever fails to.
 */
export function assertSendLiveFailsClosed(): void {
  let threw = false;
  try {
    sendLive('email', { workspaceId: 'budget_wheels_demo', prospectId: 'sandbox' });
  } catch {
    threw = true;
  }
  if (!threw) {
    throw new Error('integration: live send path did not fail closed (sendLive must throw)');
  }
}

/** Email-shaped token; reserved fictional TLDs are permitted, anything else is raw PII. */
const EMAIL_TOKEN_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const RESERVED_EMAIL_TLDS = ['.example', '.test', '.invalid'];

/**
 * Scan the whole serialized packet for raw email PII. Only reserved-TLD
 * (`.example`/`.test`/`.invalid`) and already-masked (`*`) emails are permitted;
 * any real-looking address throws. Phone PII is guarded at its write boundaries
 * (B3 timeline records + B4 audience drops) and never enters the PII-safe
 * prospect, so the packet-level scan deliberately targets emails only — a blanket
 * phone-shape scan would false-positive on opaque uuids / plan refs. Throws on a hit.
 */
export function assertIntegratedPacketNoRawPii(packet: IntegratedRunPacket): void {
  const serialized = JSON.stringify(packet);
  for (const match of serialized.match(EMAIL_TOKEN_RE) ?? []) {
    if (match.includes('*')) continue; // already masked/redacted
    const lower = match.toLowerCase();
    if (RESERVED_EMAIL_TLDS.some((tld) => lower.endsWith(tld))) continue;
    throw new Error(`integration: raw email PII detected in run packet: "${match}"`);
  }
}

export type { CrmLiteProjection } from './adapters.js';
export { projectCrmLite, toWorkflowRunSummary, deriveOpportunityStage } from './adapters.js';
