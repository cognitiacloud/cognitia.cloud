#requires -Version 5.1
<#
.SYNOPSIS
    Windows-side filesystem bridge daemon for the Hermes <-> Claude Code mesh.

.DESCRIPTION
    Polls a request folder for task files written by Hermes (the WSL agent),
    runs each task through the local `claude` CLI, and writes the result back
    to the response folder. Also drops a startup announcement and optional
    status messages into the inbox that Hermes watches.

    Protocol (all paths under <bridgeRoot>):
      requests\<task_id>.txt   <- Hermes writes a task here
      responses\<task_id>.txt  -> this daemon writes the result here
      inbox\to_hermes_*.txt    -> this daemon writes free-form messages here
      processing\<task_id>.txt    internal: in-flight tasks (claimed atomically)
      logs\bridge-*.log           daemon log
      heartbeat.json              liveness/status file

    Request file format:
      GOAL: <what to do>
      CONTEXT: <background info, may span multiple lines>

.PARAMETER ConfigPath
    Path to bridge-config.json. Defaults to the file next to this script.

.PARAMETER Once
    Process whatever is currently queued, then exit (useful for testing).

.EXAMPLE
    pwsh -File windows-bridge.ps1
    powershell -ExecutionPolicy Bypass -File windows-bridge.ps1
#>
[CmdletBinding()]
param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot 'bridge-config.json'),
    [switch]$Once
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
if (-not (Test-Path -LiteralPath $ConfigPath)) {
    throw "Config file not found: $ConfigPath"
}
$cfg = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json

$BridgeRoot      = $cfg.bridgeRoot
$PollInterval    = [int]$cfg.pollIntervalSeconds
$TaskTimeout     = [int]$cfg.taskTimeoutSeconds
$ClaudeCommand   = $cfg.claudeCommand
$ClaudeArgs      = @($cfg.claudeArgs)
$HeartbeatEvery  = [int]$cfg.heartbeatSeconds
$MaxResponseBytes = [int]$cfg.maxResponseBytes
$AnnounceStartup = [bool]$cfg.announceOnStartup

$RequestsDir   = Join-Path $BridgeRoot 'requests'
$ResponsesDir  = Join-Path $BridgeRoot 'responses'
$InboxDir      = Join-Path $BridgeRoot 'inbox'
$ProcessingDir = Join-Path $BridgeRoot 'processing'
$LogsDir       = Join-Path $BridgeRoot 'logs'
$HeartbeatFile = Join-Path $BridgeRoot 'heartbeat.json'

foreach ($d in @($BridgeRoot, $RequestsDir, $ResponsesDir, $InboxDir, $ProcessingDir, $LogsDir)) {
    if (-not (Test-Path -LiteralPath $d)) {
        New-Item -ItemType Directory -Path $d -Force | Out-Null
    }
}

$LogFile = Join-Path $LogsDir ("bridge-{0:yyyyMMdd}.log" -f (Get-Date))

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
function Write-Log {
    param([string]$Message, [string]$Level = 'INFO')
    $line = "{0} [{1}] {2}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Level, $Message
    Write-Host $line
    try { Add-Content -LiteralPath $LogFile -Value $line -Encoding UTF8 } catch { }
}

# Atomic write: write to a temp file in the same directory, then move into place.
# A rename within one volume is atomic, so a reader never sees a half-written file.
function Write-FileAtomic {
    param([string]$Path, [string]$Content)
    $dir = Split-Path -Parent $Path
    $tmp = Join-Path $dir ('.' + [System.IO.Path]::GetFileName($Path) + '.' + [System.Guid]::NewGuid().ToString('N') + '.tmp')
    $utf8 = New-Object System.Text.UTF8Encoding($false)  # no BOM
    [System.IO.File]::WriteAllText($tmp, $Content, $utf8)
    Move-Item -LiteralPath $tmp -Destination $Path -Force
}

function Write-Inbox {
    param([string]$Message)
    $name = "to_hermes_{0:yyyyMMddHHmmssfff}.txt" -f (Get-Date)
    Write-FileAtomic -Path (Join-Path $InboxDir $name) -Content $Message
    Write-Log "inbox -> $name"
}

function Update-Heartbeat {
    param([string]$Status = 'idle', [string]$LastTask = '')
    $hb = [ordered]@{
        host       = $env:COMPUTERNAME
        agent      = 'windows-claude-code'
        status     = $Status
        lastTask   = $LastTask
        updatedUtc = (Get-Date).ToUniversalTime().ToString('o')
        pid        = $PID
    }
    try { Write-FileAtomic -Path $HeartbeatFile -Content ($hb | ConvertTo-Json -Compress) } catch { }
}

# Parse "GOAL:" / "CONTEXT:" sections. Everything after a header (until the next
# recognized header or EOF) belongs to that header.
function Parse-Task {
    param([string]$Body)
    $goal = New-Object System.Text.StringBuilder
    $context = New-Object System.Text.StringBuilder
    $current = $null
    foreach ($raw in ($Body -split "`r?`n")) {
        if ($raw -match '^\s*GOAL\s*:\s*(.*)$') {
            $current = 'goal'; [void]$goal.AppendLine($Matches[1]); continue
        }
        if ($raw -match '^\s*CONTEXT\s*:\s*(.*)$') {
            $current = 'context'; [void]$context.AppendLine($Matches[1]); continue
        }
        switch ($current) {
            'goal'    { [void]$goal.AppendLine($raw) }
            'context' { [void]$context.AppendLine($raw) }
            default   { [void]$goal.AppendLine($raw) }  # untagged body == goal
        }
    }
    [PSCustomObject]@{
        Goal    = $goal.ToString().Trim()
        Context = $context.ToString().Trim()
    }
}

# Quote a single argument for the Windows command line (msvcrt/CommandLineToArgvW
# rules: double internal quotes' preceding backslashes, then wrap if needed).
# Used only on the Windows PowerShell 5.1 fallback path that lacks ArgumentList.
function Get-QuotedArg {
    param([string]$Arg)
    if ($Arg -eq '') { return '""' }
    if ($Arg -notmatch '[\s"]') { return $Arg }
    $s = [System.Text.RegularExpressions.Regex]::Replace($Arg, '(\\*)"', '$1$1\"')
    $s = [System.Text.RegularExpressions.Regex]::Replace($s, '(\\+)$', '$1$1')
    return '"' + $s + '"'
}

# Run the claude CLI on a prompt, capturing stdout+stderr with a hard timeout.
function Invoke-ClaudeTask {
    param([string]$Prompt, [int]$TimeoutSeconds)

    $allArgs = @($ClaudeArgs) + @($Prompt)   # final positional arg = the prompt
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $ClaudeCommand
    if ($psi.PSObject.Properties.Name -contains 'ArgumentList') {
        # PowerShell 7+ / .NET Core: safe, no manual quoting needed.
        foreach ($a in $allArgs) { [void]$psi.ArgumentList.Add([string]$a) }
    } else {
        # Windows PowerShell 5.1 fallback: build a quoted argument string.
        $psi.Arguments = (($allArgs | ForEach-Object { Get-QuotedArg ([string]$_) }) -join ' ')
    }
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError  = $true
    $psi.UseShellExecute        = $false
    $psi.CreateNoWindow         = $true

    $proc = [System.Diagnostics.Process]::Start($psi)
    # Read async to avoid deadlock when pipe buffers fill.
    $outTask = $proc.StandardOutput.ReadToEndAsync()
    $errTask = $proc.StandardError.ReadToEndAsync()

    if (-not $proc.WaitForExit($TimeoutSeconds * 1000)) {
        try { $proc.Kill($true) } catch { try { $proc.Kill() } catch { } }
        return [PSCustomObject]@{
            ExitCode = -1
            Stdout   = $outTask.Result
            Stderr   = "TIMEOUT after ${TimeoutSeconds}s; process killed.`n" + $errTask.Result
            TimedOut = $true
        }
    }
    [PSCustomObject]@{
        ExitCode = $proc.ExitCode
        Stdout   = $outTask.Result
        Stderr   = $errTask.Result
        TimedOut = $false
    }
}

function Get-Truncated {
    param([string]$Text, [int]$MaxBytes)
    $bytes = [System.Text.Encoding]::UTF8.GetByteCount($Text)
    if ($bytes -le $MaxBytes) { return $Text }
    $sub = $Text.Substring(0, [Math]::Min($Text.Length, $MaxBytes))
    return $sub + "`n`n[...truncated: response exceeded $MaxBytes bytes...]"
}

# ---------------------------------------------------------------------------
# Core: claim + process a single request
# ---------------------------------------------------------------------------
function Invoke-OneRequest {
    param([System.IO.FileInfo]$File)

    $taskId = [System.IO.Path]::GetFileNameWithoutExtension($File.Name)
    $claimed = Join-Path $ProcessingDir $File.Name

    # Claim atomically: a rename within the volume either succeeds (we own it)
    # or throws (another loop iteration / lingering writer holds it). This is
    # what stops the same task from being processed twice.
    try {
        Move-Item -LiteralPath $File.FullName -Destination $claimed -Force -ErrorAction Stop
    } catch {
        Write-Log "Could not claim '$($File.Name)' (still being written or already claimed): $($_.Exception.Message)" 'WARN'
        return
    }

    Write-Log "Claimed task '$taskId'"
    Update-Heartbeat -Status 'working' -LastTask $taskId

    $started = Get-Date
    try {
        $body = Get-Content -LiteralPath $claimed -Raw
        $task = Parse-Task -Body $body

        if ([string]::IsNullOrWhiteSpace($task.Goal)) {
            throw "Request '$taskId' has no GOAL."
        }

        $prompt = $task.Goal
        if (-not [string]::IsNullOrWhiteSpace($task.Context)) {
            $prompt = "$($task.Goal)`n`n--- CONTEXT ---`n$($task.Context)"
        }

        Write-Log "Running claude for '$taskId' (goal: $($task.Goal.Substring(0,[Math]::Min(80,$task.Goal.Length))))"
        $result = Invoke-ClaudeTask -Prompt $prompt -TimeoutSeconds $TaskTimeout

        $elapsed = [int]((Get-Date) - $started).TotalSeconds
        $statusWord = if ($result.TimedOut) { 'TIMEOUT' } elseif ($result.ExitCode -eq 0) { 'OK' } else { "EXIT_$($result.ExitCode)" }

        $sb = New-Object System.Text.StringBuilder
        [void]$sb.AppendLine("TASK_ID: $taskId")
        [void]$sb.AppendLine("STATUS: $statusWord")
        [void]$sb.AppendLine("ELAPSED_SECONDS: $elapsed")
        [void]$sb.AppendLine("COMPLETED_UTC: $((Get-Date).ToUniversalTime().ToString('o'))")
        [void]$sb.AppendLine("--- OUTPUT ---")
        [void]$sb.AppendLine($result.Stdout)
        if (-not [string]::IsNullOrWhiteSpace($result.Stderr)) {
            [void]$sb.AppendLine("--- STDERR ---")
            [void]$sb.AppendLine($result.Stderr)
        }

        $payload = Get-Truncated -Text $sb.ToString() -MaxBytes $MaxResponseBytes
        Write-FileAtomic -Path (Join-Path $ResponsesDir "$taskId.txt") -Content $payload
        Write-Log "Wrote response for '$taskId' ($statusWord, ${elapsed}s)"
    }
    catch {
        $err = "TASK_ID: $taskId`nSTATUS: ERROR`nCOMPLETED_UTC: $((Get-Date).ToUniversalTime().ToString('o'))`n--- ERROR ---`n$($_.Exception.Message)`n$($_.ScriptStackTrace)"
        try { Write-FileAtomic -Path (Join-Path $ResponsesDir "$taskId.txt") -Content $err } catch { }
        Write-Log "Task '$taskId' failed: $($_.Exception.Message)" 'ERROR'
    }
    finally {
        # Remove the in-flight copy; the original request is already gone (claimed).
        try { Remove-Item -LiteralPath $claimed -Force -ErrorAction SilentlyContinue } catch { }
        Update-Heartbeat -Status 'idle' -LastTask $taskId
    }
}

# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------
Write-Log "Windows bridge starting. Root=$BridgeRoot Poll=${PollInterval}s Timeout=${TaskTimeout}s"

# Recover any tasks orphaned by a previous crash: move them back to requests.
Get-ChildItem -LiteralPath $ProcessingDir -Filter '*.txt' -File -ErrorAction SilentlyContinue | ForEach-Object {
    try {
        Move-Item -LiteralPath $_.FullName -Destination (Join-Path $RequestsDir $_.Name) -Force
        Write-Log "Recovered orphaned task '$($_.Name)' from previous run" 'WARN'
    } catch { Write-Log "Could not recover '$($_.Name)': $($_.Exception.Message)" 'WARN' }
}

if ($AnnounceStartup) {
    Write-Inbox -Message ("Windows Claude Code is ALIVE.`nHost: {0}`nTime: {1}`nWatching: {2}`nReady for tasks." -f $env:COMPUTERNAME, (Get-Date).ToString('o'), $RequestsDir)
}
Update-Heartbeat -Status 'idle'

# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------
$lastHeartbeat = Get-Date
$stop = $false
[Console]::TreatControlCAsInput = $false
try {
    do {
        try {
            $requests = Get-ChildItem -LiteralPath $RequestsDir -Filter '*.txt' -File -ErrorAction SilentlyContinue |
                        Sort-Object LastWriteTime
            foreach ($f in $requests) {
                # Skip atomic-write temp files defensively.
                if ($f.Name.StartsWith('.')) { continue }
                Invoke-OneRequest -File $f
            }
        }
        catch {
            Write-Log "Loop iteration error: $($_.Exception.Message)" 'ERROR'
        }

        if (((Get-Date) - $lastHeartbeat).TotalSeconds -ge $HeartbeatEvery) {
            Update-Heartbeat -Status 'idle'
            $lastHeartbeat = Get-Date
        }

        if ($Once) { $stop = $true } else { Start-Sleep -Seconds $PollInterval }
    } while (-not $stop)
}
finally {
    Update-Heartbeat -Status 'stopped'
    Write-Log "Windows bridge stopped."
}
