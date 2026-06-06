# Datasets

Versioned eval input sets. Store **references and labels only** — never raw PII
(no raw emails, phone numbers, or transcripts). Use entity refs and hashes.

Example (reply-classification labels):

```json
[
  { "item_ref": "conversation:uuid", "expected": "unsubscribe" },
  { "item_ref": "conversation:uuid", "expected": "wrong_person" }
]
```
