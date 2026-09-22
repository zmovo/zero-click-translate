$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$srcPath = Join-Path $root 'icon-master.png'
if (-not (Test-Path $srcPath)) {
  $srcPath = 'C:\Users\leozhaoe\.cursor\projects\c-Innovation-zero-click-translate\assets\zct-icon-master.png'
}

$src = [System.Drawing.Image]::FromFile($srcPath)
$src.Save((Join-Path $root 'icon-master.png'), [System.Drawing.Imaging.ImageFormat]::Png)

foreach ($size in 16, 32, 48, 128) {
  $out = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($out)
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.DrawImage($src, 0, 0, $size, $size)
  $g.Dispose()
  $out.Save((Join-Path $root "icon$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $out.Dispose()
}

$src.Dispose()
Write-Output 'Wrote icons/icon16.png icon32.png icon48.png icon128.png'
