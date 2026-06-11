# Lane A — Blockers

> Framing (Architecture Lock A1): MoverOS is **Tenant Zero** — the first
> vertical proof environment for the Cognitia GTM Control Plane, the first
> production application of Cognitia Core. Moving is the proving ground
> (measurable lead + booking outcomes), not the company focus.

Date: 2026-06-11. Owner of every item below: founder (none are code).

## Blocking the dev-DB tier (not the pilot itself)

| #   | Blocker                                                                                                                                                                                                                    | Resolution                                                                                                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | ~~No safe Cognitia dev DB active~~ **PARTIALLY RESOLVED** — migrations 0001–0014 applied + full live verification (RLS-under-role, smoke, dashboard) on a session-local Postgres 16; remaining need is a PERSISTENT dev DB | Unpause `Cognitia Preview` in Supabase (or approve an MCP restore, or create `cognitia-dev`); `moveros-staging` is ruled out — schema collision, separate app (LANE_A_DEV_DB_VERIFICATION.md) |
| 2   | ~~RLS-under-role unverified~~ **RESOLVED** — enforced live under `cognitia_app` (NOBYPASSRLS): exact tenant isolation, default-deny without tenant context                                                                 | —                                                                                                                                                                                             |
| 3   | Default branch flip                                                                                                                                                                                                        | `main` is verified default-READY at the merged tip; the flip is a repo-settings admin click (outside session tooling)                                                                         |

## Blocking LIVE SMS mode only (simulation + human send needs none of these)

| #   | Blocker                  | Resolution                                                                                                             |
| --- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| 4   | CASL consent wording     | Counsel review before any automated customer message                                                                   |
| 5   | No SMS provider          | Twilio SANDBOX first, wired behind the existing owner-gated `sms.send_real` + approval flow; real traffic only after 4 |
| 6   | Lead-detail console page | Build (API exists) — operator ergonomics for higher volume                                                             |

## Business unknowns (`unknown` — not engineering)

Warm-network mover commitment; real lead volume; $997/mo price acceptance.
Kill gates remain armed: no tester by Week 4 → simplify the offer; no paying
pilot by Week 8 → Lane C token work stays frozen.

## Explicitly NOT blockers

The trust layer itself (merged, 400/400 green, live-smoked twice on the
merged content including the `main` tip); PII handling; doctrine guards;
the demo (`docs/cognitia/demo/DEMO_SCRIPT_V1.md` runs entirely in-memory).
