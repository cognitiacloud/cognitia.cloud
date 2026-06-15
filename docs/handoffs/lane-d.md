# Lane D — AI-Assisted Drafting Under Governance (Handoff)

**Status:** delivered (skill v0.1.0)
**Skill:** `hermes/skills/drafting-skill/`
**Branch:** `claude/ai-drafting-governance-9jdhkd`

## What Lane D delivers

An LLM-backed outreach **drafting** layer that augments deterministic
templates while preserving the approval-first safety model. It produces draft
_data only_ and never sends anything. Concretely:

- **Provider abstraction** with auto-routing (Anthropic-first) and a
  deterministic-template fallback — `drafting_skill.py`.
- **Prompt assembly** from an operator-governed config (`drafting_config.yaml`).
- **Model selection/config** via env vars (per-provider model overrides).
- **Output validation & shaping** — structural + safety checks; hard failures
  force the deterministic fallback.
- **Audit metadata** on every draft (provider, model, prompt id/version, config
  version, skill version, timestamp, source, fallback reason).
- **Typed `DraftEnvelope`** interface for the approval-queue UI preview.
- **Tests** for failure fallback, unsafe-output fallback, and the no-side-effect
  invariants (`test_drafting_skill.py`, 20 tests, fully offline).

## The governance guarantee

**Human approval remains mandatory before any side effect**, enforced
structurally rather than by convention:

1. The skill exposes **no sender** — no SMTP, no message-API POST, nothing that
   transmits. Verified by `test_no_sender_symbols_exist` and by `grep`.
2. Generation only ever emits `status: "pending_approval"`. No code path can
   reach an `approved`/`sent` state — verified by `test_status_is_only_pending`.
3. Generation has **no side effects** beyond returning data. It writes a file
   only when the caller passes `output_json_path` — verified by
   `test_no_file_written_without_path` / `test_file_written_only_when_requested`.
4. Existing trust guarantees are preserved: the change is purely additive
   (a new skill directory); `vision-skill` and its read-only guarantees are
   untouched.

## Config / env requirements

All variables are **blank/unset by default**. With nothing configured, the
skill auto-degrades to deterministic `template` mode — no network, no keys.

| Variable                        | Purpose                                                                        | Default                       |
| ------------------------------- | ------------------------------------------------------------------------------ | ----------------------------- |
| `HERMES_DRAFT_PROVIDER`         | Force provider: `anthropic`/`openai`/`gemini`/`openrouter`/`ollama`/`template` | auto                          |
| `ANTHROPIC_API_KEY`             | Selects Anthropic (priority 1)                                                 | —                             |
| `HERMES_DRAFT_ANTHROPIC_MODEL`  | Anthropic model                                                                | `claude-sonnet-4-6`           |
| `OPENAI_API_KEY`                | Selects OpenAI (priority 2)                                                    | —                             |
| `HERMES_DRAFT_OPENAI_MODEL`     | OpenAI model                                                                   | `gpt-4o-mini`                 |
| `GOOGLE_API_KEY`                | Selects Gemini (priority 3)                                                    | —                             |
| `HERMES_DRAFT_GEMINI_MODEL`     | Gemini model                                                                   | `gemini-1.5-flash`            |
| `OPENROUTER_API_KEY`            | Selects OpenRouter (priority 4)                                                | —                             |
| `HERMES_DRAFT_OPENROUTER_MODEL` | OpenRouter model                                                               | `anthropic/claude-3.5-sonnet` |
| `OLLAMA_BASE_URL`               | Local Ollama (priority 5, used if reachable)                                   | `http://127.0.0.1:11434`      |
| `HERMES_DRAFT_OLLAMA_MODEL`     | Ollama model                                                                   | `llama3.1`                    |
| `HERMES_DRAFT_CONFIG`           | Path to an alternate `drafting_config.yaml`                                    | bundled file                  |

Runtime dependency: **PyYAML** (`requirements.txt`). LLM calls use stdlib
`urllib`; no provider SDKs are required. `mcp` is optional (MCP server mode).

## Traceability (audit)

Every draft carries an `audit` block making the prompt/model/version traceable:

- `prompt_id` — the template key used.
- `prompt_version` — `sha256` of the fully assembled system+user prompt.
- `config_version` — `sha256` of `drafting_config.yaml` bytes (governance
  changes are traceable).
- `model` / `provider` — exactly what produced the copy.
- `source` — `"llm"` or `"template"`; `fallback_reason` / `provider_error`
  explain any degradation.

## Typed interface for UI preview — `DraftEnvelope`

Defined as a `TypedDict` in `drafting_skill.py`; full JSON schema in the skill
README. Shape the approval-queue UI should bind to:

```jsonc
{
  "draft_id": "string",
  "status": "pending_approval",
  "channel": "email | linkedin",
  "subject": "string",
  "body": "string",
  "call_to_action": "string",
  "personalization_notes": "string",
  "recipient_ref": "string", // opaque caller ref, no PII required
  "issues": ["string"], // validation warnings for the reviewer
  "audit": {
    "provider": "string",
    "model": "string|null",
    "prompt_id": "string",
    "prompt_version": "string",
    "config_version": "string",
    "skill_version": "string",
    "generated_at": "ISO-8601 UTC",
    "source": "llm | template",
    "fallback_reason": "string|null",
    "provider_error": "string|null",
  },
}
```

## Integration points with the approval queue UI

The approval queue does not exist in this repo yet; these are the seams for
whoever builds it. The drafting skill is deliberately the _generation_ half
only.

1. **Generate → enqueue.** Call `draft_outreach_message(template_key, context)`.
   It returns a `DraftEnvelope` with `status: "pending_approval"`. The queue
   stores it as-is; the skill never enqueues, sends, or mutates anything.
2. **Render preview.** The UI binds to `DraftEnvelope`: show
   `subject` / `body` / `call_to_action`, surface `issues` prominently (these
   are governance warnings), and show the `audit` block for traceability
   (which model/prompt/config produced this).
3. **Human edits → re-validate.** When a reviewer edits the draft, call
   `draft_validate_draft(editedDraft)` to re-check it against the same
   governance rules (banned phrases, secrets, links, length) before the
   approve action is enabled.
4. **Approve → send is OUT of scope here.** The queue is the **only** component
   permitted to transition a draft to approved/sent and to invoke a real
   sender. The drafting skill exposes no sender by design — keep it that way to
   preserve the guarantee. A future sender lane should accept an already
   _approved_ envelope and live behind the queue's approval gate, never call the
   drafting skill's output directly into a send.
5. **Deterministic preview / offline.** `draft_render_template(template_key,
context)` gives a networkless, always-safe preview (useful for UI tests and
   for showing operators what the fallback looks like).

## Verifying "no side effects"

```bash
cd hermes/skills/drafting-skill
pip install -r requirements.txt
python3 -m unittest test_drafting_skill.py -v   # 20 tests, offline, all green
```

Relevant guards:

- `test_no_sender_symbols_exist` — asserts the module contains no
  `smtplib`/`sendmail`/`send(` constructs.
- `test_no_file_written_without_path` — generation writes nothing unless asked.
- `test_status_is_only_pending` — status invariant across template, LLM-valid,
  and fallback paths.
- `test_provider_error_falls_back_to_template` and the
  `UnsafeOutputFallbackTests` group — provider failures and unsafe LLM outputs
  both degrade to the deterministic template.

## Extending without weakening governance

- **New templates / channels:** add entries under `templates:` in
  `drafting_config.yaml`. Each must be a complete deterministic draft so it can
  serve as its own fallback.
- **Tighter safety:** extend `banned_phrases` / `allowed_link_hosts`, or add
  checks in `_validate_and_shape`. Hard checks should return `safe=False` to
  force fallback.
- **Do not** add sending, posting, or any approval-state transition to this
  skill. Those belong behind the approval queue.
