param(
  [string]$Server = "http://localhost:3333"
)
$ErrorActionPreference = "Stop"
try {
  $r = Invoke-RestMethod -Method Post -Uri "$Server/api/streams/refresh" -ContentType "application/json"
  if (-not $r -or -not $r.streams) { throw "No streams" }
  # Prefer kind == 'grid', else name == 'GRID'
  $gridIndex = -1
  for ($i=0; $i -lt $r.streams.Count; $i++) {
    $s = $r.streams[$i]
    if (($s.kind -eq 'grid') -or ($s.name -eq 'GRID')) { $gridIndex = $i; break }
  }
  if ($gridIndex -lt 0) { throw "GRID not found" }
  Invoke-RestMethod -Method Post -Uri "$Server/api/streams/switch-by-index/$gridIndex" -ContentType "application/json" | Out-Null
} catch {
  Write-Error $_.Exception.Message
  exit 1
}
