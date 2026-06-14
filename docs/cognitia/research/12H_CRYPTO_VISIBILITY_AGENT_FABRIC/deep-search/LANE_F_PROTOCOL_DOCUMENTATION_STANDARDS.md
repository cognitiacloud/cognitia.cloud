# LANE F — Protocol Documentation Standards

**Objective**: What documentation a credible protocol publishes.

**Sources**: protocol-docs norms (whitepaper, architecture, API, security, risk,
governance); LANE C/K sources; general practice.

## Expected doc set + Cognitia status

| Doc                          | Purpose                      | Cognitia                                                          |
| ---------------------------- | ---------------------------- | ----------------------------------------------------------------- |
| Architecture overview        | How it works                 | `verified_fact` — ARCHITECTURE_LOCK_V1_1 + many design docs       |
| Public diligence overview    | Researcher entry             | `verified_fact` — PUBLIC_DILIGENCE_OVERVIEW                       |
| Evidence/manifest spec       | Exact public data contract   | `verified_fact` — PUBLIC_EVIDENCE_MANIFEST_SPEC (V-5)             |
| API / SDK reference          | Integrate                    | `GAP` — no published API/SDK reference                            |
| Security doc                 | Threat model, secrets policy | `partial` — RLS plan, feed hardening; no consolidated security.md |
| Risk / "what we don't claim" | Honesty                      | `verified_fact` — TOKEN_GATES + /trust "does not claim"           |
| Governance                   | Who decides                  | `GAP` — implicit (owner-gated), not documented publicly           |
| Roadmap                      | Direction                    | `partial` — internal queues; no public roadmap page               |

## Findings

- `verified_fact` — Cognitia over-indexes on honest, internal-quality docs; the
  gaps are _outward-facing_ (API/SDK ref, consolidated security page, public
  roadmap, governance).

## Recommended actions

- Author a consolidated public `SECURITY.md`-style page (threat model + secrets
  policy + responsible disclosure intake) — design in LOOP 4/8.
- Publish an API surface summary (read endpoints + the public feed contract).
- Publish a public roadmap derived from the internal queue (safe subset).

## Public-safe wording

"Cognitia publishes its architecture, evidence contract, token gates, and an
explicit 'what we do not claim' page; API/SDK and security pages are in progress."

## Unsafe claims to avoid

Do not publish a "whitepaper" implying a token offering; keep it a _protocol/
architecture_ paper, token-gated.
