# Dispute Replay Pack

The **Dispute Replay Pack** is a self-contained, hash-verifiable bundle that reconstructs a single
agent-driven **GTM (go-to-market) action** — drafting outreach, generating content, scoring a lead,
writing back to a CRM, sending an email — so it can be inspected after the fact for **audit**,
**client review**, or **dispute**. Given any `action_id`, Cognitia can produce a pack that shows
exactly what the agent saw, which policy and approval governed it, what it produced, and what it
wrote where — and lets a reviewer independently verify that none of it has been altered.

A replay pack is **evidentiary, not adjudicative**. It assembles and proves the record of what
happened. It does not decide who is right, assign fault, or state a legal conclusion. Interpretation
is left to the humans (clients, reviewers, counsel) who read it.

## Scope & Non-Goals

In scope: deterministic reconstruction and integrity-proofing of one already-executed agent action.

Explicit non-goals:

- **No legal conclusions.** The pack presents evidence and integrity checks only. It never
  adjudicates liability, breach, or remedy.
- **No production dispute marketplace.** There is no matching, bidding, arbitration venue, or
  multi-party dispute workflow here — this document covers reconstruction of an action, nothing more.
- **No token / escrow implementation.** No on-chain settlement, no staking, no economic incentive
  mechanism. Hashes in this design are integrity checksums, not blockchain artifacts.

## Replay bundle structure

A pack is a content-addressed directory. Every file is hashed; the hashes are recorded in
`manifest.json`; and the manifest itself is hashed into a single top-level `pack_hash`. Verifying
the pack means re-hashing each file, comparing against the manifest, then re-hashing the manifest.

```
replay-pack/
├── manifest.json            # index + per-file hashes + pack_hash
├── action/
│   ├── trigger.json         # what initiated the action, by whom/what
│   ├── input_context.json   # prompts, retrieved records, tool calls + responses
│   └── timeline.json        # ordered, timestamped event log
├── policy/
│   └── policy_snapshot.json # frozen governing policy, as of action time
├── approval/
│   └── approval_snapshot.json
├── output/
│   ├── generated_output.*   # exact bytes the agent produced
│   └── output_hash.json     # hash + linkage to inputs/policy
├── writeback/
│   └── writeback_result.json
├── proof/
│   └── proof_report.md      # human-readable rollup (also proof_report.html)
└── redaction/
    └── redaction_map.json   # verifiable record of what was scrubbed
```

`manifest.json` skeleton:

```json
{
  "pack_id": "rp_01HF9...",
  "action_id": "act_01HF8...",
  "created_at": "2026-06-21T14:02:11Z",
  "cognitia_version": "2026.06.0",
  "hash_algo": "sha256",
  "files": [
    { "path": "action/trigger.json",        "sha256": "9f2c..." },
    { "path": "action/input_context.json",   "sha256": "1ab7..." },
    { "path": "policy/policy_snapshot.json",  "sha256": "c40d..." },
    { "path": "approval/approval_snapshot.json", "sha256": "77e1..." },
    { "path": "output/generated_output.md",   "sha256": "be03..." },
    { "path": "writeback/writeback_result.json", "sha256": "5d9a..." }
  ],
  "pack_hash": "sha256:e7d1...over the canonicalized file index"
}
```

The `pack_hash` is computed over the canonicalized (sorted-key, normalized-whitespace) file index so
the same pack always produces the same hash regardless of how it was serialized.

## Required evidence

A pack is only useful if it is **complete enough to replay** — a reviewer can read it and understand
the full causal chain without consulting any live system. The following artifacts are mandatory; a
pack missing any of them is marked `incomplete` in the proof report rather than silently shipped.

| Artifact | Captured in | What it answers |
|----------|-------------|-----------------|
| Trigger / initiator | `action/trigger.json` | Who or what started this — user, schedule, upstream event — and the request that kicked it off |
| Agent & model identity | `action/trigger.json` | Which agent, which model + version, which prompt template version |
| Input context | `action/input_context.json` | Every prompt, every retrieved record, every tool call and its response — the full set the agent acted on |
| Timeline | `action/timeline.json` | Ordered, timestamped events from trigger to writeback |
| Environment pins | `manifest.json` + `trigger.json` | `cognitia_version`, dependency/config versions in effect |
| Output | `output/generated_output.*` | The exact bytes the agent produced |
| Policy snapshot | `policy/policy_snapshot.json` | The rules that governed the action |
| Approval snapshot | `approval/approval_snapshot.json` | The authorization that let it proceed |
| Writeback result | `writeback/writeback_result.json` | What was pushed externally and the receipt |

"Complete enough to replay" means: inputs + policy + approval + output + writeback are all present
and their hashes verify. It does **not** guarantee byte-identical regeneration of the output — see
[What cannot be reconstructed](#what-cannot-be-reconstructed).

## Policy snapshot

`policy/policy_snapshot.json` is a **frozen copy** of the governing policy exactly as it existed at
action time — the rules, guardrails, thresholds, allowed actions, and required-approval conditions
that applied to this agent for this action.

A snapshot is required rather than a live pointer because policies change. If the pack merely
referenced "policy v-current," a later policy edit would silently rewrite history and the
reconstruction would no longer reflect what actually governed the action. The snapshot records the
`policy_id`, a `policy_version` and `version_hash`, and the full rule body.

```json
{
  "policy_id": "pol_outbound_email",
  "policy_version": "14",
  "version_hash": "sha256:c40d...",
  "effective_at": "2026-05-30T00:00:00Z",
  "captured_at": "2026-06-21T14:02:09Z",
  "rules": {
    "max_daily_sends_per_contact": 1,
    "blocked_domains": ["..."],
    "requires_human_approval_when": ["deal_value > 50000", "audience > 500"],
    "tone_guardrails": ["no_unverifiable_claims", "no_legal_advice"]
  }
}
```

## Approval snapshot

`approval/approval_snapshot.json` captures the authorization that let the action proceed, frozen at
action time. Approval may be a **human** decision or an **autonomous-approval rule** that the action
satisfied — both are recorded the same way.

```json
{
  "approval_id": "apr_01HF8...",
  "mode": "human",
  "approver": { "id": "usr_22", "display": "[REDACTED:approver]", "role": "gtm_lead" },
  "autonomous_rule": null,
  "state": "approved",
  "scope": { "action_types": ["send_email"], "audience_max": 200, "expires_at": "2026-06-21T18:00:00Z" },
  "decided_at": "2026-06-21T13:58:40Z"
}
```

For autonomous approvals, `mode` is `"autonomous"`, `approver` is null, and `autonomous_rule`
records the policy rule id and the evaluated condition that granted authorization. The `scope`
bounds what the approval actually permitted, so a reviewer can confirm the action stayed inside it.

## Generated output hash

`output/output_hash.json` records the SHA-256 of the **exact bytes** the agent produced
(`output/generated_output.*`), computed before any downstream transformation. It also records the
linkage that binds the output to its causes — the input-context hash and the policy-snapshot hash —
so the chain *inputs → policy → output* is provable as a unit.

```json
{
  "output_file": "output/generated_output.md",
  "output_sha256": "be03...",
  "produced_at": "2026-06-21T14:01:55Z",
  "links": {
    "input_context_sha256": "1ab7...",
    "policy_snapshot_sha256": "c40d...",
    "approval_snapshot_sha256": "77e1..."
  }
}
```

This is the artifact a client compares against the message they actually received: if the bytes
match, the output in the pack is provably the output that was generated.

## Writeback result

`writeback/writeback_result.json` records the outcome of pushing the action into an external system
of record (CRM, email provider, calendar, messaging). It captures the target, the request that was
sent (redacted), the response/receipt, success or failure, and the external record id.

```json
{
  "target_system": "hubspot",
  "operation": "create_engagement",
  "request_payload_redacted": { "to": "[EMAIL_REDACTED]", "subject": "...", "body_ref": "output/generated_output.md" },
  "response": { "status": "200", "external_id": "eng_99812", "receipt_at": "2026-06-21T14:02:03Z" },
  "result": "success",
  "idempotency_key": "act_01HF8..."
}
```

Caveats recorded alongside the result:

- **External side effects are real and not reversible by the pack.** The pack proves *what was sent*
  and *what the receipt said*; it cannot undo a sent email or un-create a CRM record.
- **Idempotency.** The `idempotency_key` ties retries to a single logical writeback so a reviewer can
  tell a retry from a duplicate action.
- **External mutation after the fact.** The receipt is a point-in-time snapshot; the external record
  may have changed since. The pack proves the writeback, not the system's current state.

## Proof report

`proof/proof_report.md` (and an `.html` render) is the human-readable rollup that ties the chain
together for a client or auditor who will not read raw JSON. It contains:

- **Action summary** — what the agent did, when, triggered by whom, under which agent/model version.
- **Integrity table** — each artifact with its expected hash and a **verified / FAILED** status from
  re-hashing the file in the pack.
- **Policy & approval at-a-glance** — the governing rules and the authorization (human or
  autonomous), with timestamps and scope.
- **Writeback summary** — target system, result, external id, receipt time.
- **Overall integrity check** — a single **PASS / FAIL**: PASS only if every file hash verifies, the
  manifest re-hashes to `pack_hash`, and no required artifact is missing.
- **Disclosed limits** — an explicit pointer to what could not be reconstructed for this action.

The proof report states facts and integrity status only. It does not opine on whether the action was
correct, appropriate, or compliant — that judgment belongs to the reader.

## Redaction rules

Packs frequently contain PII and secrets (recipient emails, phone numbers, API keys in tool logs,
financial identifiers). Cognitia reuses the redaction philosophy already established in the
`hermes-vision` skill (`hermes/skills/vision-skill/vision_skill.py`, `_redact()`): sensitive values
are scrubbed **before** anything is written to the pack, never after.

Scrubbed classes (mirroring the vision skill's patterns):

- **Emails** → `[EMAIL_REDACTED]`
- **Secrets / keys / tokens** (Anthropic, OpenAI, Google, Slack, GitHub, AWS, JWTs, HuggingFace,
  GitLab, private-key blocks) → `[KEY_REDACTED]`
- **Financial identifiers** (card-like numbers, routing/account numbers) → `[FIN_REDACTED]`
- **Approver / personal identity fields** → `[REDACTED:<role>]`, keeping the role but not the person

Redaction must not break provability. Each redacted value is recorded in
`redaction/redaction_map.json` as a **placeholder hash** — the SHA-256 of the original value (with a
per-pack salt) — so that:

- a redacted pack still verifies as a complete, untampered bundle, and
- an authorized reviewer who already holds a candidate original value can confirm it matches the
  redacted field by re-hashing it, without the pack ever storing the cleartext.

```json
{
  "salt_id": "redsalt_01HF8...",
  "entries": [
    { "path": "writeback/writeback_result.json#/request_payload_redacted/to", "class": "email", "placeholder_sha256": "a91f..." },
    { "path": "approval/approval_snapshot.json#/approver/display", "class": "identity", "placeholder_sha256": "0c83..." }
  ]
}
```

## What cannot be reconstructed

The pack is honest about its boundaries. It is a record of what happened, not a time machine. Known
limits, surfaced in every proof report:

- **Non-deterministic model output.** Re-running the same prompt may not reproduce identical bytes
  (sampling, temperature, model-side changes). The pack proves the **stored** output, not that it is
  regenerable.
- **Mutated or deleted upstream records.** If a source record the agent read was later changed or
  deleted, only the captured copy in `input_context.json` survives; the live source cannot be
  recovered through the pack.
- **Live external state at writeback time.** The writeback receipt is point-in-time. The external
  system's state then, and now, may differ; the pack cannot reconstruct the broader system state.
- **Third-party content behind expired links.** External URLs, attachments, or references that were
  not captured inline may no longer resolve.
- **Anything never captured.** Out-of-band human conversations, side-channel context, or any signal
  that did not flow through the instrumented path is simply absent — and the pack says so rather than
  implying completeness.

## Client Zero acceptance criteria

The first design-partner client ("Client Zero") must be able to verify the following, unaided, for
**any** action they question:

- [ ] Given an `action_id`, a replay pack is **producible** on demand.
- [ ] Every file hash in `manifest.json` **re-verifies**, and the manifest re-hashes to `pack_hash`.
- [ ] The **policy snapshot** is present, versioned, and dated at-or-before the action time.
- [ ] The **approval snapshot** is present, dated, and shows mode (human or autonomous) and scope.
- [ ] The **generated output** in the pack hashes to the bytes the client actually received.
- [ ] The **writeback result** is present with target system, result, external id, and receipt time.
- [ ] The **proof report** renders for a non-technical reviewer and shows an overall **PASS/FAIL**.
- [ ] Redaction passes a **leak check** — no email, key, token, or financial pattern survives in
      cleartext anywhere in the pack — while redacted values remain verifiable via the redaction map.
- [ ] The pack **discloses its reconstruction limits** rather than implying completeness.
- [ ] No section of the pack states a legal conclusion or assigns fault.

## Safety & Non-Goals (recap)

- The replay pack is **evidentiary, not adjudicative** — it proves the record; it does not judge it.
- **No production dispute marketplace** is in scope.
- **No token / escrow / on-chain settlement** is implemented; hashes here are integrity checksums.
- Redaction runs **before** storage, and the pack never persists scrubbed cleartext.
