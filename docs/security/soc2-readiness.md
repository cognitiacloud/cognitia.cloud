# SOC2-Aligned Readiness Checklist — Hermes Vision Skill

> **Status:** SOC2-readiness *preparation*. This is **not** a SOC2 certification, an
> attestation, or audit-readiness statement. It is an internal go/no-go checklist used to
> decide, deliberately, when the Hermes Vision Skill may move from a local demo toward a
> controlled pilot.

## Scope

This document covers **only the current Hermes Vision Skill control surface**
(`hermes/skills/vision-skill/`): a standalone Python module run locally as a CLI or MCP
stdio server. It performs local image/video QC (`analyze`, `compare`, `privacy_scan`,
`video_frame_qc`) and optionally calls a configured vision provider.

It does **not** assess, certify, or imply SOC2 readiness for any broader Cognitia,
Demandara, or Sales Closer product or production system. Those are out of scope and are not
evaluated here.

Broad SOC2 Trust Services Criteria (TSC) categories are referenced for organization only
— **Security**, **Availability**, **Confidentiality**. No specific numbered control IDs are
claimed, because none have been mapped or verified.

## The three tiers

These docs separate three distinct stages. The same code may run in any of them; what
differs is *who runs it, on whose data, and with what controls in place*.

| Tier | Intent | Who runs it | Data it may touch |
|------|--------|-------------|-------------------|
| **Mock Demo** | Show capability with synthetic/approved sample assets | Founder/operator on a local machine | Synthetic test assets only (e.g. `test_assets/`) — no real customer data |
| **Private Pilot** | Validate on real-but-approved assets in a controlled setting | **Founder/operator-run or internal-user-run only.** No external/self-service user access until auth/RBAC + access logging exist | Real assets explicitly approved for the pilot, handled by the operator |
| **Production** | Multi-user / external-facing service | External or self-service users | Customer-supplied data at scale |

> **Important (per access model):** "Private Pilot" here does **not** mean external users get
> direct, self-service access to the skill. Until authentication, RBAC, and access logging
> exist (see checklist), a pilot is operator-mediated: a founder or internal operator runs the
> skill on approved assets on behalf of the pilot. Direct external user access is a
> **Production-tier** capability and is gated accordingly.

## Readiness checklist

Legend — Status: ✅ met · ⚠️ partial · ❌ not started · n/a not applicable at this tier.
Owner is `TBD` (assign a named owner before relying on any row). "Required by" is the
earliest tier at which the control must be satisfied.

### Security (TSC: Security / Common Criteria)

| # | Control | Status (current) | Owner | Required by |
|---|---------|------------------|-------|-------------|
| S1 | **Staging/prod environment boundary** — distinct, isolated environments with documented promotion path | ❌ none exists (single local execution model) | TBD | Private Pilot |
| S2 | **Secrets policy** — no secrets in repo; injected via env/secret manager; rotation defined (see `secrets-policy.md`) | ⚠️ keys read from env only; `.mcp.json` ships **empty** placeholders; no rotation/manager | TBD | Private Pilot |
| S3 | **Access / RBAC plan** — user identity + role-based permission checks (see `deployment-boundary.md`) | ❌ no auth, no identity, no RBAC in code | TBD | Production (operator-mediated pilot until then) |
| S4 | **Audit log requirements** — durable, tamper-evident log of access/config/publish decisions (see `incident-response.md`) | ❌ no persistent audit log; logs are redacted-and-discarded, not retained | TBD | Private Pilot (basic) → Production (full) |
| S5 | **Secret/PII exposure controls** — redaction + privacy gating | ✅ `_RedactingFilter` + `_redact()` redact emails/keys/financial in logs; `vision_privacy_scan()` forces `publish_safe=false` and `reject_publish_secrets_visible` when secrets detected | TBD | Mock Demo |
| S6 | **Safe-by-default operation** — read-only, no deletes, no posting, no unknown uploads | ✅ declared in `skill.yaml` (`read_only`, `no_delete`, `no_post`, `no_unknown_uploads`, `redact_logs`) and `.mcp.json` (`read_only: true`) | TBD | Mock Demo |

### Availability (TSC: Availability)

| # | Control | Status (current) | Owner | Required by |
|---|---------|------------------|-------|-------------|
| A1 | **Backup / retention policy** — what is retained, where, how long, RPO/RTO (see `deployment-boundary.md`) | ❌ no backup mechanism; skill is stateless and persists nothing by default | TBD | Production |
| A2 | **Monitoring / alerts plan** — health, error-rate, and provider-failure alerting (see `deployment-boundary.md`) | ❌ no metrics, health checks, or alerting | TBD | Private Pilot (basic) → Production (full) |

### Confidentiality (TSC: Confidentiality)

| # | Control | Status (current) | Owner | Required by |
|---|---------|------------------|-------|-------------|
| C1 | **Vendor / subprocessor inventory** — what data leaves the host and to whom (see `incident-response.md`) | ⚠️ providers known from code; DPA/contract status TBD | TBD | Private Pilot |
| C2 | **Data-egress awareness** — operator knows when image bytes leave the host | ⚠️ egress only to the **configured** provider over HTTPS; OCR-only mode keeps data local; not enforced by policy/UI | TBD | Private Pilot |

### Release governance (cross-cutting)

| # | Control | Status (current) | Owner | Required by |
|---|---------|------------------|-------|-------------|
| R1 | **Mock/live release gate** — explicit promotion checklist Mock → Pilot → Production; synthetic vs real assets separated (see `deployment-boundary.md`) | ❌ not documented before this change | TBD | Private Pilot |

## Go / No-Go gate — Private Pilot

This is a **hard gate**. The skill may enter a Private Pilot **only if every line below is
true**. Any single ❌ is an automatic **No-Go**.

- [ ] **Operator-mediated only.** No external or self-service user gets direct access. The
      pilot is run by a founder/operator or named internal user. *(Until S3 is met, this is
      mandatory and cannot be waived.)*
- [ ] **Approved assets only.** Only assets explicitly approved for the pilot are processed;
      synthetic test assets are kept separate from real ones (R1).
- [ ] **Secrets handled per policy.** No secrets committed to the repo; provider keys
      injected at runtime; key owner and revocation path known (S2, `secrets-policy.md`).
- [ ] **Egress is understood and intended.** The operator knows which provider (if any) is
      configured and that image bytes leave the host to that provider; OCR-only mode is used
      when no egress is acceptable (C1, C2).
- [ ] **Privacy gate verified.** `vision_privacy_scan()` is confirmed to force
      `publish_safe=false` on secret detection on this build (S5).
- [ ] **Minimal access trail.** At least a basic record of who ran what, when, and against
      which assets exists for the pilot window (S4 basic).
- [ ] **Subprocessor list reviewed.** The vendor/subprocessor placeholder
      (`incident-response.md`) has been reviewed for the providers actually configured (C1).
- [ ] **Incident path exists.** A named responder and contact path are filled in
      (`incident-response.md`).

If any item cannot be checked, the pilot does not start — fix the gap or keep the skill at
the **Mock Demo** tier.

## Related documents

- [`deployment-boundary.md`](./deployment-boundary.md) — environments, tiers, monitoring,
  backup/retention, and the mock/live release gate.
- [`secrets-policy.md`](./secrets-policy.md) — secret inventory and handling policy.
- [`incident-response.md`](./incident-response.md) — incident outline, vendor/subprocessor
  placeholder, and audit-log requirements.
