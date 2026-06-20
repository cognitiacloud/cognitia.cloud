# Checkpoint 00 — Hour 0

**Loop:** Cognitia 36-Hour Agentic Loop · **Window:** 2026-06-20 → 2026-06-22
**Manager:** 36-Hour Cognitia Agentic Loop Manager
**Status:** First artifact pass complete across all 5 workers (A–E).

> Classification legend in [`../GUARDRAILS.md`](../GUARDRAILS.md):
> **VERIFIED** / **INFERRED** / **RECOMMENDED** / **UNSAFE — DO NOT DO YET**.

---

## 1. Artifacts created

23 files (18 markdown artifacts + runnable harness MVP + control plane). Full
list in [`../ARTIFACT_INDEX.md`](../ARTIFACT_INDEX.md). By worker:

- **Control plane** — `GUARDRAILS.md`, `ROADMAP.md`, `ARTIFACT_INDEX.md`, this checkpoint.
- **A (GTM):** `competitor-map.md`, `positioning-brief.md`, `gtm-channels.md`.
- **B (Auto Growth OS):** `auto-growth-os-spec.md`, `mock-workflows.md`, `kpis-and-proof.md`, `sales-closer-prompts.md`.
- **C (Ads/Media):** `ads-media-engine-spec.md`, `creative-test-plan.md`, `creative-briefs.md`, `compliance-guardrails.md`.
- **D (Token Sandbox):** `token-credit-sandbox-design.md`, `ledger-schema.md`, `proof-layer-spec.md`, `sandbox-test-plan.md`.
- **E (Harness):** `harness-spec.md`, `harness_mvp.py`, `goals.example.json`, `test_harness.py`, `README.md`, `run_output/*`.

## 2. Strongest findings

| # | Finding | Class | Source |
|---|---------|-------|--------|
| 1 | The **11x AI-SDR scandal** (reported ARR inflation ~$10M claimed vs ~$3M, fake logos, high churn, CEO out) created a **trust deficit on outcomes** the category can't self-heal — this is Cognitia's sharpest wedge. | VERIFIED | Worker A (TechCrunch-reported) |
| 2 | **Numa** already sells outcome-based, pay-per-booked-appointment + "AI transparency" across 1,200+ dealerships — proves dealers buy proof framing, and is the **top competitive threat**. | VERIFIED | Worker A |
| 3 | **ERC-8004** (on-chain agent identity + reputation) went live on Ethereum mainnet 2026-01-29 with EF/MetaMask/Google contributors — natural substrate for the proof registry; **ride it, don't reinvent**. | VERIFIED | Worker A |
| 4 | The defensible seam is **neutrality**: a cross-vendor, SMB-affordable, auditable **proof-of-outcome ledger** ("don't trust the agent, trust the receipt"). No incumbent occupies it. | INFERRED | Worker A |
| 5 | Auto-ad legal reality: **TILA/Reg Z** triggers mandatory APR+terms disclosures the moment a payment/term number appears; **FTC CARS Rule was vacated (5th Cir., 2025-01-27)** but FTC deception + TILA still bind. "Guaranteed approval" is a known enforcement target. | VERIFIED | Worker C (cited) |
| 6 | **Harness MVP runs green:** 12/12 unittests pass; guardrail chokepoint blocks `send_email` (hard-stop action) and a `token_launch` intent in the live ledger. Boundary enforcement is demonstrated, not asserted. | VERIFIED | Re-run this checkpoint |
| 7 | Token sandbox can be made **structurally safe**: separate spend-budget (ACT) from usage-meter (CMP), make Trust Points *derived not minted*, gate all new units through a capped `SYSTEM:MINT` boundary, and let **no redeem/withdraw/fiat field exist by construction**. | RECOMMENDED | Worker D |

## 3. What changed in the roadmap

- Reframed the category from "another AI agent/SDR/CRM" → **neutral proof/trust layer above agents**. (Worker A wedge.)
- Elevated **Client Zero side-by-side proof demo** (Cognitia ledger vs. vendor-reported numbers, synthetic fixtures) to flagship build.
- Converged B + D + E: the **next concrete build** is the harness emitting B's hash-chained ledger + ProofRecords for the 3 mock workflows, validated by D's conservation/replay invariants. Three workers independently recommended this.
- Added a hard architectural split in Ads: **Compliance Agent with block authority** separate from the Creative Agent.

## 4. What should be killed / parked

- **PARK:** Building any real Meta/Google/TikTok ad adapter (Worker C marked UNSAFE) — design the sandbox interface only.
- **PARK:** Any redemption/withdrawal/fiat/exchange-rate path in the token sandbox (Worker D) — keep parked permanently until founder+legal.
- **PARK:** Independent on-chain "proof registry" contract — defer in favor of evaluating ERC-8004 as substrate first.
- **KILL (this loop):** No standalone CRM build — position above existing stacks, don't rebuild one.
- **KILL (this loop):** Prior-art deep-fetch for ledger patterns (Worker D left as INFERRED) — low ROI vs. shipping invariant tests.

## 5. Security / compliance risks

| Risk | Severity | Mitigation in place |
|------|----------|---------------------|
| Generative system emitting **guaranteed financing/approval/ROI** or bare payment numbers w/o TILA disclosures | High | Claims blocklist (B) + Compliance Agent w/ block authority (C); guarantee sweep this checkpoint found only blocklist/negation uses |
| Proof layer **over-claiming** (attesting outcomes/sales/financing) | High | `ProofRecord.does_not_attest` field (B); proof attests "actions under conditions, never outcomes" (B/D) |
| Token sandbox drifting toward **tradable/real-money** | High | No value rail by construction; cash_value immutably 0; capped mint boundary (D) — keep UNSAFE items parked |
| **PII leakage** in fixtures/artifacts | Med | Synthetic-only policy; sweep found no real phones/emails; all personas `+1-555-01xx` / `*.invalid` |
| **Sprawl / uncontrolled implementation** | Med | Workers scoped to own dirs; only code is isolated harness MVP (no prod integration, no network) |
| Harness ledger non-determinism across re-runs (append-only accumulates) | Low | Documented; clean run regenerated for committed artifact |

## 6. Next 6-hour plan (Hour 6 target)

1. **Build the proof-emitting harness step (B×D×E):** extend `harness_mvp.py` with a mock executor that emits B's hash-chained `ActionLedgerEntry` + `ProofRecord` for one of the 3 mock workflows; validate with D's T1/T2 conservation + replay tests. Isolated, no network.
2. **Claims-filter module spec → test:** turn B's blocklist into a tiny, testable pure function (input turn → allow/deny + `action.denied` log). Reuse harness guardrail chokepoint pattern.
3. **Positioning one-pager** (synthetic): distill A's wedge into a single internal narrative doc + the side-by-side demo storyboard (no real logos/PII).
4. **Cross-worker reconciliation doc:** map shared entities (ActionLedgerEntry, ProofRecord, credit ledger) so B/D/E use one schema.
5. Refresh `ROADMAP.md` + write `checkpoint-01-hour6.md`.

## 7. Decisions needed from founder

1. **Category bet:** Endorse "neutral proof/trust layer above agents" as the primary positioning (vs. AI-SDR / dealer-OS framing)? Everything downstream keys off this. *(Recommend: yes.)*
2. **ERC-8004 stance:** OK to spend research time evaluating ERC-8004 as the proof-registry substrate (read-only, no deploy, no mainnet tx this loop)? *(Recommend: yes, research-only.)*
3. **Client Zero demo data:** Confirm the flagship demo uses **synthetic fixtures only** for the side-by-side proof (no real dealership numbers) until a data-sharing agreement exists. *(Recommend: yes.)*
4. **Legal review trigger:** Auto-ad compliance (TILA/FTC) and any outcome-attestation language need legal review **before** anything leaves the sandbox. Confirm legal is in the loop before Hour-18 "build-next" items touch real claims.

## 8. Exact file paths / artifact names

See [`../ARTIFACT_INDEX.md`](../ARTIFACT_INDEX.md). Verification commands (re-runnable):

```
cd cognitia/workers/E-harness-builder
python3 -m unittest test_harness          # → Ran 12 tests ... OK
python3 harness_mvp.py --goals goals.example.json --out ./run_output
grep BLOCKED run_output/action_ledger.jsonl   # → 2 blocked (send_email, token_launch)
```

---

### Worker classification summary

| Worker | VERIFIED highlights | UNSAFE / parked |
|--------|--------------------|-----------------|
| A GTM | 11x scandal, Numa outcome-pricing, ERC-8004 live, pricing whitespace | Cold outreach, paid launch, token-as-channel, ROI claims |
| B Auto OS | (design) — proof attests actions not outcomes | Live sends, real calendar/lead writes, sale/financing/volume claims |
| C Ads | TILA triggers, CARS vacated, substantiation duty | Ad-platform write/launch/spend adapters, guarantee claims, real PII audiences |
| D Token | (design) structural no-value guarantees | Any redeem/withdraw/fiat, P2P/cross-tenant transfer, public/on-chain token |
| E Harness | 12/12 tests pass; guardrail blocks live in ledger | (none — isolated MVP, no network) |
