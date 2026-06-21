import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  isSuccessProof,
  scanPii,
  verifyChain,
} from "../../packages/core/src/index.ts";
import type { LeadIntake } from "../../packages/core/src/index.ts";
import { runScenario } from "../src/harness.ts";
import { renderReport } from "../src/report.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "..", "fixtures");
const ARTIFACTS = join(HERE, "..", "artifacts");

function fixture(name: string): LeadIntake {
  return JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), "utf8"));
}

// --- approved lead can produce a proof ------------------------------------

test("approved lead produces a completed success proof", () => {
  const a = runScenario(fixture("lead-approved"));
  assert.equal(a.outcome, "completed");
  assert.equal(a.blockedAtStage, null);
  assert.ok(a.booking && a.booking.booked);
  assert.ok(a.crm && a.crm.written);
  assert.equal(a.verification.chainValid, true);
  assert.equal(isSuccessProof(a), true);
});

// --- blocked leads cannot produce a success proof -------------------------

for (const [name, stage] of [
  ["lead-blocked-consent", "consent_gate"],
  ["lead-blocked-compliance", "compliance_gate"],
  ["lead-rejected-approval", "human_approval"],
] as const) {
  test(`blocked lead "${name}" cannot produce a success proof`, () => {
    const a = runScenario(fixture(name));
    assert.equal(a.outcome, "blocked");
    assert.equal(a.blockedAtStage, stage);
    assert.equal(a.booking, null);
    assert.equal(a.crm, null);
    assert.equal(isSuccessProof(a), false, "blocked scenario must not be a success proof");
    // booking/writeback stages are present but skipped, never "ok".
    const booking = a.events.find((e) => e.stage === "appointment_booking");
    const writeback = a.events.find((e) => e.stage === "crm_writeback");
    assert.equal(booking?.status, "skipped");
    assert.equal(writeback?.status, "skipped");
  });
}

// --- proof contains no raw PII --------------------------------------------

test("proof artifact contains no raw PII", () => {
  const raw = fixture("lead-approved");
  const a = runScenario(raw);
  const serialized = JSON.stringify(a);
  assert.ok(!serialized.includes(raw.lead.fullName), "full name leaked");
  assert.ok(!serialized.includes(raw.lead.email), "email leaked");
  assert.ok(!serialized.includes(raw.lead.phone), "phone leaked");
  assert.equal(a.piiScan.rawPiiFound, false);
  // independent re-scan of the whole artifact finds nothing.
  assert.equal(scanPii(a).found, false);
});

test("harness throws fail-closed if raw PII would leak into a proof", () => {
  // `source` is carried into recorded event detail, so a raw email here
  // simulates accidental upstream leakage reaching the artifact.
  const raw = fixture("lead-approved");
  raw.source = `${raw.source} ops@leak.test`;
  assert.throws(() => runScenario(raw), /PII-shaped/);
});

// --- proof references the required events ---------------------------------

test("proof references consent / compliance / approval / writeback events", () => {
  const a = runScenario(fixture("lead-approved"));
  for (const key of ["consent", "compliance", "approval", "booking", "writeback"] as const) {
    assert.ok(a.eventIndex[key], `eventIndex.${key} should be set`);
  }
  // each index hash matches the corresponding stage event's hash.
  const byStage = (s: string) => a.events.find((e) => e.stage === s)?.eventHash;
  assert.equal(a.eventIndex.consent, byStage("consent_gate"));
  assert.equal(a.eventIndex.compliance, byStage("compliance_gate"));
  assert.equal(a.eventIndex.approval, byStage("human_approval"));
  assert.equal(a.eventIndex.writeback, byStage("crm_writeback"));
  // and the stages themselves are all present in the timeline.
  const stages = a.events.map((e) => e.stage);
  for (const s of [
    "lead_intake",
    "consent_gate",
    "compliance_gate",
    "human_approval",
    "appointment_booking",
    "crm_writeback",
  ]) {
    assert.ok(stages.includes(s as never), `missing stage ${s}`);
  }
});

// --- tamper evidence ------------------------------------------------------

test("mutating a recorded event breaks chain verification", () => {
  const a = runScenario(fixture("lead-approved"));
  assert.equal(verifyChain(a), true);
  a.events[2].detail.tampered = true;
  assert.equal(verifyChain(a), false);
});

// --- no outcome claims ----------------------------------------------------

test("every artifact carries the no-guarantee disclaimer and a bounded outcome", () => {
  for (const name of [
    "lead-approved",
    "lead-blocked-consent",
    "lead-blocked-compliance",
    "lead-rejected-approval",
  ]) {
    const a = runScenario(fixture(name));
    assert.ok(["completed", "blocked"].includes(a.outcome));
    assert.ok(
      a.disclaimers.some((d) => /no claim or guarantee/i.test(d)),
      "missing no-guarantee disclaimer",
    );
    const report = renderReport(a);
    assert.ok(/does not claim/i.test(report));
  }
});

// --- committed sample artifacts stay in sync ------------------------------

for (const name of ["lead-approved", "lead-blocked-compliance"]) {
  test(`committed sample artifact for "${name}" matches a fresh run`, () => {
    const fresh = runScenario(fixture(name));
    const committed = JSON.parse(
      readFileSync(join(ARTIFACTS, `${name}.proof.json`), "utf8"),
    );
    assert.deepEqual(committed, fresh, "run `npm run proof:regen` to refresh artifacts");
  });
}
