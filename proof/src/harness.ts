/**
 * Client Zero acceptance-proof harness.
 *
 * Runs a single lead through the documented pipeline and emits a tamper-evident
 * proof artifact. Every gate appends a chained event. No live APIs are called:
 * the calendar and CRM are deterministic mocks. No raw PII is ever written into
 * the artifact — identities are reduced to salted references and the finished
 * artifact is scanned fail-closed before it can be returned.
 *
 *   lead in -> consent gate -> compliance gate -> human approval
 *           -> appointment booking (mock) -> CRM writeback (mock) -> proof
 */

import {
  appendEvent,
  countStringFields,
  GENESIS_HASH,
  HARNESS_NAME,
  hashRef,
  isSuccessProof,
  PROOF_SCHEMA_VERSION,
  REQUIRED_DISCLAIMER,
  scanPii,
  verifyChain,
} from "../../packages/core/src/index.ts";
import type {
  BookingResult,
  CrmWritebackResult,
  EventIndex,
  LeadIntake,
  ProofArtifact,
  ProofEvent,
  Stage,
} from "../../packages/core/src/index.ts";
import { assertLeadIntake } from "../../packages/core/src/index.ts";

export const DEFAULT_SALT = "cognitia-client-zero";

export interface RunOptions {
  /** Fixed `generatedAt`; defaults to the fixture `proofClock` then now(). */
  now?: string;
  /** Salt for identity hashing; defaults to PROOF_SALT env or DEFAULT_SALT. */
  salt?: string;
}

interface GateResult {
  passed: boolean;
  decision: string;
  detail: Record<string, string | number | boolean>;
}

function consentGate(lead: LeadIntake): GateResult {
  const c = lead.consent;
  const passed = c.marketingConsent && c.dataProcessingConsent;
  return {
    passed,
    decision: passed ? "consent_granted" : "consent_withheld",
    detail: {
      marketingConsent: c.marketingConsent,
      dataProcessingConsent: c.dataProcessingConsent,
      channel: c.channel,
      consentTimestamp: c.consentTimestamp,
    },
  };
}

function complianceGate(lead: LeadIntake): GateResult {
  const s = lead.compliance;
  const callingJurisdiction = /^(US|CA)\b/i.test(s.jurisdiction);
  const reasons: string[] = [];
  if (s.onDoNotContactList) reasons.push("on_do_not_contact_list");
  if (!s.ageVerified) reasons.push("age_not_verified");
  if (!s.quietHoursOk) reasons.push("quiet_hours_violation");
  if (callingJurisdiction && !s.tcpaWrittenConsent) reasons.push("tcpa_consent_missing");
  const passed = reasons.length === 0;
  return {
    passed,
    decision: passed ? "compliance_cleared" : `compliance_blocked:${reasons.join("+")}`,
    detail: {
      jurisdiction: s.jurisdiction,
      onDoNotContactList: s.onDoNotContactList,
      ageVerified: s.ageVerified,
      quietHoursOk: s.quietHoursOk,
      tcpaWrittenConsent: s.tcpaWrittenConsent,
      blockedReasons: reasons.join("+"),
    },
  };
}

function approvalGate(lead: LeadIntake): GateResult {
  const a = lead.approval;
  const passed = a.decision === "approved";
  return {
    passed,
    decision: `human_${a.decision}`,
    detail: {
      decision: a.decision,
      approverRef: a.approverRef,
      decidedAt: a.decidedAt,
    },
  };
}

/** Deterministic mock-calendar booking — no network. */
function mockBooking(lead: LeadIntake, salt: string): BookingResult {
  const appt = lead.requestedAppointment;
  const appointmentRef = `appt_${hashRef(
    `${lead.scenarioId}|${appt.windowStart}|${appt.windowEnd}`,
    salt,
  )}`;
  return {
    booked: true,
    appointmentRef,
    slotStart: appt.windowStart,
    slotEnd: appt.windowEnd,
    timezone: appt.timezone,
    provider: "mock-calendar",
  };
}

/** Deterministic mock-CRM writeback — redacted refs only, no raw PII. */
function mockWriteback(
  lead: LeadIntake,
  leadRef: string,
  booking: BookingResult,
  consentHash: string,
  salt: string,
): CrmWritebackResult {
  return {
    written: true,
    recordRef: `crm_${hashRef(`${lead.scenarioId}|${leadRef}`, salt)}`,
    system: "mock-crm",
    fields: {
      leadRef,
      appointmentRef: booking.appointmentRef,
      consentEventHash: consentHash,
      stage: "appointment_booked",
      source: lead.source,
    },
  };
}

/**
 * Run a scenario end-to-end and return a verified proof artifact.
 * Throws if any raw PII survives into the artifact (fail-closed).
 */
export function runScenario(input: unknown, opts: RunOptions = {}): ProofArtifact {
  const lead = assertLeadIntake(input);
  const salt = opts.salt ?? process.env.PROOF_SALT ?? DEFAULT_SALT;
  const generatedAt = opts.now ?? lead.proofClock ?? new Date().toISOString();

  const leadRef = hashRef(
    `${lead.lead.fullName}|${lead.lead.email}|${lead.lead.phone}`,
    salt,
  );

  const events: ProofEvent[] = [];
  const eventIndex: EventIndex = {
    consent: null,
    compliance: null,
    approval: null,
    booking: null,
    writeback: null,
  };

  // 1. lead intake — always recorded, never carries raw contact details.
  appendEvent(events, {
    stage: "lead_intake",
    status: "ok",
    decision: "lead_received",
    detail: { source: lead.source, leadRef, submittedAt: lead.submittedAt },
    at: lead.submittedAt,
  });

  let blockedAtStage: Stage | null = null;

  const runGate = (
    stage: Stage,
    indexKey: keyof EventIndex,
    at: string,
    gate: GateResult,
  ): boolean => {
    if (blockedAtStage !== null) {
      appendEvent(events, { stage, status: "skipped", decision: "skipped_upstream_block", detail: {}, at });
      return false;
    }
    const evt = appendEvent(events, {
      stage,
      status: gate.passed ? "ok" : "blocked",
      decision: gate.decision,
      detail: gate.detail,
      at,
    });
    eventIndex[indexKey] = evt.eventHash;
    if (!gate.passed) blockedAtStage = stage;
    return gate.passed;
  };

  runGate("consent_gate", "consent", lead.consent.consentTimestamp, consentGate(lead));
  runGate("compliance_gate", "compliance", lead.submittedAt, complianceGate(lead));
  runGate("human_approval", "approval", lead.approval.decidedAt, approvalGate(lead));

  let booking: BookingResult | null = null;
  let crm: CrmWritebackResult | null = null;

  if (blockedAtStage === null) {
    booking = mockBooking(lead, salt);
    const bookingEvt = appendEvent(events, {
      stage: "appointment_booking",
      status: "ok",
      decision: "appointment_booked",
      detail: {
        appointmentRef: booking.appointmentRef,
        slotStart: booking.slotStart,
        slotEnd: booking.slotEnd,
        timezone: booking.timezone,
        provider: booking.provider,
      },
      at: booking.slotStart,
    });
    eventIndex.booking = bookingEvt.eventHash;

    crm = mockWriteback(lead, leadRef, booking, eventIndex.consent ?? GENESIS_HASH, salt);
    const writebackEvt = appendEvent(events, {
      stage: "crm_writeback",
      status: "ok",
      decision: "crm_record_written",
      detail: {
        recordRef: crm.recordRef,
        system: crm.system,
        appointmentRef: booking.appointmentRef,
        leadRef,
      },
      at: generatedAt,
    });
    eventIndex.writeback = writebackEvt.eventHash;
  } else {
    for (const stage of ["appointment_booking", "crm_writeback"] as Stage[]) {
      appendEvent(events, {
        stage,
        status: "skipped",
        decision: "skipped_upstream_block",
        detail: {},
        at: generatedAt,
      });
    }
  }

  const outcome = blockedAtStage === null ? "completed" : "blocked";
  const auditChainRoot = events[events.length - 1].eventHash;

  const artifact: ProofArtifact = {
    proofSchemaVersion: PROOF_SCHEMA_VERSION,
    harness: HARNESS_NAME,
    scenarioId: lead.scenarioId,
    client: lead.client,
    generatedAt,
    leadRef,
    outcome,
    blockedAtStage,
    events,
    eventIndex,
    booking,
    crm,
    auditChainRoot,
    piiScan: { rawPiiFound: false, fieldsScanned: 0, matches: [] },
    verification: { chainValid: false },
    disclaimers: [REQUIRED_DISCLAIMER],
  };

  // Fail-closed PII gate: scan everything except the piiScan summary itself.
  const { piiScan: _ignore, ...scanTarget } = artifact;
  const scan = scanPii(scanTarget);
  artifact.piiScan = {
    rawPiiFound: scan.found,
    fieldsScanned: countStringFields(scanTarget),
    matches: scan.matches.map((m) => ({ kind: m.kind, redacted: m.redacted })),
  };
  if (scan.found) {
    throw new Error(
      `Refusing to emit proof artifact: ${scan.matches.length} PII-shaped value(s) detected.`,
    );
  }

  artifact.verification.chainValid = verifyChain(artifact);
  if (!artifact.verification.chainValid) {
    throw new Error("Refusing to emit proof artifact: audit chain failed verification.");
  }

  // Defence in depth: a blocked scenario must never present as a success proof.
  if (outcome === "blocked" && isSuccessProof(artifact)) {
    throw new Error("Invariant violation: blocked scenario produced a success proof.");
  }

  return artifact;
}
