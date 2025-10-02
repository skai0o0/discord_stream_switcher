<#
One-click setup v3 (Windows, PowerShell) — OPTION A
- Run server (npm start / node server.js) in the SAME PowerShell window.
- Open dashboard before starting the server (so the browser pops).
- Print guidance in this same window, then hand over to server logs.
#>

param(
  [string]$ProjectDir = "$PSScriptRoot",
  [int]$DebugPort = 9222,
  [int]$ServerPort = 3333
)

$ErrorActionPreference = "Stop"

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "[ERR ] $msg" -ForegroundColor Red }

# 0) Launch Discord in debug mode
try {
  $discordUpdate = Join-Path $env:LocalAppData "Discord\Update.exe"
  if (Test-Path $discordUpdate) {
    Write-Info "Launching Discord in debug mode on port $DebugPort ..."
    Start-Process -FilePath $discordUpdate -ArgumentList "--processStart Discord.exe --process-start-args=`"--remote-debugging-port=$DebugPort`"" -WindowStyle Minimized
    Start-Sleep -Seconds 2
  } else {
    Write-Warn "Discord Update.exe not found at $discordUpdate."
    Write-Warn "Start manually with:  %LocalAppData%\Discord\Update.exe --processStart Discord.exe --process-start-args=\"--remote-debugging-port=$DebugPort\""
  }
} catch {
  Write-Warn "Failed to auto-launch Discord debug: $($_.Exception.Message)"
}

# 0.5) Check Node.js & npm
function Test-Command($name) {
  $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}
function Get-Node-VersionOrNull {
  try { (node --version) 2>$null } catch { return $null }
}
$hasNode = Test-Command "node"
$hasNpm  = Test-Command "npm"
if (-not ($hasNode -and $hasNpm)) {
  Write-Warn "Node.js/npm not found."
  $ans = Read-Host "Install Node.js LTS via winget now? [Y/N]"
  if ($ans -match '^(y|Y)$') {
    # Try winget LTS
    try {
      Write-Info "Installing Node.js LTS via winget..."
      # Common IDs: OpenJS.NodeJS.LTS or OpenJS.NodeJS
      winget install -e --id OpenJS.NodeJS.LTS -h --accept-package-agreements --accept-source-agreements
    } catch {
      Write-Warn "winget install failed or winget missing: $($_.Exception.Message)"
      Write-Info "Opening Node.js website for manual install..."
      Start-Process "https://nodejs.org/en/download"
      Write-Err "Please install Node.js manually, then re-run this script."
      exit 1
    }

    # Re-check
    $hasNode = Test-Command "node"
    $hasNpm  = Test-Command "npm"
    if (-not ($hasNode -and $hasNpm)) {
      Write-Err "Node.js/npm still not available after winget. Install manually, then re-run."
      exit 1
    } else {
      $ver = Get-Node-VersionOrNull
      Write-Info "Node installed. node --version = $ver"
    }
  } else {
    Write-Err "Node.js/npm required. Install Node.js (LTS) first, then re-run."
    exit 1
  }
} else {
  $ver = Get-Node-VersionOrNull
  Write-Info "Detected Node.js/npm. node --version = $ver"
}

# 1) Dependencies (skip if node_modules exists)
Set-Location -Path $ProjectDir
$nm = Join-Path $ProjectDir "node_modules"
$hasNodeModules = Test-Path $nm
$hasLock = Test-Path (Join-Path $ProjectDir "package-lock.json")

if (-not $hasNodeModules) {
  try {
    if ($hasLock) {
      Write-Info "node_modules missing"
      npm ci
    } else {
      Write-Info "node_modules missing"
      npm install
    }
  } catch {
    Write-Err "npm install failed: $($_.Exception.Message)"
    exit 1
  }
} else {
  Write-Info "node_modules found, skip install"
}

# 2) Detect Chromium availability and warn if missing
$chromeCandidates = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe",
  "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
)
$edgeCandidates = @(
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe"
)
$hasChrome = $false; foreach ($p in $chromeCandidates) { if (Test-Path $p) { $hasChrome = $true; break } }
$hasEdge = $false; foreach ($p in $edgeCandidates) { if (Test-Path $p) { $hasEdge = $true; break } }

if (-not ($hasChrome -or $hasEdge)) {
  Write-Err "No Chromium browser detected (Chrome/Edge not found). Remote inspect requires a Chromium-based browser."
}

# 3) Open dashboard BEFORE starting server (default browser)
try {
  $dash = "http://localhost:$ServerPort"
  Write-Info "Opening dashboard: $dash"
  Start-Process $dash | Out-Null
} catch {
  Write-Warn "Failed to open dashboard: $($_.Exception.Message)"
}

# 4) Print guidance in this SAME window
Write-Host ""
Write-Host "================= NEXT STEPS (READ CAREFULLY) =================" -ForegroundColor Green
if ($hasChrome) {
  Write-Host "A) In Chrome, navigate to: chrome://inspect/#devices" -ForegroundColor Green
} elseif ($hasEdge) {
  Write-Host "A) In Microsoft Edge, navigate to: edge://inspect/#devices" -ForegroundColor Green
} else {
  Write-Host "A) Install Chrome or Edge. Then open: chrome://inspect/#devices  (or)  edge://inspect/#devices" -ForegroundColor Yellow
}
Write-Host "B) Click 'Configure...' and add: localhost:$DebugPort (if not added already)" -ForegroundColor Green
Write-Host "C) Wait ~60 seconds for Discord tabs to appear. Find the Discord tab (voice channel) and click 'Inspect'." -ForegroundColor Green
Write-Host "D) In the DevTools window (right sidebar), open the Console tab." -ForegroundColor Green
Write-Host "E) Open the dashboard ($dash), Section 'Copy Script', click 'Copy Main Script'." -ForegroundColor Green
Write-Host "F) Paste the main script into the Discord DevTools Console and hit Enter." -ForegroundColor Green
Write-Host "G) Use the dashboard controls or Stream Deck scripts to switch/swap streams." -ForegroundColor Green
Write-Host "===============================================================" -ForegroundColor Green
Write-Host ""

# 5) Start server in THIS window (foreground)
function Has-NpmStart {
  try {
    $pkgPath = Join-Path $ProjectDir "package.json"
    if (!(Test-Path $pkgPath)) { return $false }
    $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
    return $pkg.scripts -and $pkg.scripts.start
  } catch { return $false }
}

try {
  if (Has-NpmStart) {
    Write-Info "Starting server via: npm start (foreground, same window)"
    npm start
  } elseif (Test-Path (Join-Path $ProjectDir "server.js")) {
    Write-Info "Starting server via: node server.js (foreground, same window)"
    node server.js
  } else {
    Write-Err "No start script or server.js found. Please add npm start or server.js"
  }
} catch {
  Write-Err "Failed to start server: $($_.Exception.Message)"
  exit 1
}
