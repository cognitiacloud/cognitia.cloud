# Hermes Drafting Skill

AI-assisted outreach drafting **under governance** for the Cognitia pipeline.

This skill turns a template key + recipient context into a structured outreach
**draft**. It does **not** send, post, or transmit anything. Every draft comes
back with `status: "pending_approval"` and full audit metadata so a human can
review it in the approval queue before any side effect occurs.

- An LLM provider writes the copy when one is configured.
- If no provider is configured, or the LLM output fails safety/structure
  validation, the skill falls back to a **deterministic template**.
- The deterministic path is always safe and needs no network access.

## Approval-first guarantee

Human approval is mandatory before any side effect. The guarantee is
structural, not just documentary:

- This module exposes **no sender** — no SMTP, no HTTP POST to a messaging API,
  nothing that transmits a message. (See `test_no_sender_symbols_exist`.)
- Generation only ever emits `status: "pending_approval"`. No code path can
  produce an `approved`/`sent` state.
- Generation has **no side effects** beyond returning data — it writes a file
  only when the caller explicitly passes `output_json_path`.

Transitioning a draft to approved/sent and invoking any real sender is the job
of the downstream approval queue, never this skill.

## Tools

| Tool | Purpose |
|------|---------|
| `draft_outreach_message(template_key, context, tone?, output_json_path?)` | Generate a draft (LLM with deterministic template fallback). Returns a `DraftEnvelope`. |
| `draft_validate_draft(draft)` | Re-validate a (possibly human-edited) draft against governance rules. Read-only verdict. |
| `draft_render_template(template_key, context)` | Deterministic, networkless render of a template (the safe fallback). |
| `draft_list_providers()` | Diagnostics: selected provider, routing priority, available templates. |

## CLI

```bash
# Diagnostics: which provider would be used, and what templates exist
python3 drafting_skill.py provider

# Generate a draft (falls back to deterministic template if no API key is set)
python3 drafting_skill.py draft --template intro_email \
  --context '{"recipient_ref":"r1","first_name":"Alex","company":"Acme"}'

# Deterministic render only (never calls an LLM)
python3 drafting_skill.py template --template linkedin_connect \
  --context '{"first_name":"Alex","company":"Acme"}'

# Re-check an edited draft before approval
python3 drafting_skill.py validate \
  --draft '{"subject":"Hi","body":"A short clean note.","call_to_action":"Chat?"}'
```

## Providers & configuration (env)

Providers are auto-selected in priority order; override with
`HERMES_DRAFT_PROVIDER`. **All env vars are blank/unset by default**, in which
case the skill auto-degrades to deterministic `template` mode with no network.

| Variable | Purpose | Default |
|----------|---------|---------|
| `HERMES_DRAFT_PROVIDER` | Force a provider (`anthropic`, `openai`, `gemini`, `openrouter`, `ollama`, `template`) | auto |
| `ANTHROPIC_API_KEY` | Selects Anthropic (first priority) | — |
| `HERMES_DRAFT_ANTHROPIC_MODEL` | Anthropic model | `claude-sonnet-4-6` |
| `OPENAI_API_KEY` | Selects OpenAI | — |
| `HERMES_DRAFT_OPENAI_MODEL` | OpenAI model | `gpt-4o-mini` |
| `GOOGLE_API_KEY` | Selects Gemini | — |
| `HERMES_DRAFT_GEMINI_MODEL` | Gemini model | `gemini-1.5-flash` |
| `OPENROUTER_API_KEY` | Selects OpenRouter | — |
| `HERMES_DRAFT_OPENROUTER_MODEL` | OpenRouter model | `anthropic/claude-3.5-sonnet` |
| `OLLAMA_BASE_URL` | Local Ollama base URL (selected if reachable) | `http://127.0.0.1:11434` |
| `HERMES_DRAFT_OLLAMA_MODEL` | Ollama model | `llama3.1` |
| `HERMES_DRAFT_CONFIG` | Path to an alternate `drafting_config.yaml` | bundled file |

Routing priority: **anthropic → openai → gemini → openrouter → ollama →
template**.

## Governance config — `drafting_config.yaml`

The operator edits `drafting_config.yaml` to govern drafting without touching
code. The skill hashes the file into `audit.config_version` on every draft, so
any change is traceable. It defines:

- `tone` — brand-voice guidance injected into the LLM system prompt.
- `limits` — `max_body_chars`, `max_subject_chars`, `temperature`.
- `banned_phrases` — substrings that, if present, force the deterministic
  fallback and are surfaced in `issues`.
- `allowed_link_hosts` — only links to these hosts are permitted; an off-list
  URL forces fallback.
- `templates` — each `template_key` is a complete deterministic draft
  (`subject_template`, `body_template`, `cta_template`, `required_context`),
  also used as the fallback.

## Output validation & shaping

Every LLM output is validated before it is allowed through. A **hard** failure
forces the deterministic template fallback:

- empty body, body over `max_body_chars`, subject over `max_subject_chars`
- a `banned_phrase` anywhere in the draft
- a secret-like token (OpenAI/Anthropic/AWS/GitHub/JWT/etc. patterns)
- an unfilled `{placeholder}`
- a link to a host not in `allowed_link_hosts`

Warnings (e.g. missing required context in template mode) are surfaced in
`issues` for the reviewer without blocking.

## Typed output — `DraftEnvelope` (for UI preview)

`draft_outreach_message` and `draft_render_template` return a `DraftEnvelope`
(a `TypedDict` in `drafting_skill.py`). The approval-queue UI consumes this
shape:

```jsonc
{
  "draft_id": "ef28289969e138cb",     // sha256(prompt_version|body|timestamp)[:16]
  "status": "pending_approval",       // ONLY value generation can emit
  "channel": "email",                 // "email" | "linkedin" (from template)
  "subject": "Quick idea for Acme",
  "body": "Hi Alex, ...",
  "call_to_action": "Would you be open to a 15-minute call next week?",
  "personalization_notes": "...",
  "recipient_ref": "r1",              // opaque caller ref; no PII required
  "issues": ["..."],                  // validation warnings for the reviewer
  "audit": {
    "provider": "anthropic",          // anthropic|openai|gemini|openrouter|ollama|template
    "model": "claude-sonnet-4-6",
    "prompt_id": "intro_email",       // template key
    "prompt_version": "ebee1865edce", // hash of the assembled prompt
    "config_version": "9d7d694c268e", // hash of drafting_config.yaml
    "skill_version": "0.1.0",
    "generated_at": "2026-06-15T04:02:52Z",
    "source": "llm",                  // "llm" | "template"
    "fallback_reason": null,
    "provider_error": null
  }
}
```

## Tests

```bash
pip install -r requirements.txt        # PyYAML
python3 -m unittest test_drafting_skill.py -v
```

The suite forces `HERMES_DRAFT_PROVIDER=template` so it is fully offline and
deterministic — no API keys or network required. Provider paths are exercised
by monkeypatching `_call_provider`, never by real HTTP.

## Scope (intentionally limited)

- No sending logic and nothing that bypasses approval.
- Not an autonomous sender.
- No meeting-summary functionality.
