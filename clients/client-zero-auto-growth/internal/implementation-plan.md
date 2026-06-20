# Internal Implementation Plan — Auto Growth OS (Client Zero)

Audience: the Demandara/Cognitia build team, not the client. This is how we
actually deliver the Auto Growth OS for Client Zero and turn it into a repeatable
template. The client-facing roadmap is `../proposal/10-roadmap-30-60-90.md`; this
doc covers sequencing, owners, tools, dependencies, and risks behind it.

> Guardrails: nothing in this plan ships customer-facing finance/trade-in copy
> without the named approver. No live vendor wiring is in scope for this artifact
> pass — it provisions in the build phase. See `guardrails.md`.

---

## Operating principle

Fix the client's biggest leak first (their `primary_goal`), get one thing live
fast, then build outward. Every workstream below maps to a playbook spec; we do not
re-invent scope here, we sequence it.

## Build sequence (maps to the 30/60/90 roadmap)

| Phase | Workstream | Spec | Depends on |
| --- | --- | --- | --- |
| 0 (0–5d) | Discovery + config lock | `../discovery/01`, `../console/` | Client access |
| 0 | Baseline capture | `../proposal/12` | Questionnaire complete |
| 1 (1–30d) | Website core build | `../playbooks/04-website-blueprint.md` | Brand assets, domain access |
| 1 | Inventory automation | `../playbooks/05-inventory-automation.md` | Inventory source identified |
| 1 | One-inbox intake (top 2 channels) | `../playbooks/06-whatsapp-telegram-intake.md` | Channel access |
| 1 | CRM-lite stand-up | `../playbooks/07-crm-lite-pipeline.md` | `current_crm` known |
| 1 | First-win instrument | per `primary_goal` | Baseline captured |
| 2 (31–60d) | AI Sales Closer live | `../playbooks/08-ai-sales-closer-script.md` | Intake + CRM-lite live |
| 2 | Remaining channels | `06` | Phase-1 inbox stable |
| 2 | Finance/trade-in flow (if in scope) | `04`, `06`, `08` | **Approver sign-off** |
| 3 (61–90d) | SEO/AEO/GEO program | `../playbooks/09-seo-aeo-geo-page-map.md` | Site + inventory live |
| 3 | Optimization + A/B | `04`, `07` | Traffic/leads flowing |
| 3 | Proof + case-study build | `../proposal/12` | 60+ days of data |

## Owners (roles, not names)

| Role | Responsibility |
| --- | --- |
| Engagement lead (Demandara) | Client relationship, sign-offs, reporting cadence |
| Build lead | Website, inventory automation, channel wiring |
| Agent lead (Cognitia) | AI Sales Closer config under control-plane policy, proof registry |
| Content/SEO lead | Vehicle copy, AEO answers, SEO/GEO pages |
| Named client approver | Finance/trade-in sign-off (client side) |

## Tooling decisions (options to evaluate — not provisioned here)

| Layer | Options to evaluate | Decision driver |
| --- | --- | --- |
| Website | Static/CMS build per `04` | `current_website`, scale |
| Inventory pipeline | Zapier / Make / Supabase | `inventory_update_method`, `inventory_size` |
| Photo QC | **Hermes vision-skill (reused)** | Mandatory pre-publish gate |
| Intake / inbox | WhatsApp/Telegram Business + unified inbox | `lead_channels[]` |
| CRM-lite | Airtable / Notion / Supabase / existing dealer CRM | `current_crm` |
| AI Sales Closer | Cognitia control plane | Always (governance) |
| Reporting | Dashboard over CRM-lite + closer logs | Tier cadence |

Hermes Vision Skill (`hermes/skills/vision-skill/`) is the one concrete reuse: it
screens vehicle media for plates, documents, and quality before publish. It is a
supporting artifact — not modified by this engagement.

## Dependencies & critical path

1. **Config lock** gates everything — the console output sets tier and modules.
2. **Baseline** gates the proof loop — no baseline, no credible result.
3. **Approver sign-off** gates all finance/trade-in go-live — hard blocker, by design.
4. **Intake + CRM-lite** must be stable before the AI Sales Closer goes live (it
   writes into them).

## Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Inventory source messy / no feed | Start Basic (assisted publish), upgrade automation later |
| Approver slow on finance/trade-in | Ship everything else; flagged items wait, never bypass |
| Channel access delays (WhatsApp/Telegram) | Launch top 2 channels first, add the rest in Phase 2 |
| Client expects guaranteed results | Reset expectation at kickoff using the offer's guardrail framing |
| Scope creep beyond tier | Console output is the scope of record; extras are add-ons |
| Over-automation feels impersonal | Closer discloses + hands off; human owns finance/price/trade-in |

## Definition of done (Client Zero)

- All 7 modules live at the recommended tier's depth.
- Baseline → 90-day numbers recorded in the proof registry.
- A Client Zero case study assembled (with client permission).
- The package generalized: this folder is reusable for the next dealership by
  re-running discovery + the console.

## Reusability note

This entire `clients/client-zero-auto-growth/` tree is the **template**. For the
next client, copy the structure, re-run `../discovery/01-discovery-questionnaire.md`
through `../console/discovery-console.html`, and the recommendation regenerates the
scope. The playbooks are vertical-stable; only the config changes.
