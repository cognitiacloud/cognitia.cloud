# Mission Pack B — Handoff (COG-005 SkillProof Core 20 + COG-006 AI Front Desk)

Date: 2026-06-11. Evidence tags: `verified_fact` unless noted.

## Branch / dependency state

- Branch: `claude/cog-005-006-skillproof-ai-front-desk`, from
  `claude/cog-004-atc` @ `ee2f88f` (Case B — #34 unmerged but CI-green).
- PR stack: **#32 → #33 → #34 → this branch**. Merge in order; each PR diffs
  only its own work.
- Default branch remains near-empty; base-branch promotion is still the open
  founder decision (Discovery U1).

## What was built

### COG-005 — SkillProof Core 20

- `packages/db/migrations/0013_skillproof_frontdesk_ext.sql` (also COG-006):
  skills provenance (namespace/source_path/owner_agent_id), version
  certification state (manifest_hash, content_hash, metadata, numeric
  proof_tier 0–4 + trigger: tier ≥ 2 needs a verified_fact proof, yank).
- `apps/api/src/skillproof.ts` — importCoreSkills / createSkillProof /
  validateProofTierUpgrade / yankSkillVersion. Honest import: 1 skill from the
  real in-repo `hermes/skills/vision-skill` (hashed file-by-file, tier 1,
  verified_fact), 19 seeds at tier 0 tagged likely_inference —
  `/home/smrai/.hermes/skills` is not accessible here (documented blocker).
  Tiers 3–4 are enum-only: nothing in v1.1 can assign them.
- Routes (platform convention, not `/api/cognitia/*` — mapping documented in
  the Command Book addendum): `GET /skills`, `POST /skills/import-core`,
  `GET /skills/:id`, `GET /skills/:id/versions`,
  `POST /skill-versions/:id/proofs`, `POST /skill-versions/:id/tier`,
  `POST /skill-versions/:id/yank`.
- UI: `/skills` — "Internal Skill Registry (Core 20)"; no marketplace, no
  prices, no public listings (tested).

### COG-006 — MoverOS AI Front Desk + Lead Rescue

- Lead lifecycle: `lead_intakes.status` (10 states) wired through intake
  (`needs_response`), drafting (`human_review_required`), simulated send
  (`contacted_simulated`), outcomes (`booked`/`lost`/…), purge (`purged`).
- PII: AES-256-GCM encrypted columns (key: `COGNITIA_PII_KEY_BASE64`,
  ephemeral dev fallback with warn), sha256 phone hash, masked list views,
  operator-only decrypted detail, PIPEDA purge with check-constraint
  enforcement.
- Actions: `POST /leads/:id/actions` with 9 kinds; `propose_sms_reply` runs
  the full draft → EXISTING approval ledger → simulated-send pipeline; risky
  kinds approval-gated; every proposal emits a verified_fact proof (the
  proposal is the evidence) + audit + status transition; all simulation=true.
- Real SMS is structurally impossible: no provider, `sms.send_real`
  deny-by-default + owner-gated, `simulation:false` requests are 403,
  `sms_real` is not an ingestable source, and the generic ledger has no SMS
  adapter (tested).
- Outcomes: `POST /leads/:id/outcomes` — evidence-tagged revenue_outcome
  proof; verified_fact requires `evidence_source`; positive reputation ONLY
  from verified_fact outcomes (DB trigger + memory mirror + test that a
  sneaky direct insert is rejected).
- Summary: `GET /front-desk/summary` — counts + estimated value vs
  **verified booked value (verified_fact rows only)**.
- UI: `/moveros/front-desk` — demo intake, masked table, status/simulation/
  approval badges, action + outcome recording, summary strip, SLA placeholder.

## Routes added (full list)

SkillProof: see above. Front desk: `GET/POST /leads`, `GET /leads/:id`,
`POST /leads/:id/draft`, `POST /leads/:id/actions`, `POST /leads/:id/outcomes`,
`POST /leads/:id/purge-pii`, `POST /front-desk/actions/:id/execute`,
`GET /front-desk/summary`.

## Tests

- `skillproof.test.ts` (6), `frontdesk.test.ts` (6),
  `frontdesk.outcomes.test.ts` (8), repository-contract additions (proofs,
  agents/ATC, lead intakes) run against memory AND PGlite, plus migration 0013
  applied in both PGlite harnesses.
- Full gate at handoff: `pnpm check` green — **380/380 tests, 59 files**,
  typecheck + format clean.

## Blockers / unknowns

- Hermes external skills path inaccessible (`verified_fact`) — only 1 of 20
  skills has real source evidence; re-run import on a machine with
  `~/.hermes/skills` to upgrade seeds honestly.
- Lead detail console page deferred (API exists: `GET /leads/:id`,
  operator-only decryption); table + badges cover the demo loop.
- Live Postgres/Supabase state still `unknown` (PGlite-verified only).
- Reputation snapshots/recompute surface remains COG-008.

## Verification

```bash
pnpm install && pnpm check
pnpm vitest run apps/api/src/skillproof.test.ts apps/api/src/frontdesk.test.ts \
  apps/api/src/frontdesk.outcomes.test.ts
```

## Recommended next prompt

Prompt 7 (Reputation v0 surface, COG-008) or Prompt 9 (dashboard, COG-007) —
the proof/reputation data they need now exists end-to-end.
