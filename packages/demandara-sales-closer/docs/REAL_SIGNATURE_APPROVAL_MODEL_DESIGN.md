# V2-1 Real-Signature Approval Model Design

**Status:** design only. No secrets, no live auth, no credential implementation.

## Goal
Move from local-demo approval receipt binding to controlled-live approval authenticity where a writeback can only occur after a verifiable human reviewer signs the approval decision.

## Reviewer identity
- Reviewer has stable `reviewer_id`, role, tenant scope, and active/disabled status.
- Reviewer identity is resolved by an approved identity provider later; not implemented in this local package.
- Approval payload must include `reviewer_id`, `tenant`, `lead_id`, `decision`, `approval_event_source`, `issued_at`, `expires_at`, `nonce`, and policy version.

## Key custody
- Private signing keys never live in repo, fixtures, logs, browser local storage, or demo artifacts.
- Keys belong in managed key custody: HSM/KMS or an approved signing service.
- Local development uses unsigned fixtures only; no fake production keys.

## Signature verification
- Verification checks canonical JSON payload, signature algorithm, key id, reviewer status, tenant scope, expiration, nonce uniqueness, and policy version.
- Verification must fail closed: missing signature, unknown key id, revoked reviewer, expired approval, tenant mismatch, replayed nonce, or payload tamper all block writeback.

## Revocation
- Reviewer deactivation revokes future approvals immediately.
- Key revocation invalidates future signatures and optionally flags historical signatures for review.
- Emergency revocation list must be consulted before writeback.

## Audit trail
- Store hash of lead fixture/input, approval payload hash, signature verification result, reviewer id, key id, policy version, and mock/live adapter boundary.
- Never store raw secrets or private keys.
- Receipt should prove decision path without exposing PII beyond approved demo-safe fields.

## Replay prevention
- Approval payload includes nonce and expiry.
- Nonce ledger is checked before writeback; reused nonce fails closed.
- Receipt binds nonce and payload hash so copied approvals cannot authorize another lead.

## Failure modes
| Failure | Required behavior |
|---|---|
| missing signature | deny writeback |
| invalid signature | deny writeback |
| revoked reviewer/key | deny writeback |
| tenant mismatch | deny writeback |
| expired approval | deny writeback |
| replayed nonce | deny writeback |
| audit ledger unavailable | deny controlled-live writeback; local demo may continue only as mock |

## Controlled-live gate
Controlled-live remains blocked until this design is implemented, tested, independently audited, and approved by Muhammad.
