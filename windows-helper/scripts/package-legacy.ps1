Param(
    [string]$Configuration = "Release"
)

$ErrorActionPreference = "Stop"

Write-Host "[1/3] Building Legacy helper (net48)..." -ForegroundColor Cyan
$proj = Join-Path $PSScriptRoot "..\PeasyPrint.Helper.Legacy\PeasyPrint.Helper.Legacy.csproj"
if (-not (Test-Path $proj)) { Write-Error "Legacy project not found: $proj" }

& msbuild $proj "/t:Restore;Build" "/p:Configuration=$Configuration" | Write-Output

$outDir = Join-Path $PSScriptRoot "..\PeasyPrint.Helper.Legacy\bin\$Configuration"
if (-not (Test-Path $outDir)) { Write-Error "Build output not found: $outDir" }

Write-Host "[2/3] Preparing app folder..." -ForegroundColor Cyan
$appDir = Join-Path $PSScriptRoot "..\PeasyPrint.Helper.Legacy\app"
New-Item -ItemType Directory -Force -Path $appDir | Out-Null
robocopy $outDir $appDir PeasyPrint.Helper.Legacy.exe PeasyPrint.Helper.Legacy.exe.config *.dll /XO | Out-Null

# Bundle Sumatra if present next to installer script files\SumatraPDF.exe
$sumatraSrc = Join-Path $PSScriptRoot "..\installer\files\SumatraPDF.exe"
if (Test-Path $sumatraSrc) {
  Copy-Item $sumatraSrc (Join-Path $appDir "SumatraPDF.exe") -Force
  Write-Host "Bundled SumatraPDF.exe" -ForegroundColor Green
} else {
  Write-Warning "SumatraPDF.exe not found at windows-helper/installer/files/SumatraPDF.exe. The legacy installer will fail to launch print dialog."
}

Write-Host "[3/3] Legacy app prepared at: $appDir" -ForegroundColor Green


