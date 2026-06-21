/*
 * Headless smoke test for the operator console — no browser required.
 *
 * Loads fixtures.js in a minimal window shim and asserts the Client Zero
 * safety invariants:
 *   - mock data is flagged as such
 *   - no real PII (only .example emails + 555-01xx phones)
 *   - every draft is preview_only
 *   - BLOCKED leads carry block reason codes (approval gate has cause)
 *   - any finance/APR claim count > 0 implies a BLOCKED state
 *
 * Run: node apps/web/operator-console/verify.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const dir = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(dir, "fixtures.js"), "utf8");

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

const data = sandbox.window.CLIENT_ZERO_FIXTURES;
let failures = 0;
function check(name, cond) {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${name}`);
}

check("fixtures loaded", data && Array.isArray(data.leads) && data.leads.length > 0);
check("data is flagged mock-fixtures", data.source === "mock-fixtures");

const emailRe = /@[^@\s]+\.example$/;
const phoneRe = /\(555\)\s?01\d\d/; // 555-01xx fictional block

for (const lead of data.leads) {
  const tag = lead.id;
  check(`${tag}: email uses .example`, emailRe.test(lead.email));
  check(`${tag}: phone uses 555-01xx`, phoneRe.test(lead.phone));
  check(`${tag}: draft is preview_only`, lead.draft.status === "preview_only");
  check(
    `${tag}: valid compliance state`,
    ["PASS", "NEEDS_REVIEW", "BLOCKED"].includes(lead.compliance.state)
  );

  const hasBlockReason = lead.compliance.reasons.some((r) => r.severity === "block");
  if (lead.compliance.state === "BLOCKED") {
    check(`${tag}: BLOCKED lead has a block reason code`, hasBlockReason);
  }

  // Human approval gate must always be representable.
  const hasApprovalGate = lead.compliance.reasons.some(
    (r) => r.code === "HUMAN_APPROVAL_REQUIRED"
  );
  check(`${tag}: human-approval gate present`, hasApprovalGate);

  // Finance/APR/approval claims must force a BLOCKED state.
  const s = lead.draft.claimScan;
  const claimHit = (s.financeTerms || 0) + (s.aprTerms || 0) + (s.approvalOddsTerms || 0) > 0;
  if (claimHit) {
    check(`${tag}: finance/APR claim ⇒ BLOCKED`, lead.compliance.state === "BLOCKED");
  } else {
    check(`${tag}: no finance/APR claims`, true);
  }
}

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
