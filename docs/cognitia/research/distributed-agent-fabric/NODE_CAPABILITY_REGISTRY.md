# Node Capability Registry (design-only)

## Purpose
A machine-readable description of what each node/agent can do, so the router can
match tasks safely. Backed by Cognitia **SkillProof** (capability requires
evidence; higher tiers require a `verified_fact` proof).

## Capability descriptor (design shape)
```jsonc
{
  "node_id": "<opaque>",          // bound to an ATC (identity), not the tailnet key
  "platform": "macos|windows|linux|cloud",
  "skills": [
    { "skill": "code.test.run", "proof_tier": 2, "proof_id": "<verified_fact>" },
    { "skill": "llm.local.infer", "model": "<local-model-id>", "proof_tier": 1 }
  ],
  "resources": { "gpu": false, "ram_gb": 32, "tools": ["docker","vscode"] },
  "policy": { "data_residency": "local-only", "max_cost_credits": 100 },
  "attestation": "<signed node attestation>",   // see security model
  "reputation_ref": "aggregate-only"            // counts, never per-node PII
}
```

## Rules
- A node may only advertise a skill at a tier it can **prove** (SkillProof + 0013
  tier gate: tier ≥ 2 requires a `verified_fact` proof). No self-asserted high tiers.
- Capability claims are themselves evidence-tagged; unproven claims are `unknown`
  and confer no routing priority.
- Yanked skill versions take no new work (existing 0018 guard analog).
- The registry stores **capabilities + attestations**, never secrets, raw data, or
  private keys.

## Discovery
Exposed through the internal **marketplace** (authed `/agent-economy/` only;
internal-visibility check-locked). No public marketplace transaction surface.

## Reputation linkage
Routing weight uses **aggregate** node reputation (counts), consistent with the
public-feed discipline — never per-node scores in any public surface.

## Open questions
- Capability vocabulary/ontology (controlled list vs free-form + proofs).
- Attestation freshness / re-attestation cadence.
- Capability revocation propagation latency across the mesh.

## Out of scope (now)
No implementation; design shape only.
