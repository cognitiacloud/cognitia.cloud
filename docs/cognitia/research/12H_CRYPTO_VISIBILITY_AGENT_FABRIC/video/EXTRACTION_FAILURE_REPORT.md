# EXTRACTION_FAILURE_REPORT

- **Date**: 2026-06-14T19:26Z
- **Target**: `https://youtu.be/JbnZ4AzZ2ik`
- **Outcome**: FAILURE — transcript and metadata not retrievable.

## Root cause

This managed execution environment blocks outbound HTTP to arbitrary hosts:
`curl` and `WebFetch` both return **403** for YouTube endpoints, and no
YouTube-specific extraction tooling (`yt-dlp`, `youtube-transcript-api`) is
installed. `WebSearch` is available but resolves human queries, not opaque video
ids — it returned generic crypto-channel results, not this video.

## Impact

- LOOP 1 cannot ingest the video's actual framework.
- The sprint continues with **independent, search-grounded** deep-search lanes
  (LOOP 2), which cover the same subject matter (crypto gem discovery, diligence
  criteria) without depending on the video.

## Remediation options (in order of preference)

1. Founder pastes the transcript → `video/TRANSCRIPT.md`; reconcile next session.
2. Run extraction from a machine with egress: `yt-dlp --write-auto-subs
--skip-download --sub-lang en "https://youtu.be/JbnZ4AzZ2ik"` and paste the
   `.vtt`.
3. Accept the independent framework as the working basis (it is conservative and
   not attributed to the video).

## Integrity statement

No transcript content, quotes, statistics, timestamps, or claims about the
video's contents have been invented. Everything attributed to "the video"
remains UNKNOWN until reconciled.

## Re-probe (LEGEND-001, 2026-06-15)

Re-attempted retrieval as part of LEGEND-001 ("YouTube research reconciliation").
The egress block persists: the YouTube oEmbed endpoint returned **HTTP 403**
again, and no transcript tooling is available in this environment. Status
unchanged — transcript still UNAVAILABLE, reconciliation still pending a
founder-pasted transcript into `video/TRANSCRIPT.md`. No content fabricated.
