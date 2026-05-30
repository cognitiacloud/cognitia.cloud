# Hermes ⇄ Windows Claude Code — Filesystem Bridge

A dead-simple, robust filesystem handshake that lets **Hermes** (an AI agent
running in WSL2) hand tasks to **Claude Code running natively on Windows**, and
get results back. No sockets, no servers — just files on a shared disk.

> **Why a shared disk and not a network call?** WSL2 can read the Windows
> filesystem directly (`/mnt/c/Users/smrai/...` from WSL maps to
> `C:\Users\smrai\...` on Windows). Both agents therefore see the *same*
> directory, so a file written by one is instantly visible to the other. This
> is the whole reason the bridge works — see [Networking](#networking).

## Components

| File | Runs where | Purpose |
|------|-----------|---------|
| `windows-bridge.ps1` | **Windows** (PowerShell 5.1+ or PowerShell 7) | Polls `requests\`, runs `claude -p`, writes `responses\`, posts to `inbox\` |
| `bridge-config.json` | Windows | Paths, poll interval, timeout, `claude` invocation |

## Directory layout

All under `bridgeRoot` (default `C:\Users\smrai\.claude-code-bridge`):

```
.claude-code-bridge\
├─ requests\      Hermes writes <task_id>.txt here   →  Windows reads
├─ responses\     Windows writes <task_id>.txt here  →  Hermes reads
├─ inbox\         Windows writes to_hermes_*.txt here →  Hermes reads
├─ processing\    internal: in-flight tasks (claimed atomically)
├─ logs\          daemon logs (bridge-YYYYMMDD.log)
└─ heartbeat.json liveness + status, refreshed every ~15s
```

## Request / response protocol

**Request** (`requests\<task_id>.txt`):

```
GOAL: Summarize the README in this repo
CONTEXT: The repo is at C:\dev\myproject. Keep it under 5 bullet points.
```

- `GOAL:` is required. `CONTEXT:` is optional and may span multiple lines.
- Anything before a recognized header is treated as part of the goal.

**Response** (`responses\<task_id>.txt`), written atomically:

```
TASK_ID: <task_id>
STATUS: OK | TIMEOUT | EXIT_<n> | ERROR
ELAPSED_SECONDS: 42
COMPLETED_UTC: 2026-05-30T12:34:56.789Z
--- OUTPUT ---
<claude stdout>
--- STDERR ---        (only if non-empty)
<claude stderr>
```

The daemon **does not** delete the request file itself in the naive sense — it
*atomically claims* it by moving it into `processing\` first (see Hardening),
which is what actually removes it from `requests\`. Hermes can treat the
appearance of `responses\<task_id>.txt` as "done".

## Setup (on the Windows machine)

1. **Get the code onto Windows.** Clone this repo (or copy the `hermes/bridge`
   folder) to the Windows host.

2. **Confirm the `claude` CLI is on PATH:**
   ```powershell
   claude --version
   ```
   If it isn't, set the full path in `bridge-config.json` → `claudeCommand`.

3. **Review `bridge-config.json`** — especially `bridgeRoot` and `claudeArgs`.
   The default args are `["-p", "--dangerously-skip-permissions"]`; drop
   `--dangerously-skip-permissions` if you want permission prompts (note: in an
   unattended daemon, prompts will hang, so skipping is usually correct here).

4. **Run it:**
   ```powershell
   # PowerShell 7 (recommended)
   pwsh -File .\windows-bridge.ps1

   # Windows PowerShell 5.1
   powershell -ExecutionPolicy Bypass -File .\windows-bridge.ps1

   # Process the current queue once and exit (testing)
   pwsh -File .\windows-bridge.ps1 -Once
   ```
   On startup it announces itself by dropping a `to_hermes_*.txt` into `inbox\`.

## Networking

The bridge needs **one shared filesystem**, not an IP route. From **WSL2**,
Hermes should point at the Windows path through the `/mnt` mount:

```
Windows path : C:\Users\smrai\.claude-code-bridge
WSL2 path    : /mnt/c/Users/smrai/.claude-code-bridge
```

Hermes writes to `/mnt/c/Users/smrai/.claude-code-bridge/requests/` and reads
`/responses/` + `/inbox/`. The Windows daemon uses the native `C:\` path. Same
bytes, two views.

If you instead want Hermes to invoke Windows Claude *directly* over the network
(the `claude -p "..."` reverse path mentioned in the mission), that uses the
WSL2 ⇄ Windows IP (`172.25.170.198` in `bridge-config.json`) and is independent
of this filesystem bridge. The filesystem bridge alone is enough for the
request/response loop and is far more robust.

## Run it as a background service (autostart)

**Option A — Scheduled Task (survives logout, simplest):**
```powershell
$action  = New-ScheduledTaskAction -Execute 'pwsh.exe' `
  -Argument '-WindowStyle Hidden -File "C:\path\to\hermes\bridge\windows-bridge.ps1"'
$trigger = New-ScheduledTaskTrigger -AtLogOn
Register-ScheduledTask -TaskName 'HermesBridge' -Action $action -Trigger $trigger -RunLevel Highest
```

**Option B — NSSM (true Windows service):** install [NSSM](https://nssm.cc/) and
`nssm install HermesBridge pwsh.exe "-File C:\path\to\windows-bridge.ps1"`.

## Hardening built in

This daemon is written to survive real-world conditions:

- **Atomic writes** — responses and inbox messages are written to a hidden
  `.tmp` file in the same folder, then `Move-Item`'d into place. A reader never
  sees a half-written file.
- **Atomic claim (no double-processing)** — a request is `Move-Item`'d into
  `processing\` before being read. The rename is atomic on one volume: exactly
  one loop iteration wins. This also prevents reading a file Hermes is still
  writing (the move fails and we retry next poll).
- **Hard timeouts** — each `claude` run is capped at `taskTimeoutSeconds`; on
  timeout the process tree is killed and a `STATUS: TIMEOUT` response is written.
- **Crash recovery** — on startup, any task left in `processing\` (from a crash)
  is moved back to `requests\` and retried.
- **Async stdout/stderr capture** — avoids deadlocks when the child fills a pipe
  buffer.
- **Response size cap** — output over `maxResponseBytes` is truncated with a
  marker so a runaway job can't fill the disk.
- **Heartbeat** — `heartbeat.json` carries status/PID/timestamp so Hermes can
  tell the daemon is alive.
- **Per-task isolation** — one task throwing never stops the loop; the error is
  written as the task's response.

## Recommendations for the Hermes (WSL) side

To match this daemon's guarantees, Hermes should:

1. Write requests **atomically**: write to `requests/.<task_id>.tmp`, then
   `rename()` to `requests/<task_id>.txt`. (Files starting with `.` are ignored
   by the daemon.)
2. Use a unique `task_id` per request (e.g. `ts-<unix_ms>-<rand>`).
3. Poll `responses/<task_id>.txt` for completion; parse the `STATUS:` line.
4. Treat `inbox/to_hermes_*.txt` as an append-only message stream; delete after
   consuming.
5. Read `heartbeat.json` to confirm the daemon is up before queuing work.
