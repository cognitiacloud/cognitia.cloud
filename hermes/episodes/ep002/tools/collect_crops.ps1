<#
  Cognitia Republic - EP002 local crop collector (Windows PowerShell)
  --------------------------------------------------------------------
  READ-ONLY. Copies candidate screenshots/media into one folder, writes a
  manifest, and zips it for upload. Never moves/deletes source files. Makes
  NO network/AI/MCP calls. Does not render anything.

  Run:
    powershell -ExecutionPolicy Bypass -File .\collect_crops.ps1
  Optional:
    -Out <folder>  -ScreenshotDays 60  -MaxFileMB 40
#>
param(
  [string]$Out = "$env:USERPROFILE\Desktop\cognitia_real_crops_candidates",
  [int]$ScreenshotDays = 60,
  [int]$MaxFileMB = 40
)

$ErrorActionPreference = 'SilentlyContinue'

$terms  = @('cognitia','ep002','episode','run41','hermes','heygen','elevenlabs',
            'telegram','ffmpeg','qc','preview','avatar','voice','delivery','screenshot')
$imgExt = @('.png','.jpg','.jpeg','.webp','.gif','.bmp')
$vidExt = @('.mp4','.mov','.mkv','.webm')

$searchDirs = @(
  "$env:USERPROFILE\Downloads",
  "$env:USERPROFILE\Pictures",
  "$env:USERPROFILE\Pictures\Screenshots",
  "$env:USERPROFILE\Desktop",
  "$env:USERPROFILE\OneDrive"
)

$cand = Join-Path $Out 'candidates'
New-Item -ItemType Directory -Force -Path $cand | Out-Null

function Guess-Slot([string]$name) {
  $n = $name.ToLower()
  if ($n -match 'heygen|avatar')                      { return 'heygen.png' }
  if ($n -match 'eleven|11labs|voice|tts|audio|\bvo\b'){ return 'elevenlabs.png' }
  if ($n -match 'telegram|delivery|deliver|sent')     { return 'telegram.png' }
  if ($n -match '\bqc\b|quality|gate|vision|scan|audit|privacy') { return 'qc.png' }
  if ($n -match 'claude|script|hermes')               { return 'claude_script.png' }
  if ($n -match 'ffmpeg|compose|encode|render|terminal|log|build') { return 'ffmpeg.png' }
  return ''
}

Add-Type -AssemblyName System.Drawing
function Get-Res([string]$path, [string]$ext) {
  if ($imgExt -contains $ext) {
    try { $img = [System.Drawing.Image]::FromFile($path)
          $r = "$($img.Width)x$($img.Height)"; $img.Dispose(); return $r } catch { return '' }
  }
  if (($vidExt -contains $ext) -and (Get-Command ffprobe -ErrorAction SilentlyContinue)) {
    try { return ((& ffprobe -v error -select_streams v:0 -show_entries stream=width,height `
                    -of csv=s=x:p=0 "$path" 2>$null) -replace '\s','') } catch { return '' }
  }
  return ''
}

$cutoff   = (Get-Date).AddDays(-$ScreenshotDays)
$maxBytes = [int64]$MaxFileMB * 1MB
$rows = New-Object System.Collections.ArrayList
$seen = @{}
$idx  = 0

foreach ($d in $searchDirs) {
  if (-not (Test-Path $d)) { continue }
  Get-ChildItem -Path $d -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
    $f = $_; $ext = $f.Extension.ToLower()
    if (($imgExt + $vidExt) -notcontains $ext) { return }
    $name = $f.Name
    $byTerm = $false
    foreach ($t in $terms) { if ($name.ToLower().Contains($t)) { $byTerm = $true; break } }
    $byShot = ($imgExt -contains $ext) -and ($f.DirectoryName -match 'Screenshot') -and ($f.LastWriteTime -ge $cutoff)
    if (-not ($byTerm -or $byShot)) { return }

    $key = "$name|$($f.Length)"
    if ($seen.ContainsKey($key)) { return }
    $seen[$key] = $true
    $idx++

    $candName = ('{0:D3}_{1}' -f $idx, $name)
    if ($f.Length -le $maxBytes) {
      Copy-Item -LiteralPath $f.FullName -Destination (Join-Path $cand $candName) -ErrorAction SilentlyContinue
    } else {
      $candName = "(too large >${MaxFileMB}MB - not copied)"
    }

    [void]$rows.Add([PSCustomObject]@{
      candidate_file = $candName
      original_name  = $name
      source_path    = $f.FullName
      modified       = $f.LastWriteTime.ToString('s')
      size_bytes     = $f.Length
      resolution     = (Get-Res $f.FullName $ext)
      reason         = $(if ($byTerm) { 'name-match' } else { 'recent-screenshot' })
      likely_slot    = (Guess-Slot $name)
    })
  }
}

$rows | Sort-Object modified -Descending |
  Export-Csv -NoTypeInformation -Encoding UTF8 -Path (Join-Path $Out 'manifest.csv')

$readme = @"
Cognitia Republic - EP002 candidate crops
==========================================
$idx candidate file(s) were COPIED into .\candidates\  (your originals were not touched).

NEXT STEPS
1. Open manifest.csv. Look at the 'likely_slot' column.
2. Choose ONE best file for each slot:
     heygen.png       - clean chest-up avatar frame (no chin clip)
     elevenlabs.png   - voice/waveform generation screenshot
     telegram.png     - delivery message screenshot
     qc.png           - QC result / scores screenshot
     claude_script.png- (optional) script editor/terminal
     ffmpeg.png       - (optional) compose/log terminal
3. PRIVACY: open each chosen file and confirm NO secrets are visible -
   no API keys, emails, tokens, phone numbers, or local file paths.
   Crop or blur anything sensitive before uploading.
4. Upload cognitia_real_crops_candidates.zip back into the chat
   (or just drag the chosen image files directly).

Do NOT rename the files - I will map them to the exact slot names after you approve.
"@
Set-Content -Path (Join-Path $Out 'README_NEXT_STEPS.txt') -Value $readme -Encoding UTF8

$zip = Join-Path $Out 'cognitia_real_crops_candidates.zip'
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $Out 'candidates'), (Join-Path $Out 'manifest.csv'), `
                       (Join-Path $Out 'README_NEXT_STEPS.txt') -DestinationPath $zip

Write-Host ""
Write-Host "Done. $idx candidate(s) collected." -ForegroundColor Green
Write-Host "Folder: $Out"
Write-Host "Upload this ZIP back to the chat: $zip"
