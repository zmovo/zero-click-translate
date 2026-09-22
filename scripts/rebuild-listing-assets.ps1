$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root
$listing = Join-Path $root 'store\listing'
New-Item -ItemType Directory -Force -Path $listing | Out-Null

# Soft brand: muted teal-slate (not electric blue)
$brand = [System.Drawing.Color]::FromArgb(255, 47, 93, 98)      # #2f5d62
$brandLight = [System.Drawing.Color]::FromArgb(255, 90, 140, 130)
$paper = [System.Drawing.Color]::FromArgb(255, 244, 246, 243)
$paperMid = [System.Drawing.Color]::FromArgb(255, 228, 235, 230)
$ink = [System.Drawing.Color]::FromArgb(255, 26, 43, 46)
$muted = [System.Drawing.Color]::FromArgb(255, 77, 100, 104)

function Save-Jpeg24([System.Drawing.Bitmap]$bmp, [string]$path, [int]$quality = 92) {
  $encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
    Where-Object { $_.MimeType -eq 'image/jpeg' }
  $ep = New-Object System.Drawing.Imaging.EncoderParameters 1
  $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter (
    [System.Drawing.Imaging.Encoder]::Quality, [long]$quality)
  $bmp.Save($path, $encoder, $ep)
  $ep.Dispose()
}

function Save-Png24([System.Drawing.Bitmap]$src, [string]$path) {
  $out = New-Object System.Drawing.Bitmap $src.Width, $src.Height, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [System.Drawing.Graphics]::FromImage($out)
  $g.Clear([System.Drawing.Color]::White)
  $g.DrawImage($src, 0, 0, $src.Width, $src.Height)
  $g.Dispose()
  $out.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $out.Dispose()
}

# --- Soft icon master + sizes ---
$iconDir = Join-Path $root 'icons'
$master = New-Object System.Drawing.Bitmap 512, 512, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($master)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g.Clear([System.Drawing.Color]::Transparent)
$radius = 112
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddArc(16, 16, $radius, $radius, 180, 90)
$path.AddArc(512 - 16 - $radius, 16, $radius, $radius, 270, 90)
$path.AddArc(512 - 16 - $radius, 512 - 16 - $radius, $radius, $radius, 0, 90)
$path.AddArc(16, 512 - 16 - $radius, $radius, $radius, 90, 90)
$path.CloseFigure()
$brush = New-Object System.Drawing.SolidBrush $brand
$g.FillPath($brush, $path)
$brush.Dispose()
$path.Dispose()

$white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$fontA = New-Object System.Drawing.Font 'Segoe UI', 148, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$fontC = New-Object System.Drawing.Font 'Microsoft YaHei UI', 136, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center
$sf.LineAlignment = [System.Drawing.StringAlignment]::Center
$g.DrawString('A', $fontA, $white, (New-Object System.Drawing.RectangleF 40, 120, 180, 280), $sf)
$g.DrawString('文', $fontC, $white, (New-Object System.Drawing.RectangleF 292, 130, 180, 280), $sf)
$pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), 14
$pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$g.DrawLine($pen, 220, 256, 292, 256)
$g.DrawLine($pen, 232, 236, 220, 256)
$g.DrawLine($pen, 232, 276, 220, 256)
$g.DrawLine($pen, 280, 236, 292, 256)
$g.DrawLine($pen, 280, 276, 292, 256)
$pen.Dispose(); $white.Dispose(); $fontA.Dispose(); $fontC.Dispose(); $sf.Dispose(); $g.Dispose()

$masterPath = Join-Path $iconDir 'icon-master.png'
$master.Save($masterPath, [System.Drawing.Imaging.ImageFormat]::Png)
foreach ($size in 16, 32, 48, 128) {
  $out = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $gg = [System.Drawing.Graphics]::FromImage($out)
  $gg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $gg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $gg.Clear([System.Drawing.Color]::Transparent)
  $gg.DrawImage($master, 0, 0, $size, $size)
  $gg.Dispose()
  $out.Save((Join-Path $iconDir "icon$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  # Store icon: also write opaque 128 JPEG-safe PNG24 for CWS
  if ($size -eq 128) {
    Save-Png24 $out (Join-Path $listing 'store-icon-128.png')
  }
  $out.Dispose()
}
$master.Dispose()

# --- Exact 440x280 small promo tile (JPEG + PNG24) ---
$tile = New-Object System.Drawing.Bitmap 440, 280, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$tg = [System.Drawing.Graphics]::FromImage($tile)
$tg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$tg.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
  (New-Object System.Drawing.Rectangle 0, 0, 440, 280),
  $paper,
  $paperMid,
  155.0)
$tg.FillRectangle($bg, 0, 0, 440, 280)
$bg.Dispose()

$markRect = New-Object System.Drawing.Rectangle 28, 28, 48, 48
$pathM = New-Object System.Drawing.Drawing2D.GraphicsPath
$pathM.AddArc(28, 28, 16, 16, 180, 90)
$pathM.AddArc(60, 28, 16, 16, 270, 90)
$pathM.AddArc(60, 60, 16, 16, 0, 90)
$pathM.AddArc(28, 60, 16, 16, 90, 90)
$pathM.CloseFigure()
$mb = New-Object System.Drawing.SolidBrush $brand
$tg.FillPath($mb, $pathM)
$mb.Dispose(); $pathM.Dispose()
$wbrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$mf = New-Object System.Drawing.Font 'Segoe UI', 13, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$msf = New-Object System.Drawing.StringFormat
$msf.Alignment = [System.Drawing.StringAlignment]::Center
$msf.LineAlignment = [System.Drawing.StringAlignment]::Center
$tg.DrawString('A↔文', $mf, $wbrush, (New-Object System.Drawing.RectangleF 28, 28, 48, 48), $msf)
$mf.Dispose(); $msf.Dispose(); $wbrush.Dispose()

$titleF = New-Object System.Drawing.Font 'Segoe UI Semibold', 26, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$bodyF = New-Object System.Drawing.Font 'Segoe UI', 15, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$inkB = New-Object System.Drawing.SolidBrush $ink
$mutB = New-Object System.Drawing.SolidBrush $muted
$tg.DrawString('Zero Click Translate', $titleF, $inkB, 28, 96)
$tg.DrawString("Select text. The translation`nappears beside it.", $bodyF, $mutB, 28, 138)
$titleF.Dispose(); $bodyF.Dispose(); $inkB.Dispose(); $mutB.Dispose(); $tg.Dispose()

$tilePng = Join-Path $listing 'tile-440x280.png'
$tileJpg = Join-Path $listing 'tile-440x280.jpg'
Save-Png24 $tile $tilePng
Save-Jpeg24 $tile $tileJpg 92
$tile.Dispose()

Write-Output "Wrote soft icons + exact tile JPEG/PNG"
Write-Output $tilePng
Write-Output $tileJpg
