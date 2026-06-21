# Policy & Permission Contract — Hermes Vision Spine (W7)

This is a **contract**, not yet an enforcement layer. It states the permission
model, the mock/live boundary rule, the forbidden-surface denylist, and the
audit record the spine is expected to honour. Items marked _(placeholder)_ are
specifications for a later wave; the structural read-only guarantees are enforced
today by `test_enterprise_guard.py` and the `skill.yaml` safety flags.

## Capability model

The skill exposes exactly four capabilities, all **read-only inspection**:

| Capability (tool)          | Reads            | Writes | Network          |
|----------------------------|------------------|--------|------------------|
| `vision_analyze_image`     | one image        | none*  | provider (opt-in)|
| `vision_compare_portraits` | reference+cand   | none   | provider (opt-in)|
| `vision_privacy_scan`      | one image        | none   | **none** (OCR)   |
| `vision_video_frame_qc`    | one frame/video  | temp   | provider (opt-in)|

\* `vision_analyze_image` writes only when the caller passes an explicit
`output_json_path` (a local report file). No source asset is ever modified.

Structural guarantees (enforced by `skill.yaml` + guards):
`read_only`, `no_delete`, `no_post`, `no_unknown_uploads`, `redact_logs`.

## Mock / live boundary rule

1. **Default is mock-safe.** With no `*_API_KEY` set and `ocr_only` selected, the
   spine performs zero third-party egress.
2. **Live is opt-in and explicit.** A live vision provider is reached **only**
   when its credential is present in the environment, or `HERMES_VISION_PROVIDER`
   names it. Setting a credential is the privileged action; it is out of scope
   for any unprivileged caller.
3. **Airgapped configuration.** `HERMES_VISION_PROVIDER=ocr_only` guarantees no
   network call at all (proven by `MockSafeNoNetworkTests`). Use it for CI,
   batch, and any environment that must not egress.

_(placeholder)_ Future RBAC: only a `provider-admin` role may set provider
credentials; `analyst` roles may invoke the four tools; no role may introduce a
write/send capability (that is a code-review + CI concern, see below).

## Forbidden-surface denylist (authoritative)

The first-wave spine must never gain a real outreach/send surface or a
heavyweight live-vendor SDK. `NoOutreachSurfaceTests` fails the build if any of
the following appear in `vision_skill.py`:

- Mail / messaging transports: `smtplib`, `sendmail`, `smtp.`, `imaplib`
- Outreach vendors: `twilio`, `sendgrid`, `mailgun`, `mailchimp`, `postmark`,
  `tweepy`, `slack_sdk`, `discord`, `telegram`, `praw`
- HTTP clients that bypass the urllib egress boundary: `requests`, `httpx`,
  `aiohttp`
- Cloud SDKs (live side effects): `boto3`, `google.cloud`, `azure.`
- Outreach-shaped call surfaces: `post_message`, `send_message`, `send_email`,
  `send_sms`, `webhook`, `publish_post`

Network egress is additionally **confined by AST** to the provider boundary
(`_call_openai/_anthropic/_gemini/_openrouter/_ollama`, `_ollama_reachable`) by
`EgressConfinementTests`. Any new `urlopen`/socket elsewhere fails the build.

## Audit record _(placeholder)_

Each tool invocation is expected to emit one structured, append-only record:

```
{ "ts": <iso8601>, "actor": <role|principal>, "tool": <name>,
  "provider": <selected provider>, "inputs_hash": <sha256 of paths>,
  "decision": <recommended_action|publish_safe>, "redacted": true }
```

Today only provider selection is logged (redacted). The structured record, its
sink, retention, and tamper-evidence are later-wave work. No secret or raw PII
may ever appear in an audit record — the redaction guarantee
(`_RedactingFilter`) is non-negotiable.

## Change-control

Weakening any safety flag in `skill.yaml`, moving `ocr_only` off the fallback
position, or adding a denylisted surface is a **breaking change**: it fails CI
and requires explicit human sign-off recorded in the PR. See RELEASE_CHECKLIST.md.
