# EP002 local crop collectors

Run ONE of these on your own Windows/WSL machine to gather candidate proof
screenshots into a single ZIP you can upload back to the chat. They are
**read-only** (copy, never move/delete), make **no network/AI/MCP calls**, and
**render nothing**.

- `collect_crops.ps1` — Windows PowerShell
  `powershell -ExecutionPolicy Bypass -File .\collect_crops.ps1`
- `collect_crops.sh` — WSL / Linux
  `bash collect_crops.sh`

Output (default `Desktop\cognitia_real_crops_candidates`):
`candidates/`, `manifest.csv` (filename, source path, modified, size,
resolution, reason, likely_slot), `README_NEXT_STEPS.txt`, and the zip.

After you upload the zip back: I build a contact sheet, you approve candidates,
I place approved files into `assets/run41/shots/`, privacy-scan each, and
re-render only the 10–12s preview. No 60s render until you approve.
