# GTM Command Center — visible, integrated, real-module route

Route: `apps/web/src/app/gtm-command-center/page.tsx` (`/gtm-command-center`)
Adapter: `apps/web/src/lib/server/gtmCommandCenterData.ts` (SERVER-ONLY)
View-model: `apps/web/src/lib/gtmCommandCenterViewModel.ts` (types + scorecards)
Base: `overnight/gtm-implementation` · PR #158 — consolidates PR #159 + PR #160.

## What it is

One investor-facing screen that proves the **B1–B6 mock GTM system** works
end-to-end, rendered entirely from the **real `@cognitia/agents` modules** (never
a structural mirror). It folds every lane onto a single operator view for the
`budget_wheels_demo` / Tenant Zero sandbox:

```
audience/signal (B4) → assembly island: compliance → approval (B1) →
dry-run channel engine (B2) → CRM-lite timeline (B3) → TrustOps analytics (B5) →
enterprise release gates (B6) → proof/workspace attribution (B1) →
integrated run packet (#159) → no-live-egress attestation → dual Alta scorecard
```

## Architecture — real modules through a server-only adapter

`apps/web` depends on `@cognitia/agents` (`workspace:*`). The route is an **async
server component** that awaits `loadCommandCenterData()`. That adapter is the
real integration — it calls the actual lane functions and the integration packet:

| Panel                     | Lane  | Real call                                                                    |
| ------------------------- | ----- | ---------------------------------------------------------------------------- |
| Audience & signal builder | B4    | `buildAudience(...)` (scraped/apify sources rejected)                        |
| Assembly + channels       | B1+B2 | `assembleGtmRunPacket(...)` ×3, `evaluateChannelPolicy` + `planDryRunAction` |
| CRM-lite & timeline       | B3    | `projectCrmLite(...)` + a `createMockCrmLite` idempotency probe              |
| TrustOps analytics        | B5    | `buildTrustOpsReport(...)` (metrics + 4-part trust score + md)               |
| Release gates             | B6    | `evaluateReleaseGate(...)` (all three stages; live fails closed)             |
| Proof / attribution       | B1    | `packet.proofs`, workspace-attributed                                        |
| Integrated run packet     | #159  | `assembleIntegratedRunPacket(...)` + `verifyIntegratedRunPacket(...)` → 8/8  |

No client component imports `@cognitia/agents`. The view-model holds only the
persistent banner, the assembled-view **types** (`import type` only), a shared
PII guard, and the two pure scorecards — **no lane logic is reproduced**.

## Two scores, never conflated

The headline scorecard and the official-parity scorecard are deliberately
separate (see `computeCapabilitySurfaceScore` and `computeImplementationParity`):

- **Mock/dry-run capability-surface score: 100/100** (threshold 80). Every check
  is an objective structural assertion over real module output; the sum of
  earned weights equals the headline. This is _breadth of mock surface
  implemented_ — **not** a live-automation readiness claim.
- **Official Alta implementation parity: 78/100** (threshold 80, **not met**).
  Ten weighted axes summing to 100; six credited (real-module integration,
  integrated packet, visible route, dry-run safety, lane breadth, build
  provability) and four at zero (persistence, route-bound enforcement, reachable
  deployment, live readiness). The page lists the **exact blockers** to a
  confident 80+: persistence (+8) and route-bound enforcement (+6).

## Safety (mock / dry-run only)

`MOCK ONLY · DRY-RUN ONLY · NO LIVE SEND · NO REAL CRM · NO PII` is shown
persistently. Every channel action is typed `sent:false`; `sendLive()` always
throws (proven by a fail-closed tripwire inside the integrated packet);
`controlled_live` fails closed until 7 organizational/legal sign-offs land; CRM
is in-memory; a defensive `assertNoRawPii` runs over the serialized output. There
are no send/call/SMS/WhatsApp/ad controls anywhere on the page.

## Verification

- `pnpm check` — **813 tests (108 files)** green (format + typecheck + test).
- `pnpm --filter @cognitia/web run build` — `next build` compiles;
  `/gtm-command-center` prerenders as static content.
- Adapter test proves real-module provenance (action shape equals a direct
  `planDryRunAction`; audience rejection equals a direct `buildAudience`;
  integrated packet verifies complete; gates fail closed; CRM idempotent; trust
  funnel over 3 real runs; no raw PII).
- Smoke test renders the async server component to HTML via `react-dom/server`.

See `docs/cognitia/audits/alta-80-readiness-evidence.md` for the official score
and `docs/sales-closer/integration-hardening.md` for the integrated packet.
