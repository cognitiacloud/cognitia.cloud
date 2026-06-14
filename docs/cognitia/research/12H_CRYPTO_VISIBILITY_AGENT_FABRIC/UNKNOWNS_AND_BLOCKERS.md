# UNKNOWNS_AND_BLOCKERS — 12H Sprint

| ID | Item | Status | Severity | Notes |
| -- | ---- | ------ | -------- | ----- |
| U-1 | Target YouTube video content | BLOCKED | P2 | Egress 403; no transcript tool. Cannot fetch lawfully here. Reconciliation placeholder created for founder paste. |
| U-2 | Managed-Postgres RLS under restricted role | BLOCKED (founder-gated) | P1 | Needs a dev `DATABASE_URL`. Plan exists (V-6). Local engine bypasses RLS as superuser. |
| U-3 | Full-text of web sources | PARTIAL | P3 | WebSearch gives titles+URLs only; page bodies not fetchable. Lane claims from single snippets marked `likely_inference`. |
| U-4 | Real pilot traction / revenue evidence | UNKNOWN | P1 | No public evidence of paying tenants yet; scorecard reflects this honestly. |
| U-5 | Legal opinion (BC/Canada + US securities) on any future token | UNKNOWN (founder-gated) | P0 | Counsel engagement pack exists; no legal sign-off. Token remains gated. |
| U-6 | External security audit | UNKNOWN (founder-gated) | P1 | Planned, not done. Do not claim audited/SOC2. |
| U-7 | Distributed agent fabric — production feasibility at scale | DESIGN-ONLY | P2 | Thesis + architecture only; no prototype. Several open questions logged in fabric docs. |
| U-8 | Whether the founder wants a public team page now | DECISION NEEDED | P2 | Identity sign-off required (V-2). |

## Resume-critical blockers

- Anything requiring **production access, secrets, legal decisions, or public
  launch** is out of scope for autonomous work and is parked here for the founder.
