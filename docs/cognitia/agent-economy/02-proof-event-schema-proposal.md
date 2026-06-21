# Memo 2 — Proof Event Schema Proposal

**Status:** sandbox design · internal only
**Boundaries:** no public token, no chain, no legal conclusions. Proof events are
internal accounting/audit records, not attestations of legal fact.

## 1. Purpose

Define the **proof event** — the unit that records *what an agent claims to have
done* and *how strongly that claim is backed*. Everything downstream (escrow
release, reputation) keys off the proof event's `evidence_tag`. This is presented
as a **contract/view over the existing `proofs` table** (sibling-branch
vocabulary, *not verified in this branch HEAD*), not as a competing table.

## 2. Core principle: evidence is tagged, never assumed

Every proof event carries an `evidence_tag` from a closed enum:

| `evidence_tag` | Meaning | Can release escrow / grant reputation? |
|----------------|---------|----------------------------------------|
| `verified_fact` | Independently checked against acceptance criteria | **Yes** |
| `likely_inference` | Plausible but unverified worker claim | No |
| `unknown` | Insufficient basis to judge | No |

A bare delivery is recorded as `likely_inference`. It only becomes
`verified_fact` when a verifier checks it. This is the single gate the whole
economy leans on.

## 3. Schema (contract over `proofs`)

| Field | Type | Notes |
|-------|------|-------|
| `proof_id` | string (PK) | Stable id, e.g. `PRF-1` |
| `subject_ref` | string | Internal ref the proof is *about* (order/agent ref) |
| `claim` | string | Human-readable claim text |
| `evidence_tag` | enum | `verified_fact \| likely_inference \| unknown` |
| `evidence_ref` | string | Internal pointer to artifact (`internal://...`); never PII, never a URL to a third party |
| `verifier_ref` | string \| null | Set **only** when `evidence_tag = verified_fact` |
| `supersedes` | string \| null | `proof_id` this corrects; corrections append, never mutate |
| `created_seq` | int | Monotonic append order |

### Invariants

1. **Append-only.** Proof events are immutable once written (frozen records in
   the sandbox; `INSERT`-only against `proofs`). Corrections are *new* events that
   set `supersedes`.
2. **`verified_fact` requires a `verifier_ref`.** A verified claim must name who
   verified it. The sandbox enforces this in `ProofRegistry.record()`.
3. **No silent upgrades.** A `likely_inference` proof is never edited into a
   `verified_fact`; a new superseding event is appended instead.

## 4. JSON example

```json
{
  "proof_id": "PRF-2",
  "subject_ref": "WO-1",
  "claim": "delivered outcome verified against acceptance criteria",
  "evidence_tag": "verified_fact",
  "evidence_ref": "internal://artifact/123",
  "verifier_ref": "verifier:appointment-confirmed",
  "supersedes": "PRF-1",
  "created_seq": 2
}
```

## 5. DDL sketch (additive, aligned to `proofs` — illustrative only)

```sql
-- Illustrative only. NOT a migration in this branch. Aligns to the existing
-- `proofs` table (sibling branch); shown to demonstrate forward-compatibility.
-- evidence_tag enum already exists per migration 0009 (unverified in this HEAD).
CREATE TABLE IF NOT EXISTS proofs (
    proof_id      TEXT PRIMARY KEY,
    subject_ref   TEXT NOT NULL,
    claim         TEXT NOT NULL,
    evidence_tag  TEXT NOT NULL
                  CHECK (evidence_tag IN ('verified_fact','likely_inference','unknown')),
    evidence_ref  TEXT,
    verifier_ref  TEXT,
    supersedes    TEXT REFERENCES proofs(proof_id),
    created_seq   BIGSERIAL,
    -- a verified_fact MUST name its verifier
    CHECK (evidence_tag <> 'verified_fact' OR verifier_ref IS NOT NULL)
);
-- append-only: no UPDATE/DELETE grants; corrections INSERT with supersedes set.
```

## 6. Proof-registry event types (for the action ledger — see Memo 3)

| Event type | Emitted when |
|------------|--------------|
| `economy.proof.recorded.v1` | Any proof event is appended |
| `economy.proof.superseded.v1` | A proof event sets `supersedes` |
| `economy.proof.verified.v1` | A `verified_fact` proof is appended |

## 7. Sandbox mapping

| Concept | Sandbox object |
|---------|----------------|
| Proof event | `ProofEvent` (frozen dataclass) |
| Registry | `ProofRegistry.record()` / `.all()` |
| Tag enum | `EvidenceTag.VERIFIED_FACT / LIKELY_INFERENCE / UNKNOWN` |
| Supersession | `supersedes` field; `test_supersession_appends_not_mutates` |

## 8. Verification

```bash
python -m unittest sandbox.agent_economy.test_economy_sandbox.ProofRegistryTests -v
```
Asserts immutability and that supersession appends rather than mutates.
