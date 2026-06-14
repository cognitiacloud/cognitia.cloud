# Researcher Review Order

A suggested path through Cognitia's evidence trail, ordered so each step builds on
the last. Everything here is public-safe and (where claimed) reproducible.

1. **`/trust`** — the static Trust / Proof Explorer: what is built, runtime-
   verified, design-only, blocked; token gates; "what we do not claim."
2. **`PUBLIC_DILIGENCE_OVERVIEW.md`** — the public-safe overview of the platform
   and its verifiable primitives.
3. **`VERIFY_IT_YOURSELF.md`** — clone the repo and reproduce the 490-test green
   state + the live economy smoke. (This is the load-bearing step: confirm the
   claims yourself.)
4. **Runtime verification status** —
   `docs/cognitia/execution/MAINLINE_RUNTIME_VERIFICATION_STATUS.md` and the
   economy smoke report.
5. **Smoke test file** — `apps/api/src/economySmoke.live.test.ts` (read what the
   loop actually asserts against a real Postgres engine).
6. **`TOKEN_STATUS_AND_GATES.md`** — token status (none) and the gates.
7. **Crypto-visibility research** — `docs/cognitia/research/` (CRYPTO_VISIBILITY_001
   and the 12H sprint synthesis) for the diligence framing.
8. **`PUBLIC_EVIDENCE_MANIFEST_SPEC.md`** — the exact public-feed data contract.
9. **`SECURITY.md`** (repo root) — disclosure posture, scope, secrets policy,
   production caveats.
10. **Roadmap / blockers** —
    `docs/cognitia/research/12H_CRYPTO_VISIBILITY_AGENT_FABRIC/DILIGENCE_SURFACE_ROADMAP.md`
    and `UNKNOWNS_AND_BLOCKERS.md`.
11. **`STANDARDS_ALIGNMENT.md`** — how the primitives map to MCP / A2A / W3C VC /
    EAS / ERC-8004 / x402 (compatible-by-design vs built vs research target).

## Fastest honest read (15 minutes)

`/trust` → `VERIFY_IT_YOURSELF.md` (run `pnpm check`) → `CLAIMS_WE_DO_NOT_MAKE.md`
→ `TOKEN_STATUS_AND_GATES.md`. That sequence shows what is real, lets you confirm
it, and shows exactly what Cognitia refuses to claim.
