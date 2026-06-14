# Build vs Buy Analysis (design-only)

For each fabric component: build, buy/adopt, or defer. Bias toward **buy/adopt
proven infra** for plumbing and **build** only the Cognitia-differentiated layer.

| Component | Recommendation | Rationale |
| --------- | -------------- | --------- |
| Private network / mesh | **Buy/adopt** (Tailscale, or raw WireGuard) | Audited, mature; do not build a VPN. Keep transport pluggable. |
| Sandbox isolation | **Buy/adopt** (Docker/Firecracker/microVM) | Don't reinvent containment. |
| Node ↔ control transport | **Build thin** (outbound poll/subscribe) | Small, keeps zero-trust + no inbound. |
| Capability registry | **Build** | Cognitia-specific (SkillProof-backed). |
| Router | **Build** | Core differentiation (proof/policy/reputation-aware). |
| Execution receipts / proofs | **Reuse (existing)** | Proof Registry already built + tested. |
| Identity / attestation | **Reuse + extend** (ATC) | Add node attestation binding device↔ATC. |
| Settlement | **Reuse (existing)** | Credits/escrow/disputes already built. |
| Orchestration UX | **Buy/learn-from** (cmux/LangGraph/CrewAI patterns) | Adopt patterns; don't fork. |
| Local model serving | **Buy/adopt** (Ollama/llama.cpp/vLLM) | Don't build inference. |
| Cloud model access | **Buy/adopt** (provider APIs/MCP) | Standard integrations. |
| Secrets management | **Buy/adopt** (vault/cloud KMS) | Never hand-roll. |

## Net
Cognitia should **build** the capability registry + router + node-attestation +
receipt binding, **reuse** its existing economy, and **adopt** everything else
(mesh, sandbox, inference, secrets). This keeps surface area small and leans on
audited infrastructure for the dangerous parts.

## Dependencies / risks
- Tailscale lock-in → keep transport pluggable (raw WireGuard fallback).
- Sandbox escape risk → use hardened isolation (microVM) for untrusted nodes.
- Inference engine churn → abstract behind a model-router interface.

## Out of scope (now)
No procurement, no integration. Analysis only.
