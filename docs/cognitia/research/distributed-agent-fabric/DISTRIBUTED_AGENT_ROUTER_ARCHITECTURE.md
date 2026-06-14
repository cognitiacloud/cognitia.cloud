# Distributed Agent Router — Architecture (design-only)

## Components

1. **Control plane** (Cognitia API, existing) — issues work orders, records proofs,
   holds escrow, computes reputation. No inbound access to nodes required.
2. **Node agent** (new, design) — runs on each machine (Mac/Win/Linux/cloud);
   joins the private mesh; advertises capabilities; pulls assigned work; executes
   in an isolated sandbox; returns a signed execution receipt + evidence.
3. **Capability registry** (new) — what each node/agent can do (see
   `NODE_CAPABILITY_REGISTRY.md`); backed by SkillProof tiers.
4. **Router** (new) — matches a task to a node by capability, policy, cost,
   locality, reputation; never bypasses approvals.
5. **Proof + settlement** (existing) — Proof Registry receipts; escrow release on
   `verified_fact`; disputes on failure.

## Task lifecycle (maps to existing Work Orders)

```
proposed → routed → accepted(node) → in_progress → delivered(+receipt+evidence)
        → verified | rejected | disputed → resolved
```

- **proposed**: requester creates a work order (existing).
- **routed**: router selects candidate node(s) by capability + policy + reputation.
- **accepted**: node accepts via an Action-Ledger ask (ATC + permission gated,
  approval-required) — agents never get uncontrolled execution.
- **in_progress**: node executes in a sandbox; sensitive steps need local approval.
- **delivered**: node returns a **signed receipt** (node attestation) + evidence
  ref; control plane records a Proof (evidence-tagged).
- **verified**: a verifier confirms → escrow releases, reputation +; else reject/dispute.

## Data flow (trust boundaries)

- Node → control plane: signed receipt + evidence ref (not raw secrets/data).
- Control plane → node: work order + policy; never raw credentials for third
  parties beyond least-privilege, scoped, short-lived grants.
- All transitions emit append-only events + audit records (existing pattern).

## Routing inputs

capability match · SkillProof tier (≥ required) · node reputation · policy
(data residency, privacy, cost ceiling) · locality (data/tools on node) · model
availability (local vs cloud, see `LOCAL_VS_CLOUD_MODEL_ROUTING.md`).

## Explicitly out of scope (now)

No implementation; no remote command push; no cloud-execution code; no key
material in agents. Design artifact only.
