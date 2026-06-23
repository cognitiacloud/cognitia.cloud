# Operator Brain Panel (`/brain-console`)

A visible, **mock-safe** operator panel that surfaces the agent brain's
"harness" state: which task and provider/model the brain selected, which
providers are enabled vs disabled, the policy decision, fallback routing, the
ledger proof, the set of disabled real providers, and local-only readiness.

## Why this exists

The brain harness is the decision layer that, in a future controlled-live
build, would route a task to a model provider and emit a ledgered decision. In
**V1 there is no live harness**: every real provider is disabled by
construction and the system runs local-only. This panel exists to **prove that
safety posture to an operator**, not to drive a model.

Persistent banner, shown on every render:

```
MOCK ONLY / NO REAL MODEL CALLS / NO LIVE OUTREACH / NO RAW PII
```

## What the panel shows

| Field                           | Source                                               |
| ------------------------------- | ---------------------------------------------------- |
| Selected task                   | `snapshot.task` (label + objective)                  |
| Selected provider / model       | `snapshot.selectedProvider`                          |
| Provider enabled/disabled state | `snapshot.providers[].enabled`                       |
| Policy decision                 | `snapshot.policy` (allow / requires_approval / deny) |
| Fallback used                   | `snapshot.fallback`                                  |
| Ledger hash / proofRef          | `snapshot.ledger` (hashes only)                      |
| Disabled real providers         | derived: `kind === 'remote' && !enabled`             |
| Local-only readiness            | `snapshot.localOnly`                                 |
| Mock-safe invariant             | derived (see below)                                  |

## Architecture: pure view-model, no agents import

```
demoBrainHarnessSnapshot()        (pure, deterministic, PII-safe)
        │
        ▼
toBrainConsoleView(snapshot)      lib/brainConsoleViewModel.ts  (pure transform)
        │
        ▼
BrainConsolePage()                app/brain-console/page.tsx    (server component, render only)
```

The view-model is **decoupled from `@cognitia/agents`** — the harness snapshot
shape is declared structurally in `brainConsoleViewModel.ts`, the same pattern
used by `gtmOsAssemblyViewModel.ts`. This is a deliberate honesty choice:

- **The web app does not import the runtime brain.** There is no live harness to
  import in V1, and importing agent/provider code into a client bundle would
  risk pulling a vendor SDK or key read into the browser. A structural snapshot
  keeps the dependency surface to the view-model's own types only.
- If a real harness is later wired, it should run **server-only** (an async
  server component plus a `lib/server/*` adapter, as
  `/gtm-os-integrated-demo` does) and hand the page a `BrainHarnessSnapshot`.
  The page and view-model do not change.

### Safety properties enforced in code

- **No client-side real provider imports.** `page.tsx` imports only the pure
  view-model. No `fetch`, no network, no vendor SDK, no API key read.
- **No send / live buttons.** The panel is read-only — there are no action
  controls of any kind.
- **No real model API wiring.** The selected provider is a local deterministic
  stub; every remote provider is `enabled: false`.
- **No raw PII.** Prompts/outputs are referenced by **hash** only
  (`ledger.hash`, `proofRef`). The view-model test asserts the rendered view
  contains no `@` (no email / raw PII).

### The `mockSafe` invariant

`toBrainConsoleView` computes a single invariant the panel asserts on every
render:

```
mockSafe = mode === 'mock'
        && noRealModelCalls.occurred === false
        && every remote provider is disabled
```

If any real provider were left enabled, or any real model call were recorded,
`mockSafe` flips to `false` and the panel renders a red failure state. Tests in
`brainConsoleViewModel.test.ts` cover both tamper cases.

## Tests

- `apps/web/src/lib/brainConsoleViewModel.test.ts` — unit tests for the pure
  transform: banner content, provider enabled/disabled mapping, disabled real
  providers, policy tones, fallback labels, ledger/proof passthrough,
  local-only readiness, the `mockSafe` invariant (including tamper cases), and
  the no-raw-PII guarantee.

No route smoke test is included: the repo's vitest config targets `*.test.ts`
in a `node` environment (no jsdom), and the page is a thin server component over
the fully-tested view-model.

## Run

```
pnpm check
```

(`format:check` + `typecheck` + `test`.)
