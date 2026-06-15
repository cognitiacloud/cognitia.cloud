# Hermes Meeting Skill (Lane E)

Booking & meeting intelligence for the Cognitia pipeline. The smallest honest
meeting workflow: **booking state → meeting record → transcript → summary +
action items → follow-up draft → reviewable CRM writeback preview**, with an
operator-visible state machine and searchable summary/action surfaces.

This skill is a **standalone stdio process**. It does **not** call calendar,
transcript, or CRM providers itself. The Hermes orchestrator bridges the live
edges (Calendly, Granola, HubSpot, Gmail/Slack) by feeding inputs **in** and
consuming the approved writeback envelope **out**. Nothing risky is fabricated:
no auto calendar sync, no auto CRM write, no auto-send.

## Install

```bash
pip install -r requirements.txt   # no third-party deps; optional `pip install mcp` for the server
```

Runs on the Python 3 standard library alone — including the offline summary and
action-item extraction — so the full workflow and its tests run with no API keys.

## Configure

Text provider routing priority (auto-selected unless overridden):

1. `HERMES_MEETING_PROVIDER` — explicit override
   (`openai|anthropic|gemini|openrouter|ollama|offline`)
2. `OPENAI_API_KEY` → OpenAI (`gpt-4o-mini` by default)
3. `ANTHROPIC_API_KEY` → Claude (`claude-sonnet-4-6` by default)
4. `GOOGLE_API_KEY` → Gemini
5. `OPENROUTER_API_KEY` → OpenRouter
6. Reachable `OLLAMA_BASE_URL` (default `http://127.0.0.1:11434`) → local Ollama
7. Otherwise → `offline` (deterministic extractive summary + regex action items)

Model overrides: `HERMES_MEETING_OPENAI_MODEL`, `HERMES_MEETING_ANTHROPIC_MODEL`,
`HERMES_MEETING_GEMINI_MODEL`, `HERMES_MEETING_OPENROUTER_MODEL`,
`HERMES_MEETING_OLLAMA_MODEL`.

Persistence: a single JSON file. Set `MEETING_STORE_PATH` to choose its
location (default `.meeting_store.json` beside the script; tests use a temp dir).
No secrets are stored in code; keys are read only from the environment and
redacted in logs.

## Meeting state machine (operator-visible)

```
scheduled → transcribed → summarized → review_ready → writeback_approved → synced
                                                                   ▲             ▲
                          (canceled / no_show are terminal)        │             │
                                              human approves ──────┘   orchestrator
                                                                        applies & sets
```

The skill **never** sets `synced` / `sync_state=applied` itself. Only the
orchestrator does that, after a human approves the writeback. `sync_state`
(`none → preview_pending → approved/rejected → applied/error`) tracks the CRM
edge independently of the meeting lifecycle.

## Tools

| MCP tool | CLI | Purpose |
|---|---|---|
| `meeting_ingest_booking` | `ingest-booking` | Booking payload → Booking + scheduled Meeting |
| `meeting_ingest_transcript` | `ingest-transcript` | Attach transcript → `transcribed` |
| `meeting_summarize` | `summarize` | Summary + action items → `summarized` |
| `meeting_draft_followup` | `draft-followup` | Follow-up draft (text only) |
| `meeting_build_writeback` | `build-writeback` | CRM writeback **preview** → `review_ready` |
| `meeting_review_writeback` | `review-writeback` | Human gate: approve/reject |
| `meeting_list` | `list` | List/filter/full-text search |
| `meeting_get` | `get` | Full detail (meeting + booking + events) |

## CLI usage

```bash
MID=$(python3 meeting_skill.py ingest-booking --payload-file sample_data/booking_calendly.json \
        | python3 -c "import sys,json;print(json.load(sys.stdin)['meeting']['id'])")
python3 meeting_skill.py ingest-transcript --meeting-id "$MID" --transcript-file sample_data/transcript_sample.txt
python3 meeting_skill.py summarize        --meeting-id "$MID"
python3 meeting_skill.py draft-followup   --meeting-id "$MID"
python3 meeting_skill.py build-writeback  --meeting-id "$MID"
python3 meeting_skill.py review-writeback --meeting-id "$MID" --approve --reviewer ops
python3 meeting_skill.py list --query sandbox
python3 meeting_skill.py get  --meeting-id "$MID"
python3 meeting_skill.py provider           # selected provider + store path
```

## MCP server usage

```bash
python3 meeting_skill.py --mcp   # requires `pip install mcp`
```

## Honest provider seams

| Edge | Live MCP provider | How it wires |
|---|---|---|
| Booking in | Calendly / Google Calendar | Orchestrator passes the event payload to `meeting_ingest_booking` |
| Transcript in | Granola (`get_meeting_transcript`) | Orchestrator passes transcript text to `meeting_ingest_transcript` |
| Writeback out | HubSpot (`manage_crm_objects`) | Orchestrator applies the `writeback.approved` SyncEvent after human approval |
| Draft out | Gmail (`create_draft`) / Slack (`slack_send_message_draft`) | Orchestrator creates the draft from `follow_up_draft`; never auto-sent |

## Safety constraints

- No file deletion; never posts/sends anywhere.
- **CRM writeback requires human approval.** The skill builds a *preview* and,
  on approval, emits an envelope — it never writes to the CRM and never marks a
  meeting `synced` on its own.
- Logs are redaction-filtered (emails / API-key-shaped tokens scrubbed).

## Tests

```bash
python3 test_meeting_skill.py -v   # 23 tests, pass with no API keys (offline path)
```
