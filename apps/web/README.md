# @cognitia/web — operator console

Next.js (app router) console for operators. The **approval queue** is the first
screen. Business logic stays in the API; the web app is thin.

## Status

- ✅ Typed API client (`src/lib/apiClient.ts`) — talks to the approval-queue
  endpoints; injectable `fetch`, tenant via `x-tenant-id`.
- ✅ View-model (`src/lib/approvalQueue.ts`) — pure transforms + tests.
- ⬜ Next.js pages/components (deferred until we add `next`/`react` deps).

These contracts are intentionally framework-agnostic so they compile/test under
the base toolchain today and drop straight into Next.js server components.

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
