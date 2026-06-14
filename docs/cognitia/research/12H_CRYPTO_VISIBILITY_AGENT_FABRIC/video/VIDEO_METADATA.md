# VIDEO_METADATA

- **URL**: https://youtu.be/JbnZ4AzZ2ik (share param `si=...` stripped; tracking only)
- **Video ID**: `JbnZ4AzZ2ik`
- **Title**: UNKNOWN — could not be retrieved (see EXTRACTION_FAILURE_REPORT.md)
- **Channel**: UNKNOWN
- **Description**: UNKNOWN
- **Duration**: UNKNOWN
- **Published**: UNKNOWN

## Why metadata is blank

All lawful retrieval paths available in this environment failed:

- `curl` to the YouTube oEmbed endpoint → **HTTP 403** (egress blocked).
- `WebFetch` on the video URL → **HTTP 403**.
- `WebSearch` for the opaque id `JbnZ4AzZ2ik` → returned only generic
  "best crypto YouTube channel" lists, not the specific video.
- No `yt-dlp`, no `youtube-transcript-api` (CLI or Python) installed.

No metadata has been invented. When the founder provides the title/channel (or
pastes the transcript), this file should be filled and the framework reconciled.
