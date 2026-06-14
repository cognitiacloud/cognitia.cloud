# Tailscale / WireGuard Agent Fabric (design)

**Status**: design-only. **Sources**: tailscale.com; blog.arcbjorn.com (K3s over
Tailscale); railway n8n+Tailscale stack; WireGuard general knowledge.

## Why a private mesh
A distributed agent fabric needs secure, identity-based connectivity between
user-owned machines (Mac/Win/Linux) and cloud nodes across NATs/firewalls without
exposing public ports. **WireGuard** is a modern, audited VPN protocol;
**Tailscale** is a mesh overlay on top of it (identity-based ACLs, NAT traversal,
key rotation, device posture).

## Role in Cognitia's fabric (and its limits)
- Tailscale/WireGuard provides: encrypted node-to-node transport, device identity,
  network ACLs, no public exposure. `verified_fact` (protocol-level).
- It does NOT provide: agent identity, capability proof, execution receipts,
  reputation, settlement, or task policy. Those are **Cognitia's** layers.
- Design principle: **the mesh is the transport; Cognitia is the trust + economy.**

## Reference topology (design)
- Each participating machine runs a **Cognitia node agent** joined to a private
  tailnet (user-owned). The node advertises capabilities to the registry.
- A **control plane** (Cognitia API) issues work orders and records proofs; it
  does NOT need inbound access to nodes — nodes poll/subscribe outbound.
- Sensitive actions require **local approval** on the node (human or policy), not
  remote command push.

## Key hygiene (hard requirements)
- No long-lived root auth keys embedded in agents; use ephemeral/auth-key rotation
  and tagged ACLs (least privilege per node role).
- No private keys (crypto or network) stored inside agent prompts or logs.
- Node enrollment is explicit and revocable; lost node ⇒ key revoke + quarantine.

## Open questions
- Tailscale dependency vs raw WireGuard vs pluggable transport (BUILD_VS_BUY).
- Identity binding: tailnet device identity ↔ Cognitia ATC (attestation design).
- Offline/again-online reconciliation of proofs.

## Public-safe wording
"Cognitia's fabric can run over a user-owned private network (Tailscale/WireGuard).
The network secures transport; Cognitia secures identity, work, and proof."

## Unsafe claims to avoid
No "uncensorable/unstoppable network"; no "evades restrictions"; the mesh is a
standard private VPN, operated lawfully by the user.
