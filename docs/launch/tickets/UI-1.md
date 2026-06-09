# UI-1 — Approval-queue Next.js console

**Owner:** ENG-web · **Risk:** Medium · **Effort:** ~5d · **Gate:** 1 (V1 go-live)
**Deps:** API-1 (persistent API + auth) · **Scope fence:** CRM actions only — no email UI.

## Objective

Mount the operator console that drives the V1 success loop from a screen:
run Mira → review evidence-grounded proposals → approve/reject → execute → see the audit trail.

## Current reality (HEAD ea7677e)

- `apps/web/src/lib/apiClient.ts` + `approvalQueue.ts` (typed client + view-model) **exist and are tested**.
- **No Next.js pages mounted**; `apps/web` has no `next`/`react` deps yet.

## Files likely to change

- `apps/web/package.json` / `tsconfig` — add `next`, `react`, `react-dom`, `@types/react`; web tsconfig with `jsx: react-jsx` + `dom` lib.
- `apps/web/src/app/approvals/page.tsx` _(new)_ — server component: `ApiClient.listProposed()` → `toApprovalQueueView()` → table.
- `apps/web/src/app/approvals/actions.tsx` _(new, client)_ — approve/reject/execute row actions.
- Auth/session wiring → tenant (from API-1).

## Acceptance criteria

1. Operator sees the proposed-actions queue (channel, risk, target, **evidence count**, draft preview, status), highest-risk first.
2. Approve/Reject work; **Execute is disabled until `approval_status='approved'`**, and a 409 from the API is surfaced (never assumed success).
3. A "Run Mira" button triggers a run and refreshes the queue.
4. Every row links to its **evidence pack** and audit chain.
5. **Channel is CRM only** — no email composer, no send button (scope fence).
6. Tenant derives from the authenticated session, never user input.

## Test plan

- View-model unit tests already cover sorting/status (`approvalQueue.test.ts`); extend for CRM-only rows.
- Component/e2e (Playwright later): drive run→approve→execute; assert execute-disabled-until-approved + 409 surfacing.

## Security notes

- No tenant from query/header in the browser; session-derived only.
- Render refs/hashes, never raw PII; draft preview is CRM task/note content, not email.

## Blockers

- **Web auth/session → tenant** (depends on API-1's auth decision). _Smallest next step:_ scaffold the page against a mocked session; wire real auth after API-1. **Blocks V1 (Gate 1)** but parallelizable with CRM-1.

## V1 vs post-V1

V1. Dashboards/metrics polish and SSO login UI are pre-GA.

---

## API integration now available (post API-1)

The console talks to the session-authenticated API:

- **Auth:** send `Authorization: Bearer <session>`; the server derives tenant + role from it. `x-tenant-id` is ignored. No session → 401; viewer role → 403 on run/approve/execute.
- **Endpoints:** `POST /agent-runs/mira`, `GET /agent-actions?status=proposed` (rows include an embedded `draft` for CRM actions), `POST /agent-actions/:id/{approve,reject,execute}`. Execute on an unapproved action → **409**.
- **Client/view-model:** `apps/web/src/lib/apiClient.ts` + `approvalQueue.ts` already exist; the page is the missing piece.

## Reviewer checklist (apply the moment UI-1 lands)

Governance/scope:

- [ ] **No email affordances** anywhere (no composer, "send", inbox, reply UI). FENCE.
- [ ] Channel labels reflect CRM only (task/note); rows are `crm.*` action types.
- [ ] Tenant comes from the authenticated session, never a URL/query/header.

Flow correctness:

- [ ] Run Mira → review (evidence count + draft preview) → approve/reject → execute is drivable end-to-end.
- [ ] **Execute disabled until `approval_status === 'approved'`**; clicking a not-approved action never calls execute.
- [ ] A **409** from execute is surfaced clearly (not swallowed, not shown as success).
- [ ] A **403** (viewer) is shown as "insufficient permission", and viewers see no approve/execute controls.
- [ ] A **401** (expired session) routes to re-auth, not a blank/error page.

Safety/PII:

- [ ] Renders refs/hashes; no raw email/phone; draft preview is CRM task/note content.
- [ ] No secrets/tokens in client code or network logs.

Build hygiene:

- [ ] Adding `next/react` does not break root `typecheck`/`test`/`format` (web tsconfig scoped).
- [ ] View-model unit tests extended for CRM-only rows; (Playwright e2e optional, post-alpha).

If any fence/scope item fails → **flag immediately**, propose the minimal fix, and do not mark UI-1 done.
