# Agent Fabric — MVP Roadmap (design-only; nothing built this sprint)

Staged so each step produces verifiable evidence and never ships unsafe capability.
All stages are **founder-gated** before any code; this is the proposed sequence.

## Stage 0 — Design lock (this sprint)

- Thesis, router architecture, capability registry, security model, economy
  integration, build-vs-buy, risks (these docs). **Done.**
- Acceptance: a security reviewer signs off on the containment model on paper.

## Stage 1 — Single-node local proof (no network)

- A local "node agent" runs a work order in a local sandbox and returns a signed
  receipt → recorded as a Proof; escrow releases on `verified_fact` (all existing).
- No mesh, no remote, no cloud exec. Pure local loop.
- Acceptance: reproduces the existing economy loop with an out-of-process executor +
  node attestation; tests on memory + PGlite.

## Stage 2 — Capability registry + router (still local/simulated nodes)

- Register capabilities (SkillProof-backed); router matches a task to a simulated
  node by capability/policy/reputation; fail-closed on policy violation.
- Acceptance: routing decisions are deterministic + tested; no policy bypass.

## Stage 3 — Two machines over a private mesh (opt-in, user-owned)

- Two user-owned machines on a tailnet; outbound-only node→control; local approval
  for sensitive actions; quarantine/kill switch works.
- Acceptance: a task routed to the _other_ machine produces a verifiable receipt;
  revoking the node quarantines it instantly.

## Stage 4 — Local + cloud model routing

- Router chooses local vs cloud model under policy; residency fail-closed enforced.
- Acceptance: a "local-only" task never leaves the node; a "cloud-allowed" task can.

## Stage 5 — Cross-tenant (gated, doc-first)

- Reuse the cross-tenant settlement design; assurance-bond _simulation_ (credits,
  no token). Legal gate before any real cross-tenant value.
- Acceptance: simulated bond/slash works; no real payments; legal sign-off pending.

## Guardrails across all stages

Zero-trust, least privilege, sandboxed, approval-gated, audited, proof-backed,
kill-switchable. No remote shell push. No secrets/keys in agents. No mainnet, no
real payments, no token. Each stage is independently founder-authorized.
