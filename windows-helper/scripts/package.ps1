Param(
    [string]$Configuration = "Release",
    [string]$Runtime = "win-x64",
    [bool]$SelfContained = $false
)

$ErrorActionPreference = "Stop"

Write-Host "[1/5] Checking .NET SDK..." -ForegroundColor Cyan
try {
    $dotnetVersion = (& dotnet --version)
    Write-Host "Found .NET SDK: $dotnetVersion" -ForegroundColor Green
} catch {
    Write-Error ".NET SDK not found. Please install .NET 8 SDK and re-run."
    exit 1
}

$projectPath = Join-Path $PSScriptRoot "..\PeasyPrint.Helper\PeasyPrint.Helper.csproj"
if (-not (Test-Path $projectPath)) {
    Write-Error "Project not found at $projectPath"
    exit 1
}

Write-Host "[2/5] Publishing helper..." -ForegroundColor Cyan
& dotnet publish $projectPath -c $Configuration -r $Runtime --self-contained:$SelfContained | Write-Output

$publishDir = Join-Path $PSScriptRoot "..\PeasyPrint.Helper\bin\$Configuration\net8.0-windows\$Runtime\publish"
if (-not (Test-Path $publishDir)) {
    Write-Error "Publish output not found at $publishDir"
    exit 1
}

$exePath = Join-Path $publishDir "PeasyPrint.Helper.exe"
if (-not (Test-Path $exePath)) {
    Write-Error "Helper EXE not found at $exePath"
    exit 1
}

Write-Host "[3/5] Generating protocol .reg file..." -ForegroundColor Cyan
$escapedExe = $exePath -replace "\\", "\\\\"
$regContent = @"
Windows Registry Editor Version 5.00

[HKEY_CLASSES_ROOT\peasyprint]
@="URL:PeasyPrint Protocol"
"URL Protocol"=""

[HKEY_CLASSES_ROOT\peasyprint\shell]

[HKEY_CLASSES_ROOT\peasyprint\shell\open]

[HKEY_CLASSES_ROOT\peasyprint\shell\open\command]
@="\"$escapedExe\" \"%1\""
"@

$regPath = Join-Path $publishDir "peasyprint-protocol.reg"
Set-Content -LiteralPath $regPath -Value $regContent -Encoding ASCII

Write-Host "[4/5] Creating ZIP..." -ForegroundColor Cyan
$distDir = Join-Path $PSScriptRoot "..\dist"
New-Item -ItemType Directory -Force -Path $distDir | Out-Null
$zipPath = Join-Path $distDir "PeasyPrint.Helper.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path (Join-Path $publishDir '*') -DestinationPath $zipPath

Write-Host "[5/5] Done" -ForegroundColor Green
Write-Host "ZIP: $zipPath"
Write-Host "Publish folder: $publishDir"
Write-Host "Protocol .reg: $regPath"


