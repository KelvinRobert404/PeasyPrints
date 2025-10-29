Param(
    [string]$Configuration = "Release",
    [string]$Runtime = "win-x64",
    [bool]$SelfContained = $false,
    [string]$ApiKey
)

$ErrorActionPreference = "Stop"

Write-Host "[1/5] Checking .NET SDK..." -ForegroundColor Cyan
try {
    $dotnetVersion = (& dotnet --version)
    Write-Host "Found .NET SDK: $dotnetVersion" -ForegroundColor Green
} catch {
    # Fallback: try user-scoped install at %USERPROFILE%\.dotnet
    $userDotnet = Join-Path $env:USERPROFILE ".dotnet\dotnet.exe"
    if (Test-Path $userDotnet) {
        $env:PATH = (Split-Path $userDotnet -Parent) + ";" + $env:PATH
        try {
            $dotnetVersion = (& dotnet --version)
            Write-Host "Found .NET SDK (user): $dotnetVersion" -ForegroundColor Green
        } catch {
            Write-Error ".NET SDK not found. Please install .NET 8 SDK and re-run."
            exit 1
        }
    } else {
        Write-Error ".NET SDK not found. Please install .NET 8 SDK and re-run."
        exit 1
    }
}

$projectPath = Join-Path $PSScriptRoot "..\PeasyPrint.Helper\PeasyPrint.Helper.csproj"
if (-not (Test-Path $projectPath)) {
    Write-Error "Project not found at $projectPath"
    exit 1
}

Write-Host "[2/5] Publishing helper..." -ForegroundColor Cyan
& dotnet publish $projectPath -c $Configuration -r $Runtime --self-contained:$SelfContained | Write-Output

$tfm = "net8.0-windows10.0.19041.0"
$publishDir = Join-Path $PSScriptRoot "..\PeasyPrint.Helper\bin\$Configuration\$tfm\$Runtime\publish"
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

# Generate optional API key .reg and setup script
Write-Host "[3b/5] Generating API key artifacts..." -ForegroundColor Cyan
$resolvedApiKey = if ($ApiKey -and $ApiKey.Trim().Length -gt 0) { $ApiKey } elseif ($env:PEASYPRINT_API_KEY) { $env:PEASYPRINT_API_KEY } else { 'YOUR_SECURE_TOKEN' }
$regApiContent = @"
Windows Registry Editor Version 5.00

[HKEY_CURRENT_USER\Environment]
"PEASYPRINT_API_KEY"="$resolvedApiKey"
"@
$regApiPath = Join-Path $publishDir "peasyprint-api-key.reg"
Set-Content -LiteralPath $regApiPath -Value $regApiContent -Encoding ASCII

# Also provide a PowerShell setup script for convenience
$psToken = $resolvedApiKey -replace '"','`"'
$setupPs = @"
[Environment]::SetEnvironmentVariable("PEASYPRINT_API_KEY","$psToken","User")
Write-Host "Set PEASYPRINT_API_KEY for current user." -ForegroundColor Green
try {
  Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
  Start-Process explorer.exe
  Write-Host "Restarted Explorer to apply environment changes." -ForegroundColor Yellow
} catch {}
"@
$setupPath = Join-Path $publishDir "setup-peasyprint-env.ps1"
Set-Content -LiteralPath $setupPath -Value $setupPs -Encoding UTF8

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
Write-Host "API key .reg: $regApiPath"
Write-Host "Setup script: $setupPath"

# Copy to canonical app folder for convenience
$appDir = Join-Path $PSScriptRoot "..\PeasyPrint.Helper\app"
New-Item -ItemType Directory -Force -Path $appDir | Out-Null
robocopy $publishDir $appDir /MIR | Out-Null
Write-Host "Copied app to: $appDir" -ForegroundColor Green

# Optional cleanup: keep only the single app folder (remove bin/obj)
try {
    $binDir = Join-Path $PSScriptRoot "..\PeasyPrint.Helper\bin"
    $objDir = Join-Path $PSScriptRoot "..\PeasyPrint.Helper\obj"
    if (Test-Path $binDir) { Remove-Item -Recurse -Force $binDir }
    if (Test-Path $objDir) { Remove-Item -Recurse -Force $objDir }
    Write-Host "Cleaned: bin/, obj/ -> dist/ and app/ preserved" -ForegroundColor Yellow
} catch {
    Write-Warning "Cleanup skipped: $($_.Exception.Message)"
}


