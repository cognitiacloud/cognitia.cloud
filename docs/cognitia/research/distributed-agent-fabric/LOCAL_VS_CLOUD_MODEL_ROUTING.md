# Local vs Cloud Model Routing (design-only)

## Goal

Route each task to the most appropriate model/compute: local LLM (privacy, cost,
offline, data-residency), cloud LLM (capability, scale), or an external agent/tool
(Claude/Codex/MCP servers/specialized systems) — under explicit policy.

## Routing dimensions

| Dimension                    | Prefer local                  | Prefer cloud/external     |
| ---------------------------- | ----------------------------- | ------------------------- |
| Data sensitivity / residency | sensitive, must stay on node  | non-sensitive             |
| Capability required          | within local model's ability  | needs frontier capability |
| Cost ceiling                 | low credit budget             | budget allows             |
| Latency / offline            | offline or low-latency needed | online OK                 |
| Availability                 | local model present           | local absent              |
| Policy                       | "local-only" tenant policy    | "cloud-allowed"           |

## Decision flow (design)

1. Read task policy (residency, cost, privacy) from the work order.
2. Filter nodes by capability + SkillProof tier + policy compliance.
3. Among eligible, pick by reputation, locality, cost, availability.
4. If only cloud/external satisfies capability AND policy forbids → **fail closed**
   with a clear reason (do not silently exfiltrate sensitive data to cloud).

## Privacy/containment ties

- "local-only" data must never be sent to a cloud model; the router enforces this
  before dispatch (see `SECURITY_AND_CONTAINMENT_MODEL.md`).
- External model calls are themselves recorded as evidence (which provider, when,
  scope) for the execution receipt — no raw sensitive payloads in logs.

## Cost/settlement tie

Routing cost is denominated in **internal credits** (today); escrow holds the
budget; release on `verified_fact`. No real payment in scope.

## Open questions

- Quality/eval signal to compare local vs cloud outputs fairly.
- Fallback policy when the preferred route fails mid-task (re-route vs dispute).
- Caching/memoization of results across nodes (privacy implications).

## Out of scope (now)

No model integrations, no provider keys, no implementation. Design only.
