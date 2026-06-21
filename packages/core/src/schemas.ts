/**
 * Closer-pipeline domain schemas for Client Zero.
 *
 * These are the fixture-compatible shapes the workflow, compliance, and CRM
 * workers will emit. They are the source of truth for the integration contract
 * (see `proof/INTEGRATION_CONTRACT.md`). Runtime validators are hand-rolled type
 * guards — zero dependencies, runnable under Node's type-stripping.
 */

export type Client = "client-zero";

export type ApprovalDecisionValue = "approved" | "rejected" | "pending";

/** Synthetic, fixture-only contact details. Redacted at intake, never stored. */
export interface LeadContact {
  fullName: string;
  email: string;
  phone: string;
}

/** Consent captured at lead-in. Inputs to the consent gate. */
export interface ConsentRecord {
  marketingConsent: boolean;
  dataProcessingConsent: boolean;
  /** The disclosure text the lead actually saw. */
  consentText: string;
  consentTimestamp: string;
  channel: string;
  /** Pre-hashed client IP — upstream must never pass a raw IP. */
  ipHashRef?: string;
}

/** Compliance signals evaluated by the compliance gate. */
export interface ComplianceSignals {
  jurisdiction: string;
  onDoNotContactList: boolean;
  ageVerified: boolean;
  quietHoursOk: boolean;
  /** Required for outbound calling in US/CA TCPA jurisdictions. */
  tcpaWrittenConsent: boolean;
}

/** Human-in-the-loop approval decision. */
export interface ApprovalDecision {
  decision: ApprovalDecisionValue;
  /** Role id or pre-hashed approver reference — never a raw person name. */
  approverRef: string;
  decidedAt: string;
  notes: string;
}

export interface AppointmentWindow {
  windowStart: string;
  windowEnd: string;
  timezone: string;
}

/** Root fixture shape: a single lead and everything known about it. */
export interface LeadIntake {
  scenarioId: string;
  client: Client;
  source: string;
  submittedAt: string;
  lead: LeadContact;
  consent: ConsentRecord;
  compliance: ComplianceSignals;
  approval: ApprovalDecision;
  requestedAppointment: AppointmentWindow;
  /** Optional fixed clock so committed sample artifacts are reproducible. */
  proofClock?: string;
}

/** Mock-calendar booking result (harness-produced; no live API). */
export interface BookingResult {
  booked: boolean;
  appointmentRef: string;
  slotStart: string;
  slotEnd: string;
  timezone: string;
  provider: "mock-calendar";
}

/** Mock-CRM writeback result (harness-produced; no live API). */
export interface CrmWritebackResult {
  written: boolean;
  recordRef: string;
  system: "mock-crm";
  /** Redacted reference fields only — never raw PII. */
  fields: Record<string, string | number | boolean>;
}

// ---------------------------------------------------------------------------
// Runtime validators — plain guards so real worker outputs can be checked at
// the seam where they replace fixtures.
// ---------------------------------------------------------------------------

class SchemaError extends Error {}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function reqString(obj: Record<string, unknown>, key: string, path: string): string {
  const v = obj[key];
  if (typeof v !== "string" || v.length === 0)
    throw new SchemaError(`${path}.${key} must be a non-empty string`);
  return v;
}

function reqBool(obj: Record<string, unknown>, key: string, path: string): boolean {
  const v = obj[key];
  if (typeof v !== "boolean")
    throw new SchemaError(`${path}.${key} must be a boolean`);
  return v;
}

export function assertConsentRecord(v: unknown, path = "consent"): ConsentRecord {
  if (!isObject(v)) throw new SchemaError(`${path} must be an object`);
  reqBool(v, "marketingConsent", path);
  reqBool(v, "dataProcessingConsent", path);
  reqString(v, "consentText", path);
  reqString(v, "consentTimestamp", path);
  reqString(v, "channel", path);
  return v as unknown as ConsentRecord;
}

export function assertComplianceSignals(
  v: unknown,
  path = "compliance",
): ComplianceSignals {
  if (!isObject(v)) throw new SchemaError(`${path} must be an object`);
  reqString(v, "jurisdiction", path);
  reqBool(v, "onDoNotContactList", path);
  reqBool(v, "ageVerified", path);
  reqBool(v, "quietHoursOk", path);
  reqBool(v, "tcpaWrittenConsent", path);
  return v as unknown as ComplianceSignals;
}

export function assertApprovalDecision(
  v: unknown,
  path = "approval",
): ApprovalDecision {
  if (!isObject(v)) throw new SchemaError(`${path} must be an object`);
  const decision = reqString(v, "decision", path);
  if (decision !== "approved" && decision !== "rejected" && decision !== "pending")
    throw new SchemaError(`${path}.decision must be approved|rejected|pending`);
  reqString(v, "approverRef", path);
  reqString(v, "decidedAt", path);
  if (typeof v.notes !== "string")
    throw new SchemaError(`${path}.notes must be a string`);
  return v as unknown as ApprovalDecision;
}

export function assertLeadIntake(v: unknown, path = "lead"): LeadIntake {
  if (!isObject(v)) throw new SchemaError(`${path} must be an object`);
  reqString(v, "scenarioId", path);
  if (v.client !== "client-zero")
    throw new SchemaError(`${path}.client must be "client-zero"`);
  reqString(v, "source", path);
  reqString(v, "submittedAt", path);

  const lead = v.lead;
  if (!isObject(lead)) throw new SchemaError(`${path}.lead must be an object`);
  reqString(lead, "fullName", `${path}.lead`);
  reqString(lead, "email", `${path}.lead`);
  reqString(lead, "phone", `${path}.lead`);

  assertConsentRecord(v.consent, `${path}.consent`);
  assertComplianceSignals(v.compliance, `${path}.compliance`);
  assertApprovalDecision(v.approval, `${path}.approval`);

  const appt = v.requestedAppointment;
  if (!isObject(appt))
    throw new SchemaError(`${path}.requestedAppointment must be an object`);
  reqString(appt, "windowStart", `${path}.requestedAppointment`);
  reqString(appt, "windowEnd", `${path}.requestedAppointment`);
  reqString(appt, "timezone", `${path}.requestedAppointment`);

  return v as unknown as LeadIntake;
}

export { SchemaError };
