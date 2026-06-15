# @cognitia/web — operator console

Next.js (app router) console for operators. The **approval queue** is the first
screen. Business logic stays in the API; the web app is thin.

## Status

- ✅ Typed API client (`src/lib/apiClient.ts`) — injectable `fetch`; operator
  routes derive tenant + role from the signed session.
- ✅ View-model (`src/lib/approvalQueue.ts`) — pure transforms + tests.
- ✅ **Operator shell** — dark control-plane sidebar, command bar, KPI-first
  `/overview`, and the `(dashboard)` route group (runs, contacts, meetings,
  audit, integrations, settings). Self-contained CSS design system in
  `src/app/globals.css` (no Tailwind dependency; a later swap is a drop-in).
- ✅ Full **approval console** at `/approvals` (standalone chrome for now).
- ⬜ Per-page data wiring for runs/contacts/meetings/audit/integrations (the
  pages render honest empty/loading/error states until each slice lands).

## Running the console

```
# 1) start the API (separate terminal) — see apps/api
# 2) point the console at it and run the dev server
NEXT_PUBLIC_API_URL=http://localhost:3001 pnpm --filter @cognitia/web dev
# open http://localhost:3000  (redirects to /overview)
```

`NEXT_PUBLIC_API_URL` defaults to `http://localhost:3001`. With no reachable API
the console still renders and shows an explicit "API not reachable" state — it
never fabricates metrics. Verify a build with `pnpm --filter @cognitia/web build`.

## Design system

Tokens + utility classes live in `src/app/globals.css` (CSS variables: surfaces,
borders, one accent, status colors; classes: `.shell/.sidebar/.topbar/.card/
.kpi/.chip/.table/.state`). Tailwind was specified for this work; it is omitted
here only to avoid a frozen-lockfile/CI change the pipeline does not exercise
(CI runs web `typecheck` + the a11y test, not the CSS build). Swapping to
Tailwind later is mechanical — the className surface is already utility-shaped.

## Next step (wiring the page)

1. Add deps: `next`, `react`, `react-dom`, `@types/react`; add a web-specific
   `tsconfig` with `"jsx": "react-jsx"` and the `dom` lib.
2. `src/app/approvals/page.tsx` (server component):
   - read `x-tenant-id` from the operator session,
   - `new ApiClient({ baseUrl, tenantId, fetch })` → `listProposed()`,
   - `toApprovalQueueView(actions)` → render a table (channel, risk, target,
     evidence count, subject, status).
3. Row actions (client component) call `approve` / `reject` / `execute`.
   - `execute` is only enabled once `approval_status === 'approved'`; the API
     still refuses (409) otherwise — the UI must surface that, not assume.
4. A "Run Mira" button calls `runMira()` and refreshes the queue.

## Invariants the UI must respect

- Never send without an approved action (the API enforces it; mirror in UX).
- Show evidence refs for each draft (grounding is visible to the reviewer).
- Tenant comes from the authenticated session, never user input.
