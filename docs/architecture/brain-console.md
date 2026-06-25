# Operator Brain Panel (`/brain-console`)

A visible, mock-safe operator view of the **#206 brain harness**: the selected
task, the selected provider/model, every registered provider's enabled/disabled
state, the policy decision, fallback routing, the ledger hash / proofRef, the set
of disabled real providers, and local-only readiness.

- Page (async server component): `apps/web/src/app/brain-console/page.tsx`
- Server-only adapter: `apps/web/src/lib/server/brainConsoleData.ts`
- Pure view-model: `apps/web/src/lib/brainConsoleViewModel.ts`

## Real #206 data, not a mock mirror

The panel renders **real** harness output. The server-only adapter
(`loadBrainHarnessSnapshot`) imports `@cognitia/agents` and:

1. calls `listModels()` to list every registered provider/model with its real
   `enabled` state and `location` (`local` → `local`, `external` → `remote`);
2. routes one deterministic demo task (`prospect.research`) through the governed
   `runTask` / `ModelRouter`, capturing the real selected provider, policy
   decision, fallback flag, and the receipt's input hash;
3. maps the result onto the pure `BrainHarnessSnapshot` the view-model renders.

This follows the established `gtm-os-integrated-demo` pattern: a server-only
adapter runs real `@cognitia/agents` code, and **no client component imports
`@cognitia/agents`**. The view-model is a pure transform with no agents import,
so no provider/SDK can be bundled to the client through it.

## Mock-safe by construction

The panel asserts a single invariant on every render — `mockSafe` is true only
when the snapshot is mock-mode AND no real model call occurred AND **every**
remote provider is disabled:

- the only executable model is the deterministic mock (`mock-deterministic-1`);
- all external providers (openai / anthropic / deepseek / xai / openrouter) are
  disabled and listed as such;
- the ledger surfaces `sha256:<inputHash>` only — never the raw prompt/output;
- there are **no send / live-action controls** on the panel (read-only);
- the persistent banner `MOCK ONLY / NO REAL MODEL CALLS / NO LIVE OUTREACH / NO
RAW PII` is shown on every render, never conditional.

## Honesty

If the registry were ever tampered to enable a remote provider, or a real model
call were recorded, `mockSafe` flips to NO and the banner/section turn red — the
panel is designed to _prove_ the posture, not assert it unconditionally. The
unit tests pin both the safe and the tampered (not-safe) cases.
