# Route Access & Readiness Note

> STATUS: MOCK / SANDBOX. This note documents the **intended** access posture of
> the demo web routes and is explicit about what does **not** exist yet. There is
> **no production RBAC**, no auth provider, no session, and no server-side
> enforcement of the permission model on any route. The permission/release
> primitives in `packages/agents/src/security/` are pure decision functions used
> in tests and demos; they are **not wired** into route middleware. Do not read
> this as a production-readiness claim.

## What exists today (honest)

- The integrated GTM operator demo route (`/gtm-os-integrated-demo`) is a
  **server component** that runs the real `@cognitia/agents` modules through a
  server-only adapter and renders read-only output. It performs **no** live
  egress and writes **no** real data.
- All data flowing through the routes is sandbox / Tenant Zero
  (`budget_wheels_demo`) synthetic content only.
- The local permission model (`can`/`assertCan`) and the composed
  `decideRelease(...)` exist as **library** functions with tests. They are the
  building blocks an enforcement layer would call.

## What does NOT exist (must not be claimed)

- **No authentication.** No login, no identity provider, no session cookie.
- **No production RBAC.** No route checks a caller's role before rendering.
- **No server-side authorization middleware** binding `can(role, permission)` to
  an HTTP request.
- **No live connector route.** Configuring or triggering a live connector from a
  route is **not implemented** and is gated by `decideRelease` failing closed.

## Intended access mapping (PLANNED — not enforced)

When an enforcement layer is built, routes should map to the least permission
that the local model already defines. This table is a **design target**, not a
description of running behaviour:

| Route (planned)                   | Required permission (planned)                        | Stage             |
| --------------------------------- | ---------------------------------------------------- | ----------------- |
| View leads / run packets          | `view_lead`                                          | `dry_run`         |
| View proof trace / audit timeline | `view_proof`                                         | `dry_run`         |
| Reject a proposed action          | `reject_action`                                      | `dry_run`         |
| Approve a proposed action         | `approve_action`                                     | `dry_run`         |
| Configure a live connector        | `configure_live_connector` + `decideRelease` allowed | `controlled_live` |

Even with `configure_live_connector`, the live connector path stays blocked
until `decideRelease(...)` returns `allowed` — which requires all seven release
conditions plus the sandbox workspace (see `live-release-gates.md`).

## Readiness statement

Route access is **demo-grade**: server-rendered, read-only, sandbox-only, no
egress. Production readiness requires, at minimum: an identity provider, session
management, server-side authorization middleware calling the permission model,
per-tenant data isolation backed by row-level security (not just the in-memory
`workspaceIsolation` guards), and the live-release sign-offs enumerated in
`live-release-gates.md`. None of these exist yet; none are claimed here.
