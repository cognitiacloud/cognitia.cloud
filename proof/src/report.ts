/**
 * Render a human-readable Markdown proof report from a proof artifact.
 * The report restates the disclaimer up front and shows the audit trail; it
 * never presents an outcome as a promised result.
 */

import type { ProofArtifact, ProofEvent } from "../../packages/core/src/index.ts";

function short(hash: string | null): string {
  if (!hash) return "—";
  return `${hash.slice(0, 12)}…`;
}

function statusBadge(status: ProofEvent["status"]): string {
  if (status === "ok") return "✅ ok";
  if (status === "blocked") return "⛔ blocked";
  return "⏭️ skipped";
}

export function renderReport(artifact: ProofArtifact): string {
  const lines: string[] = [];
  const outcomeLabel =
    artifact.outcome === "completed" ? "✅ COMPLETED" : "⛔ BLOCKED";

  lines.push(`# Client Zero Proof Report — \`${artifact.scenarioId}\``);
  lines.push("");
  lines.push(`**Outcome:** ${outcomeLabel}`);
  lines.push("");
  lines.push(
    `| Field | Value |`,
    `| --- | --- |`,
    `| Harness | \`${artifact.harness}\` |`,
    `| Proof schema | \`${artifact.proofSchemaVersion}\` |`,
    `| Client | \`${artifact.client}\` |`,
    `| Generated at | \`${artifact.generatedAt}\` |`,
    `| Lead reference (salted hash) | \`${artifact.leadRef}\` |`,
    `| Blocked at stage | \`${artifact.blockedAtStage ?? "—"}\` |`,
    `| Audit chain root | \`${short(artifact.auditChainRoot)}\` |`,
    `| Chain verified | ${artifact.verification.chainValid ? "yes" : "no"} |`,
    `| Raw PII found | ${artifact.piiScan.rawPiiFound ? "YES ⚠️" : "no"} |`,
  );
  lines.push("");

  lines.push("## ⚠️ What this report does and does not claim");
  lines.push("");
  for (const d of artifact.disclaimers) lines.push(`> ${d}`);
  lines.push("");

  lines.push("## Stage timeline (tamper-evident)");
  lines.push("");
  lines.push("| # | Stage | Status | Decision | At | Event hash |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const e of artifact.events) {
    lines.push(
      `| ${e.seq} | \`${e.stage}\` | ${statusBadge(e.status)} | \`${e.decision}\` | \`${e.at}\` | \`${short(e.eventHash)}\` |`,
    );
  }
  lines.push("");

  lines.push("## Referenced gate events");
  lines.push("");
  lines.push("| Gate | Event hash |");
  lines.push("| --- | --- |");
  lines.push(`| Consent | \`${short(artifact.eventIndex.consent)}\` |`);
  lines.push(`| Compliance | \`${short(artifact.eventIndex.compliance)}\` |`);
  lines.push(`| Human approval | \`${short(artifact.eventIndex.approval)}\` |`);
  lines.push(`| Appointment booking | \`${short(artifact.eventIndex.booking)}\` |`);
  lines.push(`| CRM writeback | \`${short(artifact.eventIndex.writeback)}\` |`);
  lines.push("");

  lines.push("## Appointment booking (mock-calendar)");
  lines.push("");
  if (artifact.booking) {
    const b = artifact.booking;
    lines.push(`- **Booked:** ${b.booked ? "yes" : "no"}`);
    lines.push(`- **Appointment ref:** \`${b.appointmentRef}\``);
    lines.push(`- **Slot:** \`${b.slotStart}\` → \`${b.slotEnd}\` (${b.timezone})`);
    lines.push(`- **Provider:** \`${b.provider}\` (mock — no live API called)`);
  } else {
    lines.push("_No appointment booked — pipeline blocked before booking._");
  }
  lines.push("");

  lines.push("## CRM writeback (mock-crm)");
  lines.push("");
  if (artifact.crm) {
    const c = artifact.crm;
    lines.push(`- **Written:** ${c.written ? "yes" : "no"}`);
    lines.push(`- **Record ref:** \`${c.recordRef}\``);
    lines.push(`- **System:** \`${c.system}\` (mock — no live API called)`);
    lines.push(`- **Fields (redacted refs only):**`);
    for (const [k, v] of Object.entries(c.fields)) {
      lines.push(`  - \`${k}\`: \`${String(v)}\``);
    }
  } else {
    lines.push("_No CRM record written — pipeline blocked before writeback._");
  }
  lines.push("");

  lines.push("## PII scan");
  lines.push("");
  lines.push(`- **String fields scanned:** ${artifact.piiScan.fieldsScanned}`);
  lines.push(`- **Raw PII found:** ${artifact.piiScan.rawPiiFound ? "YES ⚠️" : "none"}`);
  lines.push("");

  lines.push("## How to verify this proof");
  lines.push("");
  lines.push("```bash");
  lines.push(
    `node --experimental-strip-types proof/src/cli.ts verify <path-to-this>.proof.json`,
  );
  lines.push("```");
  lines.push("");
  lines.push(
    "Verification recomputes every event hash and the chain links, and re-runs the " +
      "PII scan. Any edit to any recorded event breaks the chain.",
  );
  lines.push("");

  return lines.join("\n");
}
