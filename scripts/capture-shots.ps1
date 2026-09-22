$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$edge = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $edge) { throw 'Chrome or Edge not found' }

New-Item -ItemType Directory -Force -Path (Join-Path $root 'store\listing') | Out-Null

$shots = @(
  @{ url = 'http://127.0.0.1:8765/store/shots/overlay.html'; out = 'store\listing\shot-overlay.png'; w = 1280; h = 800 },
  @{ url = 'http://127.0.0.1:8765/store/shots/popup.html'; out = 'store\listing\shot-popup.png'; w = 1280; h = 800 },
  @{ url = 'http://127.0.0.1:8765/store/shots/quota.html'; out = 'store\listing\shot-quota.png'; w = 1280; h = 800 },
  @{ url = 'http://127.0.0.1:8765/store/shots/tile.html'; out = 'store\listing\tile-440x280.png'; w = 440; h = 280 }
)

foreach ($s in $shots) {
  $abs = Join-Path $root $s.out
  if (Test-Path $abs) { Remove-Item $abs -Force }
  & $edge --headless=new --disable-gpu --hide-scrollbars --window-size="$($s.w),$($s.h)" --screenshot="$abs" $s.url
  Start-Sleep -Seconds 1
  if (-not (Test-Path $abs)) { throw "Failed: $($s.out)" }
  Write-Output $s.out
}
