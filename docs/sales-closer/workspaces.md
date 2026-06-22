# Sales Closer — demo workspaces

A minimal tenant/workspace tag for the **offline Sales Closer mock runner**. It
lets every mock run / approval / CRM-writeback / proof be attributed to a demo
workspace without introducing any new infrastructure.

This is intentionally **not** production multi-tenancy. There is no RBAC, no
auth, no provisioning, no database, and no real customer data here. The heavier
RLS-isolated tenant model is documented separately in
[`docs/cognitia/TENANT_MAP.md`](../cognitia/TENANT_MAP.md); this layer neither
replaces it nor claims parity with it.

Source of truth: `packages/agents/src/closer/workspaces.ts`.

## Workspaces

| `WorkspaceId`        | Label                | Kind       | Synthetic | Consent                         |
| -------------------- | -------------------- | ---------- | --------- | ------------------------------- |
| `demandara_internal` | Demandara (internal) | `internal` | no        | `internal_team`                 |
| `cognitia_internal`  | Cognitia (internal)  | `internal` | no        | `internal_team`                 |
| `budget_wheels_demo` | Tenant Zero sandbox  | `sandbox`  | **yes**   | `synthetic_no_consent_required` |

`cognitia_internal` is the `DEFAULT_WORKSPACE_ID` used when a run does not name a
workspace.

### Budget Wheels wording

`budget_wheels_demo` is the **Tenant Zero sandbox**: synthetic demo data only.
Do **not** present it as a real customer or call it "Client Zero" or imply real
consent until the founder confirms it. The registry encodes this with
`synthetic: true`, `kind: 'sandbox'`, and `consent: 'synthetic_no_consent_required'`.

## What carries `workspace_id`

The runner (`packages/agents/src/closer/salesCloserWorkflow.ts`) threads the
workspace through every artifact of a run:

- **Run** — `WorkflowRun.workspaceId` (always set; `WorkspaceId`).
- **Approval** — `ApprovalRequest.workspaceId` sent to the approval boundary.
- **CRM mock writeback** — `CrmWritebackRequest.workspaceId` sent to the CRM boundary.
- **Proof receipt** — `workspace_id` inside the proof event's existing
  `detailsPrivate` bag.

Note the naming convention: TypeScript public interfaces use `workspaceId`
(camelCase); proof `detailsPrivate` uses `workspace_id` (snake_case) for
receipt/report compatibility. The proof event type itself
(`@cognitia/core` `GtmProofEvent`) is **not** modified — `workspace_id` rides in
its open `detailsPrivate` record, so this stays within the closer lane.

## Non-goals

- No RBAC, auth, or membership model.
- No DB migrations or live tenant provisioning.
- No real customer data or PII (the registry is business-only metadata).
- No claim of production multi-tenant isolation.
