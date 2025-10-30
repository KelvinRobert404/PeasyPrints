# PeasyPrint Windows Helper

A small Windows helper app that opens the native Windows Print dialog prefilled with A4, copies, and color/BW from a custom URL like `peasyprint://print?jobId=...`.

See the full guide: `docs/windows-print-helper.md`.

## Build prerequisites

- Windows 10/11
- .NET 8 SDK (Desktop)

## Run (dev)

- Launch with a custom URL or CLI args, e.g.:
  - `PeasyPrint.Helper.exe --file=https://example.com/sample.pdf --copies=2 --color=true`
  - `peasyprint://print?file=https%3A%2F%2Fexample.com%2Fsample.pdf&copies=2&color=bw`

PDF printing pipeline is implemented: PDFs are rendered via WinRT -> XPS. The print job name is set from the source file name when available (fallback: `PeasyPrint Job`). Some drivers may ignore requested `CopyCount`.

## Settings

- Stored at `%LOCALAPPDATA%/PeasyPrint/settings.json`:
  - `preferredPrinterNameSubstring`: optional string used to preselect a printer by name match.
  - `allowedDomains`: optional array of allowed website domains (future use).
  - `apiBaseOverride`: optional API base URL override (env `PEASYPRINT_API_BASE` wins).


## Install (ZIP)

1. Unzip the published folder (or the generated zip) to a permanent location, e.g. `C:\Program Files\PeasyPrint\PeasyPrint.Helper`.
2. Register the `peasyprint://` protocol to the publish EXE (recommended):

```powershell
$pubExe = 'C:\\Path\\To\\PeasyPrint.Helper\\bin\\Release\\net8.0-windows10.0.19041.0\\win-x64\\publish\\PeasyPrint.Helper.exe'
$base = 'HKCU:\\Software\\Classes\\peasyprint'
New-Item -Path $base -Force | Out-Null
Set-ItemProperty -Path $base -Name '(default)' -Value 'URL:PeasyPrint Protocol' -Type String -Force
New-ItemProperty -Path $base -Name 'URL Protocol' -Value '' -PropertyType String -Force
New-Item -Path "$base\\shell\\open\\command" -Force | Out-Null
Set-ItemProperty -Path "$base\\shell\\open\\command" -Name '(default)' -Value ("`"$pubExe`" `"%1`"") -Type String -Force
```

3. Set backend auth API key (pick one):
   - Double-click `peasyprint-api-key.reg` (user-scoped env var), or
   - Run `setup-peasyprint-env.ps1` (sets it and restarts Explorer), or
   - Manual PowerShell: `[Environment]::SetEnvironmentVariable("PEASYPRINT_API_KEY","<token>","User")`
4. Optional: set API base override with PowerShell: `$env:PEASYPRINT_API_BASE="https://<your-api-base>"`.
5. Test launch: `peasyprint://settings` and `peasyprint://print?file=https%3A%2F%2Fexample.com%2Fsample.pdf&copies=2&color=bw`.

