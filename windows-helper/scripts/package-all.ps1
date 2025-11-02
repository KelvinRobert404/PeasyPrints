Param(
    [string]$Configuration = "Release",
    [string]$Runtime = "win-x64",
    [bool]$SelfContained = $true,
    [string]$ApiKey
)

$ErrorActionPreference = "Stop"

Write-Host "[A/5] Building Modern app..." -ForegroundColor Cyan
if ($ApiKey) {
  & "$PSScriptRoot\package.ps1" -Configuration $Configuration -Runtime $Runtime -SelfContained:$SelfContained -ApiKey $ApiKey | Write-Output
} else {
  & "$PSScriptRoot\package.ps1" -Configuration $Configuration -Runtime $Runtime -SelfContained:$SelfContained | Write-Output
}

Write-Host "[B/5] Building Legacy app..." -ForegroundColor Cyan
$msbuildCmd = Get-Command msbuild -ErrorAction SilentlyContinue
if ($msbuildCmd) {
  & "$PSScriptRoot\package-legacy.ps1" -Configuration $Configuration | Write-Output
} else {
  Write-Warning "MSBuild not found. Skipping Legacy app build. Install Build Tools for Visual Studio to enable Win7 installer."
}

# Try to compile installers if Inno Setup compiler is available
function Find-ISCC {
  $cmd = Get-Command iscc.exe -ErrorAction SilentlyContinue
  $candidates = @()
  if ($cmd) { $candidates += $cmd.Source }
  $candidates += "C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe"
  $candidates += "C:\\Program Files\\Inno Setup 6\\ISCC.exe"
  $candidates = $candidates | Where-Object { $_ -and (Test-Path $_) }
  if ($candidates -and $candidates[0]) { return $candidates[0] }
  return $null
}

$iscc = Find-ISCC
if ($iscc -and (Test-Path $iscc)) {
  # Ensure branding icon exists; if missing, try to auto-generate from SVG using ImageMagick
  $ico = Join-Path $PSScriptRoot "..\installer\branding\swoop.ico"
  if (-not (Test-Path $ico)) {
    $brandingDir = Split-Path $ico -Parent
    New-Item -ItemType Directory -Force -Path $brandingDir | Out-Null
    $magickCmd = Get-Command magick -ErrorAction SilentlyContinue
    $magick = $null
    if ($magickCmd) { $magick = $magickCmd.Source }
    $svgDir = Join-Path $PSScriptRoot "..\..\public\figma"
    $svgCandidates = @()
    if (Test-Path $svgDir) { $svgCandidates = Get-ChildItem -Path $svgDir -Filter *.svg -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending }
    if ($magick -and $svgCandidates -and $svgCandidates.Length -gt 0) {
      $svg = $svgCandidates[0].FullName
      Write-Host "[C0] Generating branding icon from SVG: $svg" -ForegroundColor Cyan
      & $magick convert "$svg" -resize 256x256 -background none -define icon:auto-resize=256,128,64,48,32,16 "$ico" | Write-Output
    } else {
      Write-Warning "Branding icon missing and could not auto-generate (need ImageMagick and a public/figma/*.svg). Installers will use default icon."
    }
  }
  Write-Host "[C/5] Compiling Modern installer..." -ForegroundColor Cyan
  & "$iscc" (Join-Path $PSScriptRoot "..\installer\PeasyPrint.Modern.iss")
  Write-Host "[D/5] Compiling Legacy installer..." -ForegroundColor Cyan
  & "$iscc" (Join-Path $PSScriptRoot "..\installer\PeasyPrint.Legacy.iss")
} else {
  Write-Warning "Inno Setup compiler not found. Skipping .iss compilation. Install Inno Setup 6 and ensure ISCC.exe is in PATH."
}

Write-Host "[E/5] Done. Outputs:" -ForegroundColor Green
Write-Host " - Modern ZIP: windows-helper\\dist\\PeasyPrint.Helper.zip"
Write-Host " - Modern publish: windows-helper\\PeasyPrint.Helper\\app"
Write-Host " - Legacy publish: windows-helper\\PeasyPrint.Helper.Legacy\\app"
Write-Host " - Installers (if compiled): check windows-helper\\installer\\Output or Inno default output"


