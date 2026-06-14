# Agent Fabric — Risks & False Claims to Avoid

## Top risks (severity)
| ID | Risk | Sev | Mitigation |
| -- | ---- | --- | ---------- |
| R-1 | Remote code execution abused (compromised/malicious node) | P0 | zero-trust, sandbox, least privilege, approval-gated, quarantine, dispute-slash |
| R-2 | Data exfiltration to cloud against policy | P0 | residency policy enforced pre-dispatch; fail closed |
| R-3 | Secrets/keys leaking into agents/logs/receipts | P0 | secrets manager; scoped short-lived tokens; never in prompts/logs |
| R-4 | Prompt-injection → unsafe high-risk action | P1 | high-risk actions approval-required; verify/dispute stay human |
| R-5 | Forged execution receipts | P1 | signed node attestations; verifier confirmation before value moves |
| R-6 | Network key compromise | P1 | rotation, tagged ACLs, revoke+quarantine |
| R-7 | Over-claiming decentralization/resilience | P1 | strict language rules (below) |
| R-8 | Legal exposure (cross-tenant value, payments) | P0 | keep credits-only; legal gate before real settlement |
| R-9 | Sandbox escape | P1 | hardened isolation (microVM) for untrusted nodes |
| R-10 | Scope creep into production before design sign-off | P2 | staged, founder-gated MVP roadmap |

## False claims to NEVER make (hard)
- "Decentralized and impossible to shut down" / "uncensorable" / "unstoppable
  infrastructure" — **never as fact.**
- "Evades government / sanctions / export controls" / "operate where banned" /
  "bypass restrictions" / "unregulated AI."
- "Guaranteed decentralization" / "no single point of failure" (until proven).
- "Production-ready" / "secure" / "audited" fabric (nothing is built).
- Any token/price/yield/return framing tied to the fabric.

## Safe framing (use instead)
- "Resilient agent fabric," "user-owned compute," "portable agent work,"
  "verifiable agent execution," "private-network optional," "local/cloud routing,"
  "sovereignty-oriented architecture (continuity, not evasion)."

## Status
Design-only. Nothing in this folder is implemented. Every stage requires explicit
founder authorization and a security review before any code.
