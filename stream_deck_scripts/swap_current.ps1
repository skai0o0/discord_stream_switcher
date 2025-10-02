param(
  [string]$Server = "http://localhost:3333"
)
$ErrorActionPreference = "Stop"
try {
  $r = Invoke-RestMethod -Method Post -Uri "$Server/api/streams/refresh" -ContentType "application/json"
  if (-not $r -or -not $r.streams) { throw "No streams" }
  $i = [int]$r.currentIndex
  if ($i -lt 0) { throw "Invalid currentIndex" }
  Invoke-RestMethod -Method Post -Uri "$Server/api/streams/swap-by-index/$i" -ContentType "application/json" | Out-Null
} catch {
  Write-Error $_.Exception.Message
  exit 1
}
