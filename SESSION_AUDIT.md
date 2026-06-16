# Cognitia — Session & Project Audit

> Generated 2026-06-16 from the durable cross-session record (git/GitHub +
> the local Claude Code profile). "Sessions" = the Claude Code work/co-work
> sessions run on this profile; each `claude/*` branch ≈ one session.

---

## 1. Executive summary

- **Repository:** `cognitiacloud/cognitia.cloud` · default branch `main` @ `fbacb05`.
- **Sessions reconstructed:** **~90 `claude/*` branches** → **87 pull requests**.
- **PR status:** **69 merged · 9 open (in flight) · 9 closed-unmerged (abandoned/superseded).**
- **Active span:** 2026-05-28 → 2026-06-16 (~3 weeks of near-daily sessions).
- **Two work threads:**
  1. **Cognitia — Governed GTM Action System** (the product; the bulk of the work).
  2. **Cognitia media / Hermes content pipeline** (earlier; mostly superseded; the
     surviving artifact is `hermes/skills/vision-skill/`).
- **External trackers** (Linear / Notion / Airtable): effectively **empty** — no
  Cognitia projects/tasks are tracked outside GitHub (see §5).

---

## 2. What the system is

**Cognitia — a Governed GTM Action System.** A TypeScript-first, **CRM-first,
approval-gated** GTM automation product. The live agent **Mira** proposes HubSpot
CRM writes — two governed write types today: **follow-up tasks** and **grounded
account-context notes**. Every side effect runs a governed lifecycle:

> preview → human approval (mandatory structured reason) → idempotent,
> provenance-stamped execution → reversible undo

…and every capability claim is backed by a test that fails CI on regression.

- **Monorepo (pnpm + TypeScript):** `apps/web` (Next.js operator console),
  `apps/api` (Fastify-style service), `apps/worker` (jobs); `packages/`
  `core` · `db` · `agents` · `integrations` · `evals` · `workflows`.
- **Stack:** Supabase Postgres + pgvector · Zod · Vitest · n8n workflows.
- **Agents:** Mira = **Live (v1)**; Echo / Atlas / Beacon = Planned/Later.
- **Scope fence (V1):** CRM write-back only (HubSpot tasks/notes). Email, voice,
  ads execution are **fenced off** and enforced in tests + deploy smoke.

**Second thread — Cognitia media / Hermes pipeline:** video "Episode 002"
(Remotion scaffold), HeyGen, founder-avatar vision QC, and a Windows↔Hermes
filesystem mesh bridge. Surviving artifact: **`hermes/skills/vision-skill/`** —
read-only local OCR + multi-provider vision QC (OpenAI/Anthropic/Gemini/
OpenRouter/Ollama, OCR-only fallback), 13 passing tests, CLI + MCP stdio server.

---

## 3. Session timeline (oldest → newest)

| Date | Session group | PRs | Outcome |
| --- | --- | --- | --- |
| May 28–30 | **Media / Hermes thread** — `hermes` vision skill; Episode 002 rebuild (Remotion); Windows↔Hermes bridge | commit + #1, #2 | skill kept; #1 #2 closed-unmerged |
| Jun 6 | **GTM Phase 0** foundation + Mira outbound MVP | #3 | **open** |
| Jun 10 | **Governance wave** — decision reasons, provenance, batch UX, trust metrics, eval gate, typed write/preview, preflight, undo, trust packet, regression flywheel, kill switch, readiness gate, lifecycle acceptance, rationale, README coherence, scorecards, grounded notes, run/plan review, hardening, SOC | #4–#30 (excl. #18) | all merged |
| Jun 11 | **Cognitia v1.1 / COG pack** — schema foundation, proof registry, Agent Trust Credential, SkillProof + AI Front Desk/Lead Rescue, reputation v0, credits/wallet, command dashboard, evidence sync, run timeline, capability ledger, a11y smokes | #32–#43 (excl. #31) | all merged |
| Jun 12–13 | **Agent Economy + security** — SEC-1, Agent-Economy 001–005 (lab, disputes, agent actions, marketplace, settlement), agent passports, token architecture (doc), economy smoke, mainline status | #47–#57 (+#50) | merged; #44 #45 #46 #54 open |
| Jun 14 | **Public trust / visibility** — crypto-visibility, Trust/Proof Explorer V-4/4b/4c, V-5 feed hardening, 12h research, researcher pack, diligence discoverability | #58–#66 | all merged |
| Jun 15 | **Visibility + Lanes + Audit Booklet** — API reference, threat model, Agent Fabric Lab, system booklet, Lanes C/D/E (HubSpot live, AI drafting, meeting intel), overnight orchestrator, PILOT-001 mainline harness | #67–#83 (subset) | mostly merged; #71–74, #82 closed |
| Jun 15–16 | **RLS hardening** — managed Postgres RLS harness, PILOT status board, V6A docs reconcile | #84, #85, #87 | merged |
| Jun 16 | **This session** — `claude/plot-sessions-audit` (this audit) | — | in progress |

---

## 4. Status board

### ✅ Done — shipped to `main` (~69 merged PRs)
The full governed CRM loop is **live and CI-proven**: per-action approval with a
mandatory reason; "why this action" rationale + data-freshness warning;
byte-identical write preview; zero-write preflight simulation; connection-readiness
gate; idempotent provenance-stamped execute; accountable undo; tenant kill switch;
code-derived governance matrix + audit trail; trust metrics + exportable trust
packet; run/plan review; rejection→regression flywheel; falsifiable golden eval
gate; full-lifecycle acceptance test; post-deploy smoke; **Postgres RLS tenant
isolation**. Plus: public-safe `/trust` Proof Explorer + live proof feed + diligence
docs (researcher pack, threat model, API reference); **Agent Economy Lab**
(simulation-only: work orders, escrow, disputes, marketplace, settlement design);
token architecture spec (doc-only); the **AUDIT-BOOKLET** master system booklet.

### 🔧 In flight — 9 open PRs
| PR | Title | Since |
| --- | --- | --- |
| #3 | Phase 0 foundation + Mira outbound MVP | Jun 6 |
| #44 | COG-011: Lead detail — story endpoint + console | Jun 12 |
| #45 | COG-011 + COG-012: Lead detail + tenant provisioning | Jun 12 |
| #46 | COG-014: Demandara onboarding (2nd vertical GTM loop) | Jun 12 |
| #54 | Agent-Economy-004: marketplace listings + matching | Jun 12 |
| #61 | Fix Hermes bridge MCP stdio restart loop | Jun 14 |
| #78 | Lane B: operator Approval Queue + Run visibility | Jun 15 |
| #79 | COG-011 (UI): Lead Detail Console page | Jun 15 |
| #86 | Meeting-notes writeback via governed `crm.note` | Jun 15 |

### ⛔ Abandoned / superseded — 9 closed-unmerged PRs
#1 Episode 002 rebuild · #2 Windows Hermes bridge · #18 agent-economy 2-week spec ·
#31 COG-001 discovery · #71 CODE 28→50 integration manifest · #72 Lane A operator-UI
shell · #73 LEGEND-001 stitch/merge · #74 Lane C v1 (→ superseded by merged #77) ·
#82 PILOT-001 Tenant Zero (→ superseded by merged #83).

### Known remaining work (not unbuilt — human/data-blocked)
- **Live operator setup** needs human-provided HubSpot credentials + portal setup.
- **Earned-autonomy / risk-tiered review** is gated on accumulated decision-label volume.

---

## 5. Tracked elsewhere? (external scan)
You asked to include external trackers. Result — **no Cognitia work lives outside GitHub:**
- **Notion:** search for "Cognitia" → 0 results.
- **Airtable:** `list_bases` → no bases.
- **Linear:** a team **"Cognitiacloud"** exists but has **no projects** and only the
  4 default onboarding issues (`COG-1…COG-4`: "Get familiar with Linear", etc.).
  Note: Linear issue keys `COG-*` are unrelated to the repo's `COG-00x` work items.

---

## 6. Methodology & caveats
- **Sources:** local Claude Code profile (`~/.claude/projects/`), GitHub branches /
  PRs / commits for `cognitiacloud/cognitia.cloud`, and the Linear/Notion/Airtable
  MCP integrations.
- **Ephemeral transcripts:** web/remote Claude Code containers are reclaimed after
  use, so only the *current* session's transcript persists locally. Past sessions
  are reconstructed from their durable git footprint (branch + PR), not transcripts —
  so per-session prompt detail is not recoverable, only the work product.
- **"Plot / co-work / court sessions"** are read as the Claude Code work sessions.
- **PR counts** (87 / 69 / 9 / 9) reflect state at generation time; re-run
  `list_pull_requests` to refresh.
