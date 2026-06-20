# Agent Economy Proof Layer — Spec

> **NO CASH VALUE. INTERNAL SANDBOX ONLY.** The proof layer attests *what an
> agent did*. It NEVER attests value, price, redeemability, or investment return.
> All credits referenced are non-monetary internal units (see other artifacts).

**Worker:** D — Agent Economy + Token Sandbox · **Date:** 2026-06-20
**Tags:** VERIFIED / INFERRED / RECOMMENDED / UNSAFE

---

## 1. What the proof layer is for

The proof layer produces **attestations**: signed/log-backed statements that
"agent X performed action Y, producing evidence Z, verified by V". It is the
trust substrate that authorizes `PRF` issuance and `TRP` updates in the ledger.

It answers: *did it happen, and can we show our work?*
It must NOT answer: *is it worth money / will it appreciate / can I cash it out?*

---

## 2. Claim structure (RECOMMENDED)

A **Claim** is the assertion to be attested:

```
Claim {
  claim_id:        string
  subject:         account_id        // who acted, e.g. agent:ACME
  predicate:       enum              // did_complete | did_call | did_produce
  object:          string            // task:demo-001 / tool:web_search / artifact ref
  action_record_id: FK               // links to the metered ActionRecord
  asserted_at:     timestamp
  asserted_by:     role              // system role, not a marketing voice
}
```

A Claim is a *proposal*. It carries **no trust** until an attestation verifies it.

---

## 3. Evidence / attestation model (RECOMMENDED)

```
Attestation {
  attestation_id:    string
  claim_id:          FK
  evidence_type:     enum   // exec_log | output_hash | tool_receipt | signed_record
  evidence_hash:     string // SHA-256 of the underlying log/output (NO raw PII)
  evidence_pointer:  string // internal storage ref to the full evidence
  method:            enum   // log_replay | hash_match | deterministic_recheck | signature
  status:            enum   // pending | verified | rejected
  verifier:          role
  verified_at:       timestamp nullable
  notes:             string // NO PII
}
```

**Evidence tiers (INFERRED):**
1. **Log-backed** — execution log shows the action occurred (timestamps, tool
   I/O hashes). Strongest cheap option.
2. **Hash-match** — output hash matches expected/recorded hash → tamper-evident.
3. **Signature** — a system signer attests the record; verifiable via key.
4. **Deterministic recheck** — re-run a pure check and compare. (only for
   deterministic actions.)

> **INFERRED** analogy to build/supply-chain attestation (claim + evidence +
> verification status). Not independently fetched this loop → tagged INFERRED.

---

## 4. Verification → ledger/trust effects

```
verify(attestation):
  if evidence valid under `method`:
     status = verified
     emit ProofRecord(verification_status=verified)
     -> ledger issues PRF (balanced txn: SYSTEM:PROOF -> agent)
     -> TrustScore.recompute(+verified)
  else:
     status = rejected
     emit ProofRecord(verification_status=rejected)
     -> NO PRF issued
     -> TrustScore.recompute(+rejected)   // lowers TRP
```

Only **verified** attestations move credits/trust. Pending and rejected do not.

---

## 5. VERIFIED attestation vs. UNSAFE marketing claim

This is the core safety distinction of the proof layer.

| ✅ VERIFIED attestation (allowed) | ❌ UNSAFE claim (forbidden) |
|---|---|
| "agent:ACME completed task:demo-001; exec_log hash 0xabc…; verified 2026-06-20." | "Our agents are the best in the industry." |
| "Action ar-100 produced output with hash matching the expected result." | "This credit will appreciate / is worth $X." |
| "ACME has 14 verified proofs, 0 rejected (TRP +14) over 30 days." | "Guaranteed ROI / guaranteed lead volume / guaranteed ranking." |
| "PRF balance reflects 14 internally-attested units of completed work (no cash value)." | "Redeem your credits for cash / tokens / equity." |
| "Evidence is log-backed and reconstructable." | "Verified = endorsed/certified/regulated." |

**Rule (RECOMMENDED):** an attestation may only state *facts traceable to an
evidence_hash + method*. Anything not so traceable is, at best, a marketing
claim and is **UNSAFE** to publish as a "proof".

---

## 6. What the proof layer MUST NOT assert (UNSAFE)

- **UNSAFE** — That any credit/balance has monetary value or is redeemable.
- **UNSAFE** — Any appreciation, yield, ROI, or investment outcome.
- **UNSAFE** — Guarantees of business results (sales, leads, rankings,
  financing approval) — hard-stop boundary #9 in GUARDRAILS.
- **UNSAFE** — Endorsement/certification/regulatory-compliance language unless
  separately and explicitly backed (it is not, here).
- **UNSAFE** — Any claim containing real PII (use synthetic refs + hashes only).
- **UNSAFE** — External, public, or investor-facing publication of attestations
  as value signals. Parked pending founder + legal sign-off.

---

## 7. Verification properties (RECOMMENDED)

1. **Traceability:** every published attestation links to `evidence_hash` +
   `method` + `action_record_id`.
2. **Tamper-evidence:** hashes let any reviewer detect altered evidence.
3. **Non-repudiation (optional):** signature-tier attestations bind to a signer.
4. **Conservative default:** unknown/unverifiable → `pending`/`rejected`, never
   `verified`. Fail closed.
5. **Separation:** proof layer can issue `PRF` and adjust `TRP` but has **no**
   path to create value, transfer externally, or redeem.

---

## 8. Open items (RECOMMENDED / parked)

- **RECOMMENDED:** decide the canonical evidence store + hashing scheme with
  Worker E (harness) so ActionRecords emit hashes at execution time.
- **UNSAFE — DO NOT DO YET:** any external/public attestation feed, any
  cross-tenant proof sharing as a value signal — needs founder + legal sign-off.
