# Lane E — Booking & Meeting Intelligence (handoff)

**Owner:** Lane E
**Status:** v0.1 landed — `hermes/skills/meeting-skill/`
**Branch:** `claude/lane-e-meeting-workflow-gkpnz9`

## What this lane delivers

The smallest honest meeting workflow for the Cognitia pipeline:

booking state → meeting record → transcript → summary + action items →
follow-up draft → **human-reviewed CRM writeback preview** → approved envelope
for the CRM lane to apply.

It ships as a self-contained Hermes skill (mirrors `vision-skill`): a Python
module + `skill.yaml` + `.mcp.json` + README + stdlib `unittest` tests, with a
provider router that degrades to a deterministic **offline** path so everything
runs with no API keys. State is persisted in a local JSON store (`MeetingStore`,
`MEETING_STORE_PATH`).

## Honest seams (nothing fabricated)

The skill is a standalone stdio process and **cannot call other MCP servers**.
The live providers in this environment are bridged by the **orchestrator**, not
the skill:

| Edge            | Live MCP provider                  | Direction | Skill contact point                           |
| --------------- | ---------------------------------- | --------- | --------------------------------------------- |
| Booking         | Calendly / Google Calendar         | **in**    | `meeting_ingest_booking(payload)`             |
| Transcript      | Granola (`get_meeting_transcript`) | **in**    | `meeting_ingest_transcript(meeting_id, text)` |
| CRM writeback   | HubSpot (`manage_crm_objects`)     | **out**   | `writeback.approved` SyncEvent                |
| Follow-up draft | Gmail (`create_draft`) / Slack     | **out**   | `meeting_draft_followup` text                 |

No auto calendar sync, no auto CRM write, no auto-send. The CRM writeback is a
**preview that requires human approval** before it becomes an apply-able envelope.

## Data model changes

New entities (greenfield — no DB/migrations; JSON store):

### Booking

`id, provider (calendly|google|manual), contact_id, invitee_name, invitee_email,
event_type, scheduled_start, scheduled_end, join_url, status
(requested|confirmed|rescheduled|canceled|completed|no_show), source_payload,
created_at`

### Meeting

`id, booking_id, contact_id, title, start, end, participants[], state,
transcript_ref, transcript_text, summary, action_items[], follow_up_draft,
writeback{CrmWritebackPreview}, sync_state, provider, created_at, updated_at`

- **state** (lifecycle): `scheduled → transcribed → summarized → review_ready →
writeback_approved → synced`; terminal `canceled` / `no_show`.
  The skill never sets `synced` — only the orchestrator does, post-approval.
- **sync_state** (CRM edge): `none → preview_pending → approved|rejected →
applied|error`.

### ActionItem

`id, text, owner, due, status (open|done|dismissed), source (ai|offline|human),
confidence`

### CrmWritebackPreview

`id, contact_id, timeline_activity{type,title,body,occurred_at}, proposed_tasks[],
field_suggestions{}, review_status (pending_review|approved|rejected), reviewer,
reviewed_at` — **never auto-applied by the skill.**

### SyncEvent ← cross-lane contract

`id, meeting_id, contact_id, kind, payload, status, created_at`

- `kind`: `meeting.summarized | writeback.preview | writeback.approved | writeback.rejected`
- The CRM / contact-timeline lane consumes these. The `writeback.approved` event
  (`status: ready_to_apply`) carries the full envelope to push to HubSpot.

## API / tool contracts

8 tools, dual-surfaced as MCP tools and CLI subcommands (see README for the
table and examples). List/detail contracts for the UI lane:

- `meeting_list(state?, contact_id?, query?, limit?)` → `{count, meetings[row]}`
  where `row = {id, title, contact_id, start, state, sync_state,
action_item_count, has_followup_draft, summary_excerpt}`. `query` is full-text
  over title + summary + action items + participants (searchable surface).
- `meeting_get(meeting_id)` → `{meeting, booking, events[]}` (full detail).

## Dependencies for other lanes

- **CRM / contact-timeline lane**
  - Consume `SyncEvent`s, especially `writeback.approved`, and apply the
    `timeline_activity` + `proposed_tasks` + `field_suggestions` to HubSpot.
  - Render the meeting `timeline_activity` on the contact timeline.
  - **Open item:** agree a shared `contact_id` namespace. Today it is an opaque
    string ref carried from the booking payload.
- **UI lane**
  - Build the list view from `meeting_list` and the detail view from
    `meeting_get`. Drive status badges from `state` + `sync_state`. Drive the
    approve/reject review control from `writeback.review_status`
    (`pending_review`) → call `meeting_review_writeback`.
- **Orchestrator / agent**
  - Owns the live MCP bridges (Calendly/Granola/HubSpot/Gmail/Slack) feeding the
    seams above. Only the orchestrator may apply an approved writeback and then
    advance the meeting to `synced` / `sync_state=applied`.

## Verification

```bash
cd hermes/skills/meeting-skill
python3 test_meeting_skill.py -v          # 23 tests, no API keys required
python3 -c "import meeting_skill"         # imports without the mcp SDK
# end-to-end CLI smoke: see README "CLI usage"
```

Test coverage: booking ingest → scheduled; transcript ingest → transcribed;
offline summarize returns summary + action items (`provider=offline`); action-item
heuristics (owner/due); follow-up draft references action items; build_writeback
is `pending_review` and never applied; approve emits `writeback.approved`
(`ready_to_apply`) and never sets `synced`; reject marks rejected; list/get/search
filters; JSON store round-trips from disk.

## Not in scope (deliberately)

- No autonomous calling/calendaring agent.
- No fabricated calendar sync or CRM write — those are orchestrator-applied via
  the live MCP providers, gated by human approval for the writeback.
