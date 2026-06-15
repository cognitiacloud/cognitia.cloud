# Lane B — Approval Queue & Run Visibility (operator UI)

Operator-facing surfaces for the governed agent backend: a clean Approval Queue, a
Runs list, a Run-detail timeline, and a shared Action-detail drawer (evidence +
write preview + approve/reject/execute/rollback with structured reason codes).
Built on the existing console shell and API contracts — no new backend fields.

## Base

Branched/re-seeded from `claude/gtm-platform-mvp-setup-vYLBG` (the live operator
console: dashboard shell + RUN-1/RUN-2 + EVID-1 backend). Developed on
`claude/approval-workflow-operator-ui-a2fh6h`; PR targets the gtm base.

## Files changed

Added:

- `apps/web/src/app/(dashboard)/approvals/page.tsx` — clean Approval Queue in the
  dashboard shell (status filter, status chips, evidence count, row → drawer).
- `apps/web/src/app/(dashboard)/runs/[id]/page.tsx` — Run detail: run header +
  rollup + action timeline; failed-run banner; row → drawer.
- `apps/web/src/components/ActionDrawer.tsx` — shared decision drawer (WHY-1
  rationale, GOV-1 write preview, approve/reject/execute/rollback + reason codes).
- `apps/web/src/lib/runsView.ts` (+ `runsView.test.ts`) — pure view-model
  (rollup summary, needs-review, status options, action-type labels).
- Tests: `apps/web/src/app/(dashboard)/runs/page.test.tsx`,
  `apps/web/src/app/(dashboard)/runs/[id]/page.test.tsx`,
  `apps/web/src/app/(dashboard)/approvals/page.test.tsx`,
  `apps/web/src/components/ActionDrawer.test.tsx`.

Changed:

- `apps/web/src/app/(dashboard)/runs/page.tsx` — replaced the "being wired" stub
  with the real runs list (RUN-1 rollups, status filter, link to detail).
- `apps/web/src/components/nav.ts` — Approvals is now in-shell (dropped
  `standalone`); the dashboard `/approvals` route is the clean queue.
- `apps/web/src/lib/useConsole.ts` — added `useReloadable()` (additive; `useAsync`
  plus a `reload` callback so a surface re-fetches after a decision).
- `apps/web/src/app/globals.css` — added buttons, filters, form fields, key/value,
  notices, and drawer styles using the existing CSS tokens.
- `docs/truth-report.json` — repointed `a11y-checks-primary-route` evidence to the
  new approvals/run/drawer a11y tests + the relocated classic test (TRUTH-1 honest).

Moved (kept reachable, not deleted):

- `apps/web/src/app/approvals/{page,a11y.test}.tsx` →
  `apps/web/src/app/console-classic/` — the original 1,348-line monolith (queue +
  governance + audit + scorecards + readiness) now lives at `/console-classic`,
  linked from the new Approvals header. This frees `/approvals` for the clean page
  and avoids a route collision; no monolith functionality was removed.

## Backend contracts relied on (all pre-existing; nothing invented)

`apps/web/src/lib/apiClient.ts` via `consoleClient()`:

- `runPlans()` → `GET /agent-runs` → `{ runs: RunPlanView[] }` (RUN-1 rollups).
- `runDetail(id)` → `GET /agent-runs/:id` → `RunDetailView` (run + rollup +
  `actions: RunTimelineActionView[]`) (RUN-2).
- `listActions(status?)` → `GET /agent-actions` → `{ actions: AgentActionView[] }`.
- `approve/reject(id, {reason_code, note?})`, `execute(id)`,
  `rollback(id, {reason_code, note?})` → `AgentActionView`.
- `actionRationale(id)` → `DecisionRationaleView` (WHY-1: account, score, evidence,
  freshness.stale_since_proposal).
- `previewAction(id)` → `ExecutionPreviewView` (GOV-1: would_execute, denial_reason,
  byte-exact `plan.properties`).
- Reason codes: exported `APPROVE_REASON_CODES` / `REJECT_REASON_CODES`; `note`
  required when `reason_code === 'other'` (server enforces; UI mirrors it).
- Status vocab consumed verbatim: approval `proposed|approved|rejected`; execution
  `pending|executing|executed|failed|rolled_back`; run `pending|running|completed|failed`.

## Authz — preserved, not weakened

- Server enforces roles (`viewer` read; `operator` approve/reject/execute/rollback;
  `owner` resume). The console derives tenant+role from the signed session at the
  edge — `useConsole`/`consoleClient()` send no tenant or role from the browser.
- The drawer renders decision controls and relies on **server-side 403**, surfaced
  as "Operator role required …" (covered by a test). It never assumes a role,
  never fakes a client-side gate, and never calls a mutating endpoint implicitly.
  Read-only surfaces (runs, timeline, evidence, preview) work for viewers.

## Missing API fields (flagged, not invented)

- **No client-readable role/session identity endpoint.** There is no `me`/session
  call exposing the operator's role, so the UI cannot pre-disable controls by role;
  it relies on the server 403. If desired later, a `GET /session` (role only) would
  let the queue hide rather than 403 mutating controls.
- **No single-action read** (`GET /agent-actions/:id`). The drawer composes context
  from `rationale` + `preview` (both viewer-safe); it does not need the raw row.
  The run timeline's `RunTimelineActionView` omits `evidence_refs`/`draft`, so the
  per-action evidence _count_ in the drawer comes from `rationale.evidence_refs_on_action`.

## Tests run

- `pnpm run check` → format:check + typecheck + `vitest run`: **519 tests, 79 files, all pass.**
  (New: 18 tests across the runs view-model, runs list/detail pages, approvals page,
  and the action drawer — render + filters + loading/error/empty + axe-core
  no-serious-violations + reason-code/note rule + 403 handling + failure visibility.)
- `pnpm --filter @cognitia/web run build` → all 13 routes compile (incl. `/approvals`,
  `/runs`, dynamic `/runs/[id]`, `/console-classic`).

## Blockers

- None blocking. Real-browser E2E (Playwright) remains out of scope per the existing
  `real-browser-e2e-smoke` capability in `docs/truth-report.json`; this lane keeps the
  browser-free jsdom + axe-core smoke.

## Next step

- Live-API verification: run the operator API + `pnpm --filter @cognitia/web dev`
  with `NEXT_PUBLIC_API_URL` set, and walk runs → detail → drawer → approve/execute.
- Optional follow-ups: batch approve/reject in the queue (apiClient already exposes
  `batchApprove`/`batchReject`); a `GET /session` role endpoint to pre-gate controls;
  surface EVID-1 `syncHistory`/`opportunities` where run evidence needs broader context.
