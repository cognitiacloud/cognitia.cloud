# Deployment Boundary & Release Gate — Hermes Vision Skill

> **Scope:** the current Hermes Vision Skill (`hermes/skills/vision-skill/`) only. Nothing here
> certifies or implies SOC2 readiness for any wider Cognitia/Demandara/Sales Closer product.
> This describes a **target** boundary; most of it does **not** exist in code yet and is marked
> as such.

## Current state (observed in code)

- The skill is a standalone Python module run **locally** as a CLI or MCP **stdio** server. It
  exposes no network listener of its own.
- There is **no** `Dockerfile`, **no** CI workflow (`.github/workflows`), **no** IaC, and **no**
  hosted deployment configuration in the repo (not observed in current code).
- There is **no** staging/production separation — the same code runs wherever it is installed.
- The skill is effectively **stateless**: it reads input images/video and prints JSON results.
  It persists no datastore by default (not observed in current code).
- Outbound network calls go **only** to the configured vision provider over HTTPS (see
  [`incident-response.md`](./incident-response.md) for the provider list).

Because no environment boundary exists today, the rest of this document defines the **target**
boundary and the gate for promoting between tiers.

## Tier model

| Property | Mock Demo | Private Pilot | Production |
|----------|-----------|---------------|------------|
| **Purpose** | Demonstrate capability | Validate on approved real assets | Multi-user / external service |
| **Who runs it** | Founder/operator, local | Founder/operator or named internal user | External / self-service users |
| **Access model** | Local only | **Operator-mediated** (no direct external user access until auth/RBAC + access logging exist) | Authenticated, RBAC-gated |
| **Data** | Synthetic test assets only | Real assets explicitly approved for the pilot | Customer-supplied data at scale |
| **Provider egress** | None (OCR-only) or a test key | Configured provider, intentionally chosen; OCR-only if no egress allowed | Configured provider under contract/DPA |
| **Network exposure** | Local CLI/stdio | Local CLI/stdio, operator machine | Internet-facing service (new infra, out of current scope) |
| **Secrets** | None or dummy keys | Managed runtime keys (see `secrets-policy.md`) | Managed secrets + rotation |
| **Audit/logging** | Redaction only | Basic access trail for the pilot window | Durable, tamper-evident audit log |
| **Monitoring** | None | Basic error/failure visibility | Full monitoring + alerting |
| **Backups** | n/a (stateless) | n/a unless the pilot stores outputs | Defined backup/retention if state is introduced |

> The jump from Private Pilot to Production is **not** a config flip. Internet-facing exposure,
> authentication, RBAC, and durable audit logging are net-new capabilities that do not exist in
> the current code and must be built and reviewed first.

## Staging vs production boundary (target)

When environments are introduced, they must be **isolated**, not shared:

- **Separate secrets per environment.** A staging/pilot key is never reused in production, and
  vice versa (see `secrets-policy.md`).
- **Separate data.** Synthetic/test assets never mix with real customer assets. Production data
  is never copied into staging.
- **Separate provider accounts/keys where feasible**, so quota, billing, and revocation are
  independent.
- **Documented promotion path.** A change reaches production only after passing the release gate
  below; no direct edits to a production environment.

## Mock/live release gate

A build is promoted **one tier at a time**. Each promotion requires the checklist for the
target tier to pass. Record who approved each promotion (owner: `TBD`).

### Mock Demo → Private Pilot
- [ ] Synthetic test assets (e.g. `test_assets/`) are clearly separated from any real asset.
- [ ] The pilot is **operator-mediated**; no external/self-service access is enabled.
- [ ] Provider choice for the pilot is explicit and intended; OCR-only is used if no egress is
      acceptable.
- [ ] Secrets handled per [`secrets-policy.md`](./secrets-policy.md); no secrets in the repo.
- [ ] `vision_privacy_scan()` privacy gate verified on this build.
- [ ] Basic access trail (who ran what, when, against which assets) is in place.
- [ ] Vendor/subprocessor placeholder reviewed for the configured provider.
- [ ] The Private-Pilot **Go/No-Go gate** in [`soc2-readiness.md`](./soc2-readiness.md) passes.

### Private Pilot → Production
- [ ] Authentication + RBAC implemented and reviewed (currently ❌ — see `soc2-readiness.md` S3).
- [ ] Durable, tamper-evident audit log implemented (currently ❌ — S4).
- [ ] Monitoring + alerting in place (currently ❌ — A2).
- [ ] Backup/retention policy defined and implemented **if** the service introduces stored state
      (currently stateless — A1).
- [ ] Subprocessor list finalized with DPA/contract status for every configured provider.
- [ ] Secret rotation implemented and tested (see `secrets-policy.md`).

> Until the Private Pilot → Production items are met, the skill stays operator-mediated. Direct
> external user access is a Production capability and is **not** authorized before this gate
> passes.

## Monitoring & alerts plan (target)

None exists today (not observed in current code). Target, by tier:

- **Private Pilot (basic):** capture errors and provider-call failures (HTTP errors are already
  surfaced in `ProviderResult.error`); operator reviews them during the pilot window.
- **Production (full):** error-rate and latency metrics, provider-failure alerting, health
  checks, and on-call routing to the responder named in `incident-response.md`. Alerts must not
  leak secrets/PII — route through the same redaction discipline already applied to logs.

## Backup & retention policy (target)

The skill is currently **stateless** and persists nothing by default, so there is nothing to
back up today. If a tier introduces stored state (e.g. saved scan results), define:

- **What** is stored and its sensitivity (scan outputs may contain redacted OCR text only —
  `ocr_text_redacted` is truncated to 2000 chars in code).
- **Retention period** per tier (placeholder: pilot — minimal/short; production — `TBD`).
- **RPO / RTO** targets (placeholders: `TBD`).
- **Deletion path** for purging pilot data at the end of the engagement.

## Related documents

- [`soc2-readiness.md`](./soc2-readiness.md) — master checklist and Go/No-Go gate.
- [`secrets-policy.md`](./secrets-policy.md) — secret inventory and handling.
- [`incident-response.md`](./incident-response.md) — incident outline, subprocessors, audit log.
