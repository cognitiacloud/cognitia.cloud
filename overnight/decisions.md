# Decisions

- 2026-06-14T10:45:51Z DSAR erasure = ANONYMIZE contact PII (not hard delete): preserves the
  append-only audit chain + action/event referential meaning, while removing the
  data subject's personal data. Audit chain never stored raw PII, so it stays
  intact and verifiable. Erasure is itself recorded as an audit event.
- 2026-06-14T10:45:51Z Anchoring sink default = NO-OP/in-memory; external sink is a documented
  seam wired by the operator. Will NOT claim external anchoring is provisioned.
