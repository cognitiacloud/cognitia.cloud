<#
  Cognitia Republic — Episode 002 LOCAL RUNNER (Windows PowerShell)
  Real pipeline orchestrator. Runs on YOUR PC (local file access).

  Stages: gather real assets -> derive crops -> privacy/QC -> render all-real
          V7 preview -> STOP for approval -> (approved) final -> opt Telegram.
  Safety: never fabricates proof. No HeyGen/ElevenLabs credit unless
          $env:ALLOW_CREDIT_CALLS='true'. Telegram only if SEND_TELEGRAM='true'.

  Run from the repo:
    powershell -ExecutionPolicy Bypass -File .\hermes\episodes\ep002\tools\run_local_ep002.ps1
#>
param(
  [string]$AvatarVideo = $env:AVATAR_VIDEO,
  [string]$VoiceAudio  = $env:VOICE_AUDIO,
  [string]$TelegramShot= $env:TELEGRAM_SHOT,
  [string]$QcShot      = $env:QC_SHOT,
  [switch]$Approve
)
$ErrorActionPreference = 'Stop'
function Log($m){ Write-Host "[runner] $m" -ForegroundColor Cyan }
function Warn($m){ Write-Host "[warn] $m" -ForegroundColor Yellow }
function Die($m){ Write-Host "[abort] $m" -ForegroundColor Red; exit 1 }

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$EP_DIR = Split-Path -Parent $SCRIPT_DIR
$REPO_ROOT = (& git -C $EP_DIR rev-parse --show-toplevel) 2>$null
if (-not $REPO_ROOT) { $REPO_ROOT = (Resolve-Path "$EP_DIR\..\..\..").Path }
$SF="$EP_DIR\style_frames"; $RUN="$EP_DIR\assets\run41"; $SHOTS="$RUN\shots"
$OUTDIR="$EP_DIR\out"; $VISION="$REPO_ROOT\hermes\skills\vision-skill\vision_skill.py"
New-Item -ItemType Directory -Force -Path $SHOTS,$OUTDIR | Out-Null

# .env
$envFile = Join-Path $SCRIPT_DIR '.env'
if (Test-Path $envFile) { Get-Content $envFile | Where-Object {$_ -match '='} | ForEach-Object {
  $k,$v = $_ -split '=',2; if ($k -and $k[0] -ne '#') { Set-Item "env:$($k.Trim())" $v.Trim() } } }

$ALLOW = ($env:ALLOW_CREDIT_CALLS -eq 'true')
$SEND_TG = ($env:SEND_TELEGRAM -eq 'true')
$FINAL_SCALE = if ($env:COG_FINAL_SCALE) { $env:COG_FINAL_SCALE } else { '2' }
if ($Approve) { $env:APPROVE='true' }
$searchDirs = @("$env:USERPROFILE\Downloads","$env:USERPROFILE\Desktop",
  "$env:USERPROFILE\Pictures","$env:USERPROFILE\Pictures\Screenshots")

function Find-First($rx){
  $hits = foreach($d in $searchDirs){ if(Test-Path $d){
    Get-ChildItem $d -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -match $rx } } }
  ($hits | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
}

# 0. python env + ffmpeg
Log "setting up python env…"
$PY="$EP_DIR\.venv\Scripts\python.exe"
if (-not (Test-Path $PY)) { & python -m venv "$EP_DIR\.venv" }
& $PY -m pip install -q --upgrade pip 2>$null
& $PY -m pip install -q pillow numpy imageio-ffmpeg 2>$null
$FFMPEG = & $PY -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"
Log "ffmpeg: $FFMPEG"

# 1. avatar / facial video
$AV = $AvatarVideo; if (-not $AV) { $AV = Find-First 'avatar|heygen|talking|facial|\.mp4$|\.mov$' }
if ($AV -and (Test-Path $AV)) {
  Copy-Item $AV "$RUN\avatar.mp4" -Force; Log "avatar video: $AV"
  if (-not (Test-Path "$SHOTS\heygen.png")) {
    Log "deriving chest-up heygen.png (top-anchored 4:5)…"
    & $FFMPEG -y -ss 1 -i "$RUN\avatar.mp4" -frames:v 1 -vf "crop='min(iw,ih*4/5)':'min(ih,iw*5/4)':(iw-ow)/2:0,scale=864:1080" "$SHOTS\heygen.png" 2>$null }
} else { Warn "no avatar/facial video found — heygen stays PLACEHOLDER (-AvatarVideo <path>)" }

# 2. voice / audio
$VO = $VoiceAudio; if (-not $VO) { $VO = Find-First 'vo|eleven|voice|narration|\.mp3$|\.wav$|\.m4a$' }
if ($VO -and (Test-Path $VO)) {
  & $FFMPEG -y -i $VO "$RUN\vo.mp3" 2>$null; Log "voice: $VO"
} elseif ($ALLOW -and $env:ELEVENLABS_API_KEY -and $env:ELEVENLABS_VOICE_ID) {
  Log "ALLOW_CREDIT_CALLS=true — generating VO via ElevenLabs…"
  & $PY "$SCRIPT_DIR\_eleven_tts.py" "$RUN\script.md" "$RUN\vo.mp3" $env:ELEVENLABS_VOICE_ID $env:ELEVENLABS_API_KEY
} else { Warn "no voice audio — elevenlabs stays PLACEHOLDER (-VoiceAudio <path>, or ALLOW_CREDIT_CALLS=true + keys)" }
if ((Test-Path "$RUN\vo.mp3") -and -not (Test-Path "$SHOTS\elevenlabs.png")) {
  & $FFMPEG -y -i "$RUN\vo.mp3" -filter_complex "showwavespic=s=1200x400:colors=0x00E5FF|0x58A6FF" -frames:v 1 "$SHOTS\elevenlabs.png" 2>$null
  Log "elevenlabs.png waveform derived" }

# 3. telegram delivery screenshot
$TG = $TelegramShot; if (-not $TG) { $TG = Find-First 'telegram|delivery|delivered' }
if ($TG -and (Test-Path $TG)) { Copy-Item $TG "$SHOTS\telegram.png" -Force; Log "telegram shot: $TG" }
else { Warn "no telegram screenshot — telegram stays PLACEHOLDER (-TelegramShot <path>)" }
if ($QcShot -and (Test-Path $QcShot)) { Copy-Item $QcShot "$SHOTS\qc.png" -Force; Log "qc shot: $QcShot" }

# 5. privacy / QC gate
Log "privacy scan on supplied crops…"
foreach ($f in 'heygen','elevenlabs','telegram','qc') {
  $img = "$SHOTS\$f.png"; if (-not (Test-Path $img)) { continue }
  $json = & $PY $VISION privacy --image $img 2>$null | Out-String
  if ($json -match '"publish_safe":\s*false') { Die "PRIVACY FAIL on $f.png — redact and re-run." }
  Log "  $f.png privacy: ok"
}

# 6. render all-real V7 preview
Log "rendering all-real V7 preview (12s)…"
Push-Location $SF; $env:COG_S='1'; & $PY animate.py; Pop-Location
if (Test-Path "$RUN\vo.mp3") {
  & $FFMPEG -y -i "$SF\preview.mp4" -i "$RUN\vo.mp3" -map 0:v -map 1:a -c:v copy -c:a aac -shortest "$OUTDIR\preview_real.mp4" 2>$null
} else { Copy-Item "$SF\preview.mp4" "$OUTDIR\preview_real.mp4" -Force }
Copy-Item "$SF\preview_contact.png" "$OUTDIR\preview_contact.png" -Force -ErrorAction SilentlyContinue
Log "preview -> $OUTDIR\preview_real.mp4"

# 7. STOP for approval
if ($env:APPROVE -ne 'true') {
  Write-Host ""; Log "REVIEW: $OUTDIR\preview_real.mp4"
  foreach ($f in 'heygen','elevenlabs','telegram','qc') {
    if (Test-Path "$SHOTS\$f.png") { Write-Host "   [x] $f.png" } else { Write-Host "   [ ] $f.png (PLACEHOLDER)" } }
  if (Test-Path "$RUN\vo.mp3") { Write-Host "   [x] vo.mp3 (audio)" } else { Write-Host "   [ ] vo.mp3 (silent)" }
  Write-Host ""; Log "If approved, render final:  -Approve  (e.g. ...run_local_ep002.ps1 -Approve)"
  exit 0
}

# 8. FINAL render
Log "approved — rendering final at scale=$FINAL_SCALE…"
Push-Location $SF; $env:COG_S=$FINAL_SCALE
if (Test-Path "$SF\final_ep002.py") { & $PY final_ep002.py; $FINAL_SRC="$SF\final.mp4" }
else { Warn "no 60s timeline yet — rendering current V7 cut at high quality as ship candidate."; & $PY animate.py; $FINAL_SRC="$SF\preview.mp4" }
Pop-Location
if (Test-Path "$RUN\vo.mp3") {
  & $FFMPEG -y -i $FINAL_SRC -i "$RUN\vo.mp3" -map 0:v -map 1:a -c:v copy -c:a aac -shortest "$OUTDIR\ep002_final.mp4" 2>$null
} else { Copy-Item $FINAL_SRC "$OUTDIR\ep002_final.mp4" -Force }
Log "final -> $OUTDIR\ep002_final.mp4"

# 9. optional Telegram delivery
if ($SEND_TG -and $env:TELEGRAM_BOT_TOKEN -and $env:TELEGRAM_CHAT_ID) {
  Log "sending final to Telegram…"
  $u = "https://api.telegram.org/bot$($env:TELEGRAM_BOT_TOKEN)/sendDocument"
  $form = @{ chat_id = $env:TELEGRAM_CHAT_ID; caption = "Cognitia Republic — EP002"; document = Get-Item "$OUTDIR\ep002_final.mp4" }
  try { $r = Invoke-RestMethod -Uri $u -Method Post -Form $form; if ($r.ok) { Log "Telegram delivery OK" } else { Warn "Telegram failed" } }
  catch { Warn "Telegram send failed: $_" }
} else { Log "Telegram send skipped (SEND_TELEGRAM=true + token + chat id)" }
Log "DONE."
