# Security & Containment Model (design-only) — the most important fabric doc

A distributed fabric that can run code on many machines is dangerous if built
naively. This is the hard security spine. **Zero-trust by default.**

## Principles

1. **Zero-trust nodes** — no node is trusted by default; every node authenticates,
   attests, and is authorized per-task with least privilege.
2. **Least privilege** — a node receives only the scope needed for the specific
   work order; short-lived, scoped grants; no standing broad credentials.
3. **No arbitrary remote command execution** — the control plane never pushes
   shell to a node. Nodes pull declared work orders; sensitive actions require
   **local approval** (human or signed policy) on the node.
4. **Sandboxing** — each run executes in an isolated sandbox (container/VM), clean
   env + git state (the cmux isolation idea), no host access beyond the grant.
5. **Secrets isolation** — secrets never enter agent prompts, logs, receipts, or
   the registry. Provider keys stay in a secrets manager; nodes get scoped,
   short-lived tokens. No private keys (crypto or network) in agents.
6. **Proof-backed receipts** — every execution emits a signed receipt (node
   attestation) + evidence ref → Proof Registry; only `verified_fact` releases
   value/reputation.
7. **Policy engine** — pre-dispatch checks (data residency, cost ceiling, allowed
   models, allowed tools); **fail closed** on violation.
8. **Audit everywhere** — append-only events + audit records for every transition
   (existing pattern); tamper-evident.
9. **Kill switch / quarantine per node** — an operator can pause/quarantine a node
   instantly (analogous to the existing ENF-1 kill switch); a quarantined node
   takes no new work and its in-flight work is disputed/held.
10. **Signed attestations** — node + agent identity via ATC; the node attestation
    binds tailnet device identity ↔ ATC; re-attestation on a cadence.

## Network hygiene (Tailscale/WireGuard)

- Tagged ACLs, least-privilege per node role; ephemeral auth keys with rotation;
  explicit, revocable enrollment; no public ports; lost node ⇒ revoke + quarantine.

## Threat model (selected)

| Threat                           | Mitigation                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| Malicious/compromised node       | attestation + sandbox + least privilege + quarantine + reputation slash (via disputes) |
| Data exfiltration to cloud       | residency policy enforced pre-dispatch; fail closed                                    |
| Prompt-injection → unsafe action | sensitive actions are approval-required; no auto high-risk execution                   |
| Stolen network key               | rotation, tagged ACLs, revoke + quarantine                                             |
| Forged receipt                   | signed attestations; verifier confirmation before value moves                          |
| Replay / double-spend of work    | idempotency keys + append-only ledger (existing)                                       |

## Hard "never"s

No remote shell push; no standing root creds; no secrets in agents/logs; no
private keys in agents; no auto-execution of high-risk actions; no claim of
"unbreakable/unstoppable" security.

## Out of scope (now)

Design only. No implementation, no live nodes, no keys.
