# 65-3 — Local to Controlled-Live Approval Gap

Current local v2 receipt binding:

- deterministic hash binds tenant id, lead id, approval receipt hash, version, and local mode;
- rejects arbitrary `proof-*` strings;
- no keys, no secrets, no signatures, no auth provider.

Gap to controlled-live:

- real reviewer identity;
- key custody or auth-backed signing;
- revocation;
- nonce/replay prevention;
- audit ledger persistence;
- operator authorization;
- legal/data handling.

This document is design-only. No keys, secrets, auth provider, or live systems are introduced.
