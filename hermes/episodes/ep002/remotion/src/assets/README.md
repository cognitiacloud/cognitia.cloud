# Episode 002 — assets (real-run artifacts only)

Remotion reads these via `staticFile(...)`. Nothing here is invented UI — every
file is captured from one real `hermes run` ("run41"). Do not commit secrets;
run the privacy scan before any frame ships (ACCEPTANCE_CHECKLIST §E).

Expected layout (populated during the capture/build phase, not at blueprint stage):

```
assets/
├─ run41/
│  ├─ terminal_boot.txt   # S1 boot scrollback
│  ├─ run.log             # S4 full run log
│  ├─ manifest.json       # S4 durations / file sizes / exit codes
│  ├─ qc_fail.json        # S5 real vision-skill failure output
│  ├─ qc_pass.json        # S5 real vision-skill pass output
│  ├─ captions.json       # word-timed VO transcript (whole clip)
│  ├─ vo.mp3              # ElevenLabs master VO
│  ├─ avatar.mp4          # HeyGen avatar, chest-up, QC-safe crop
│  └─ bed_minimal.mp3     # optional bed, -24 LUFS
└─ logos/                 # mono SVGs, recolored to brand (PipelineScene only)
   ├─ claude.svg  elevenlabs.svg  heygen.svg  ffmpeg.svg  telegram.svg
```

> Placeholder values currently live in `src/data/episode-002.ts`. Swap them for
> these files during the build phase; the components already read the data shape.
