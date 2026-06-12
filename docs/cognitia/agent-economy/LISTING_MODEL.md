# Marketplace Listing Model (AGENT-ECONOMY-004)

A **listing** is a discoverable, internal-only offer inside the Agent Economy
Lab: an agent service, a skill execution, or a workflow that a requester can
turn into a governed work order. A listing is a _proposal surface_ — it never
moves credits or reputation by itself.

## Table: `marketplace_listings` (migration `0018`)

| Column                           | Type           | Notes                                                                                                                                                  |
| -------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                             | uuid           | PK                                                                                                                                                     |
| `tenant_id`                      | uuid           | RLS-isolated, FK tenants                                                                                                                               |
| `listing_type`                   | text           | `agent_service` \| `skill_execution` \| `workflow` \| `verifier_service` \| `research_task` \| `gtm_task` \| `support_task` \| `internal_only` (CHECK) |
| `title`                          | text           |                                                                                                                                                        |
| `description`                    | text \| null   |                                                                                                                                                        |
| `status`                         | text           | `draft` \| `active` \| `paused` \| `yanked` \| `archived` (CHECK, default `draft`)                                                                     |
| `visibility`                     | text           | `internal` \| `tenant` \| `private` (CHECK). **There is no `public` value** — a public marketplace is structurally unrepresentable.                    |
| `owner_agent_id`                 | uuid \| null   | FK agents                                                                                                                                              |
| `skill_version_id`               | uuid \| null   | FK skill_versions                                                                                                                                      |
| `workflow_ref`                   | text \| null   |                                                                                                                                                        |
| `required_proof_tier`            | int \| null    | 0–4                                                                                                                                                    |
| `minimum_reputation_score`       | bigint \| null |                                                                                                                                                        |
| `requested_credits_min` / `_max` | bigint \| null | **Internal credits ESTIMATE range — not a price, not a token amount.** A CHECK enforces min ≤ max.                                                     |
| `allowed_tenant_scope`           | text           | `internal` \| `tenant` \| `private`                                                                                                                    |
| `risk_level`                     | text           | `none` \| `low` \| `medium` \| `high`                                                                                                                  |
| `proof_required`                 | boolean        | a listing must declare this                                                                                                                            |
| `created_at` / `updated_at`      | timestamptz    | `set_updated_at` trigger                                                                                                                               |

There is **deliberately no price column of any kind.** The only money-shaped
fields are an internal-credits estimate range.

`work_orders` gains a nullable `listing_id` (FK `marketplace_listings`) so an
order created from a listing links back to it.

## Listing rules (service: `apps/api/src/marketplace.ts`)

Enforced when a listing becomes **active** (`assertActivatable`), on top of the
structural DB CHECKs:

1. A **yanked skill version** cannot back an active listing.
2. An agent whose **ATC is not active** (revoked/suspended/expired) cannot own
   an active listing.
3. **Tier-0 skills** can only be listed active for `internal` visibility
   (internal/simulated work only). Tier-2+ is preferred for verified work.
4. A listing **must declare** its proof requirement (`proof_required`, no
   implicit default-away).
5. A listing **cannot imply a guaranteed outcome** and **cannot carry a token
   price or public-investment language** — there is no field for it, and the
   doctrine guards scan for the language.
6. **High-risk** listings are flagged for approval before use.

## Invariants

- Visibility is `internal | tenant | private` only — proven by the DB CHECK and
  the in-memory mirror (a `public` insert throws on both engines).
- A listing creates **no** reputation event and moves **no** credits. Only
  completed, `verified_fact`-proven work does (the 0016/0010 triggers still own
  payout). Tested in `marketplace.test.ts`.
