$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$manifest = Get-Content -Raw (Join-Path $root 'manifest.json') | ConvertFrom-Json
$version = $manifest.version
$dist = Join-Path $root 'dist'
$stage = Join-Path $dist 'unpacked'
$zip = Join-Path $dist "zero-click-translate-$version.zip"

if (Test-Path $dist) { Remove-Item -Recurse -Force $dist }
New-Item -ItemType Directory -Path (Join-Path $stage 'icons') | Out-Null
New-Item -ItemType Directory -Path (Join-Path $stage '_locales') | Out-Null

$files = @(
  'manifest.json',
  'background.js',
  'content.js',
  'content.css',
  'langs.js',
  'popup.html',
  'popup.js',
  'pricing.html',
  'pricing.js',
  'quotaManager.js',
  'entitlementManager.js'
)
foreach ($file in $files) {
  Copy-Item (Join-Path $root $file) (Join-Path $stage $file)
}

Copy-Item (Join-Path $root 'icons\icon16.png') (Join-Path $stage 'icons\icon16.png')
Copy-Item (Join-Path $root 'icons\icon32.png') (Join-Path $stage 'icons\icon32.png')
Copy-Item (Join-Path $root 'icons\icon48.png') (Join-Path $stage 'icons\icon48.png')
Copy-Item (Join-Path $root 'icons\icon128.png') (Join-Path $stage 'icons\icon128.png')
Copy-Item -Recurse (Join-Path $root '_locales\en') (Join-Path $stage '_locales\en')
Copy-Item -Recurse (Join-Path $root '_locales\zh_CN') (Join-Path $stage '_locales\zh_CN')

if (Test-Path $zip) { Remove-Item -Force $zip }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip

$haystack = Get-ChildItem -Recurse $stage -File | ForEach-Object { Get-Content -Raw $_.FullName }
if ($haystack -match 'AIza|JWT_SECRET|secrets\.js') {
  throw 'Pack rejected: secret-like string found in unpacked files.'
}

Write-Output $zip
