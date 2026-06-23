# Cognitia / Demandara — Roadmap (Latest)

> **Date:** 2026-06-23 · **Canonical line:** `overnight/gtm-implementation` @ `da48e8f` · **Companion to**
> [`../audits/master-execution-report-latest.md`](../audits/master-execution-report-latest.md) — the full
> 13-section master report is the single source of truth; this file is the scannable forward plan.
>
> Honesty rules carry over: no fake proof, no inflated scores, **actual-live is capped by design**.
> Marks: ✅ verified this session · 📄 PR/branch claim · 🧪 simulated-by-design · ❓ named input not found.

## Status at a glance (✅ verified on `da48e8f`)

- `pnpm run check` → **805 tests / 106 files**, prettier + `tsc` clean. `next build` → green, ~19 routes.
- **Convergence, not features, is the binding risk:** the canonical line is open PR #158, ~3 levels from
  `main`; ~40 open PRs target it (≈99 repo-wide), ~98 drafts, 0 failing CI. (roadmap-audit PR #188)
- `main` is **10 commits behind** the canonical line and fully contained in it — not canonical.

## Scorecard (from master report §6 — abbreviated)

| Axis | Score | | Axis | Score |
| --- | --- | --- | --- | --- |
| Build & CI health | ✅ 92 | | Enterprise readiness | 📄 45 |
| Test breadth | ✅ 82 | | Trust/governance design | ✅ 85 |
| Governed CRM loop (Top-10) | 75 | | Compliance certification | ✅ 20 |
| Alta parity (mock breadth) | 📄 70 | | Agent Economy (→100) | 🧪 40 |
| Dry-run readiness | 📄 88 | | Demo / investor | 80 |
| Controlled-live readiness | 📄 74 | | Production deployment | ✅ 22 |
| **Actual-live (CAPPED)** | 🧪 **20** | | Pilot traction | ✅ 20 |

**Progress (math in master §7):**
- Mock-safe MVP completeness — `[████████████████░░░░] 81%`
- Production / commercial readiness — `[███████░░░░░░░░░░░░░░] 34%`

## Next merge / build order (do this first)

1. **Merge train to `main`:** `#135 → #158 (overnight) → main` (adopt/replace #149's hold map). 📄
2. **Collapse duplicates:** one Command Center (#168 **or** #169), one TrustOps (#165 **or** #166), one Alta
   readiness audit; close the rest. 📄
3. **Scope-fence ruling** (founder): re-authorize+amend `operating-plan.md` §0a, or quarantine
   `/agent-economy`,`/credits`,`/skills`,`/proofs`,`/agents`.
4. **Closer automation-readiness train (mock-safe):**
   #171 → #175 → #176 → #174 → #173 → #177 → #182 → #180/#184 (release-gate #179 already in). 📄
5. **Wire one Command Center end-to-end** (B1 packet → B2 dry-run → B3 timeline → web route; bind B6). 🧪

## 7-day plan

| Day | Action | Evidence |
| --- | --- | --- |
| 1–2 | Land the spine toward `main` (#135→#158→main) | roadmap-audit §5.1 |
| 2–3 | Collapse duplicate Command Center / TrustOps / Alta-audit PRs | roadmap-audit §3.5 |
| 3 | Founder scope-fence ruling + amend §0a | operating-plan §0a |
| 4–6 | Closer automation-readiness ordered merge train | roadmap-audit §5.4 |
| 6–7 | One Command Center wired end-to-end (mock-safe) | alta-80 §3.A |

## 30-day enterprise-readiness plan

| Week | Focus | Exit signal |
| --- | --- | --- |
| 1 | Convergence + scope-fence ruling | spine on `main`; duplicates closed |
| 2 | Provision Postgres; migrations `0001–0019`; **hosted/managed RLS under non-superuser** | RLS verified on managed provider (`MANAGED_POSTGRES_RLS_VERIFICATION_PLAN.md`) |
| 3 | Enterprise controls bound to route (#162/#185); monitoring + rollback | B6 gates enforce on approval path |
| 4 | SOC 2 program + Vanta/Drata; audit-export/retention (SEC-2); SSO spike (AUTH-2); DPA | SOC 2 Type-1 readiness engaged |

No live channel send is in any exit criterion (fence).

## Agent Economy 100 plan (🧪 simulation-only; legal gate intact)

1. Scope-fence ruling first. 2. Cross-tenant settlement (simulated, internal credits only).
3. Dispute-resolution loop into the work-order state machine. 4. Marketplace matching depth + detail pages.
5. Standards spike (ERC-8004/EAS/x402 via reserved `external_ref`) — design only.
6. Real settlement stays legal-gated; "100" = simulated economy fully closed + standards-mapped, **not** a
   live token. Source: `../agent-economy/`, `ARCHITECTURE_LOCK_V1_1.md` §5.

## Investor / demo package

`PUBLIC_DILIGENCE_OVERVIEW.md` + Researcher Pack (`../public/`, 18 docs); demo `../demo/DEMO_SCRIPT_V1.md`
(`next build` green); competitive wedge `../../strategy/beat-alta-10x.md`; investor panels PR #161/#190 (pick
one); surface the only non-draft PR #89. Lead with ✅ axes; state the 🧪 cap plainly; **no live/paying-customer
claim**.

## Founder decision list

1. Authorize the merge train (#135→#158→main). 2. Scope-fence ruling (re-authorize vs quarantine).
3. Canonical Command Center (#168 vs #169). 4. Promote default branch. 5. Hosted DB choice.
6. Counsel-gated: token-shaped surfaces, stablecoin custody, CASL consent wording before any real send.
7. Pilot go/no-go (MoverOS Tenant Zero / Demandara). Detail + citations: master report §12.

## Actual-live blockers (the cap — master §13)

Enforced in code: `dryRunChannels.sendLive()` always throws; `automationReleaseGate` `controlled_live` fails
closed behind 7 sign-offs; kill-switch 409s on non-`active` connections; email adapter off in v1.
Three-axis posture (PR #181): dry-run **88** / controlled-live **74** / **actual-live 20 (capped)**.
External sign-off only (never auto-removed): legal/counsel, signed customer scope + consent, live deployment +
connector/credential approvals, any live channel send.

## Named inputs not found (❓ — not fabricated)

"Cognitia Republic playbook" ❓ · "Trust From Zero" 90-day plan ❓ (closest: operating-plan §8; beat-alta §4)
· "War Council" stress test ❓ (closest: `../research/12H_CRYPTO_VISIBILITY_AGENT_FABRIC/FOUNDER_COUNCIL_12H_DEBATE.md`).
Found: Alta/SalesCloser comparison, Agent Economy roadmap, latest audit reports (master §5).
