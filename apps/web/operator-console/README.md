# Client Zero — Sales Closer Operator Console

Operator-facing console for the **Client Zero Sales Closer happy path**. It
gives a human operator a single screen to review a lead, see its compliance
state, read the drafted (but **unsent**) outreach, and explicitly approve or
reject it before anything moves forward.

> **Status: sandbox / mock.** This view ships with synthetic fixtures only. The
> real workflow core is not wired in yet — see [Adapter contract](#adapter-contract)
> for exactly how to connect it.

## Hard safety rules (enforced in this view)

| Rule | How it's honored here |
| --- | --- |
| No live outreach | The draft is `preview_only`. There is **no send button** anywhere in this console. Approval only marks a draft "ready"; sending is out of scope. |
| No real prospect data | All fixtures use the reserved `.example` TLD (RFC 2606) and `555-01xx` phone numbers (NANP fictional block). |
| No vendor APIs | Zero network calls. The page opens from `file://`. Appointment/CRM are clearly labelled `mock-scheduler` / `mock-crm`. |
| No finance / APR / approval claims | A claim scanner panel shows counts for finance, APR, approval-odds, and guarantee terms. The blocked sample lead demonstrates `FINANCE_CLAIM_DETECTED`. |
| Human approval controls visible | The "Human approval controls" card is always present. **Approve is disabled whenever compliance state is `BLOCKED`.** Decisions are appended to the proof log. |

A persistent amber banner marks the page as sandbox/mock data and is only
hidden when the adapter reports `source === "workflow-core"`.

## What the console shows

- **Lead detail** — identity, source, stage, intent, and recorded consent state.
- **Compliance state badge** — `PASS` / `NEEDS_REVIEW` / `BLOCKED`.
- **Block / reason codes** — machine codes (e.g. `HUMAN_APPROVAL_REQUIRED`,
  `CONSENT_MISSING`, `FINANCE_CLAIM_DETECTED`) with severity + human explanation.
- **Draft summary preview** — subject, plain-language summary, full body
  (preview only), word count, and claim-scan results.
- **Human approve / reject controls** — gated by compliance state.
- **Appointment / CRM mock status** — proposed slots and dry-run CRM record.
- **Proof log panel** — append-only audit trail; operator decisions are appended live.

## Run / verify locally

No build step, no dependencies.

```bash
# Option A: just open it
open apps/web/operator-console/index.html        # macOS
xdg-open apps/web/operator-console/index.html    # Linux

# Option B: static server (recommended if your browser blocks file:// scripts)
cd apps/web/operator-console && python3 -m http.server 8080
# then visit http://localhost:8080/
```

A headless smoke test (no browser required) validates the fixtures and render
logic in Node:

```bash
node apps/web/operator-console/verify.mjs
```

See [VERIFICATION.md](./VERIFICATION.md) for the recorded check output.

## Architecture

```
index.html     markup + safety banner shell
styles.css     dark operator theme, badge/reason/proof styling
fixtures.js    synthetic data  ← REPLACE with workflow-core adapter
app.js         render + interaction (zero deps, zero network)
verify.mjs     headless smoke test of fixtures + decision gate
```

`app.js` reads its data from `window.CLIENT_ZERO_FIXTURES`. To go live, replace
`fixtures.js` with an adapter that fetches the same shape from workflow core.

## Adapter contract

The console consumes one object shaped exactly like `window.CLIENT_ZERO_FIXTURES`.
The live adapter MUST:

1. Set `source: "workflow-core"` (this hides the mock banner).
2. Provide `leads[]` where each lead matches this shape:

```ts
type ComplianceState = "PASS" | "NEEDS_REVIEW" | "BLOCKED";

interface Lead {
  id: string;
  name: string; company: string; role: string;
  email: string; phone: string; timezone: string;
  source: string; stage: string; intent: string;
  consent: { marketing: "granted" | "denied" | "unknown";
             recordedAt: string | null; basis: string };
  compliance: {
    state: ComplianceState;
    summary: string;
    reasons: { code: string; severity: "block" | "warn" | "info";
               label: string; detail: string }[];
  };
  draft: {
    channel: string;
    status: "preview_only";              // adapter MUST keep this preview-only
    subject: string; previewSummary: string; body: string; wordCount: number;
    generatedBy: string;
    claimScan: { financeTerms: number; aprTerms: number;
                 approvalOddsTerms: number; guaranteeTerms: number };
  };
  appointment: { provider: string; status: "proposed" | "confirmed" | "none";
                 proposedSlots: string[]; confirmedSlot: string | null; note: string };
  crm: { provider: string; status: "synced_dry_run" | "pending" | "error" | "not_synced";
         recordId: string | null; lastSyncedAt: string | null; note: string };
  proofLog: { ts: string; actor: "system" | "operator";
              event: string; detail: string; hash: string }[];
}
```

### Decision callback (to be added when wiring sends)

This console records operator decisions **locally only** — it never transmits
them. When the workflow core is ready to receive approvals, give the adapter an
`onDecision(leadId, "approved" | "rejected", { at })` hook and call it from
`recordDecision()` in `app.js`. The UI gate (Approve disabled while `BLOCKED`)
must remain enforced client-side **and** be re-validated server-side.

### Non-negotiable adapter invariants

- Never emit real prospect PII into fixtures or logs.
- `draft.status` stays `preview_only` in this view; an actual send path lives
  behind a separate, server-enforced approval — not in this console.
- Any finance/APR/approval-odds content must surface as a `BLOCKED` reason code,
  never as approvable copy.
