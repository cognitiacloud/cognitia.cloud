# Memo 4 — Client Zero Proof Loop

**Status:** sandbox design · internal only
**Boundaries:** no public token, no chain, no legal conclusions. Every value below
is a non-redeemable internal credit; every "proof" is an internal audit record.

> **Vocabulary (canonical, do not drift):**
> - **Client Zero = the dealership / Auto Growth OS proof workflow.** The primary
>   Sales Closer proof path and the subject of **this memo**.
> - **MoverOS = the parallel moving-company lane.** Labeled **"Tenant Zero /
>   MoverOS"** when run as a sandbox/demo (as it is here), or **"Client One /
>   MoverOS"** only if/when promoted to a real client pilot (not done here).
>   **Never call MoverOS "Client Zero."**
> - The two lanes **reuse the same primitives** but keep their files, fixtures,
>   refs, claims, and customer language **separate**. This memo covers the Client
>   Zero lane; the MoverOS lane has its own demo and is only cross-referenced here.

## 1. Purpose

Show, end to end, how a single **Client Zero** (dealership / Auto Growth OS) action
turns into a proof event, a verification, an escrow release, and a reputation
delta. This memo is the prose version of what `client_zero_demo.py` prints. The
parallel MoverOS lane runs the *same* primitive in its own demo (see §4) — its
artifacts are kept out of this Client Zero memo on purpose.

## 2. The loop

```
  action  ->  proof event  ->  verification  ->  escrow release  ->  reputation delta
 (deliver)   (likely_inf.)    (verified_fact)   (only on verified)   (+1 on verified)
```

The hinge is verification: nothing releases escrow or moves reputation until a
proof event reaches `evidence_tag = verified_fact`.

## 3. Client Zero lane (dealership / Auto Growth OS) — canonical

Client Zero is the dealership growth workflow: an Auto Growth OS agent re-engages a
stale sales lead and books a confirmed appointment.

| Step | Actor | What happens | Ledger / proof effect |
|------|-------|--------------|-----------------------|
| 1. Propose | tenant `tenant:dealership-zero` | Dealership commissions "rescue this lead, book an appointment" | `economy.work_order.proposed.v1` |
| 2. Accept | agent `agent:lead-rescue` | Agent accepts; escrow funded from tenant | credits → escrow; `…accepted.v1` |
| 3. Deliver | agent | Agent reports the booking; recorded as a **claim** | proof `likely_inference`; `…delivered.v1` |
| 4. Verify | verifier `verifier:appointment-confirmed` | Appointment confirmed against acceptance criteria | proof `verified_fact` (supersedes claim); escrow → agent; reputation **+1**; `…verified.v1` |

If verification fails at step 4, escrow is **refunded** to the dealership, no
reputation is granted, and the loop ends `rejected` — the sandbox proves both
branches.

## 4. Parallel MoverOS lane (cross-reference only — kept separate)

The same shared primitive backs the **MoverOS** moving-company lane, but its
scenario, refs, and claims live in a **separate file** so the two lanes never mix.
Run the Client Zero (dealership) lane on its own:

```bash
python -m sandbox.agent_economy.client_zero_demo
```

The MoverOS lane (labeled **Tenant Zero / MoverOS** as a sandbox scenario; would be
**Client One / MoverOS** only if promoted to a real pilot, which is not done here)
has its own demo:

```bash
python -m sandbox.agent_economy.tenant_zero_moveros_demo
```

Each demo prints, for its own lane only: the proof events (claim → verified_fact),
the append-only action ledger, the escrow release, and the reputation delta — with
a balanced ledger and zero network/DB/chain calls and no real prospect data. The
shared, lane-neutral runner is `sandbox/agent_economy/proof_loop.py`; lane identity
stays with the caller.

## 5. Why each guardrail holds in the loop

| Concern | Why it cannot happen |
|---------|----------------------|
| Paying an agent for unverified work | Escrow releases **only** against a `verified_fact` proof (`test_escrow_release_requires_verified_fact_proof`) |
| Reputation inflation | Positive delta requires `verified_fact` (`test_no_gain_without_verified_fact`) |
| Lost/duplicated credits | Double-entry + idempotency; `is_balanced()` checked each step |
| Any token surface | `assert_no_public_token_surface()` runs before the loop starts |

## 6. Expected trace (abbreviated)

```
[1-2] WO-1 accepted; escrow holds 20 credits
[3]   delivered; proof PRF-1 tag=likely_inference
[4]   verified; proof PRF-2 tag=verified_fact (supersedes PRF-1)
--- result ---
agent credits: 20 | escrow: 0 | reputation: 1 | ledger balanced: True
```

## 7. Verification

```bash
python -m sandbox.agent_economy.client_zero_demo
python -m unittest sandbox.agent_economy.test_economy_sandbox.WorkOrderLoopTests -v
```
The happy path and the rejected path are both covered
(`test_happy_path_releases_escrow_and_reputation`,
`test_rejected_refunds_escrow_no_reputation`).
