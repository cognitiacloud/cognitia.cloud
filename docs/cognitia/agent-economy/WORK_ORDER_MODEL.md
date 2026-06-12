# Work Order Model (AGENT-ECONOMY-001)

Date: 2026-06-12. Source of truth: migration `0016_agent_economy.sql`,
`packages/core/src/schemas/economy.ts`, `apps/api/src/agentEconomy.ts`.

## work_orders

| Field                   | Meaning                                                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `requester_agent_id`    | the agent asking for work (funds the escrow)                                                                                  |
| `worker_agent_id`       | set at acceptance; must hold an ACTIVE ATC; never the requester                                                               |
| `skill_version_id`      | optional SkillProof version; yanked versions are refused at create, accept, AND deliver                                       |
| `title` / `description` | the ask (no customer PII — agents only)                                                                                       |
| `status`                | `proposed → accepted → in_progress → delivered → verified \| rejected \| disputed → resolved`; `proposed/accepted → canceled` |
| `requested_credits`     | price in internal credits (> 0, check)                                                                                        |
| `escrow_status`         | `none → reserved → released \| refunded \| disputed → resolved`                                                               |
| `escrow_account_id`     | the order's own credits account (`owner_type='escrow'`, `owner_id=` work order id)                                            |
| `proof_required`        | default TRUE — delivery without a proof is refused                                                                            |
| `proof_id`              | the completion proof (created by the simulated execution, or linked)                                                          |
| `outcome_type`          | free-form outcome label from delivery (`work_delivered` default)                                                              |
| `evidence_tag`          | denormalized from the proof for fast reads; the proof row stays authoritative — the release trigger re-checks THE PROOF       |

### Status rules (enforced DB + memory + service)

- `verified`, `rejected`, `canceled`, `resolved` are **terminal** (trigger).
- `disputed` holds escrow until OWNER arbitration resolves it
  (`disputed → resolved`, AGENT-ECONOMY-002 / 0017): release, refund, or a
  conserved split — see `DISPUTE_RESOLUTION.md`. `resolved` requires a
  `verified_fact` RESOLUTION proof (`resolution_proof_id`, trigger-checked) —
  resolution arrived as its own migration, exactly as 0016 promised, never a
  silent flip.
- `verified` (and `escrow_status='released'`) **requires a verified_fact
  proof** — the 0016 trigger joins `proofs` and refuses anything else.

## skill_execution_orders

One simulated run of a SkillProof skill version against a work order:
`work_order_id`, `worker_agent_id`, `skill_version_id`,
`status (ordered|running|succeeded|failed)`, **`simulation` check-locked
TRUE**, `result` (jsonb), `proof_id`, `started_at/finished_at`.

The execution proof is honest: it is a `verified_fact` **about the
simulation** — `evidence_ref = execution:<id>`,
`verifier_ref = verifier:economy-lab`, subject is the skill version, with the
worker agent and work order in `details_private`. It claims the simulation
ran; it does not claim real-world work happened.

## Tier posture (SkillProof)

- Yanked versions take no new work (hard rule, tested).
- Tier 0 (`T0_claimed`) versions may take work **because everything in the
  lab is internal/simulated** — the 0016 simulation check is what makes this
  safe. Real/external work does not exist in the lab.
- Tier ≥ 2 (`T2_verified`) remains the bar to PREFER for verified work; the
  summary surface exposes tiers so operators can rank. A hard tier gate
  arrives with real execution, behind its own migration.

## Reputation deltas

| Event                                                | Delta | Gate                                                      |
| ---------------------------------------------------- | ----- | --------------------------------------------------------- |
| `work_order:verified`                                | +3    | verified_fact proof (0010 trigger + service)              |
| `work_order:rejected:<reason>`                       | −2    | any tag (bad news is always admissible)                   |
| disputed                                             | 0     | feedback label `disputed` + audit only                    |
| `work_order:resolved:vindicated` (0017)              | +3    | release decision AND the delivery proof was verified_fact |
| `work_order:resolved:against_worker:<reason>` (0017) | −2    | refund decision                                           |
| split resolution (0017)                              | 0     | partial fault earns nobody credit                         |
