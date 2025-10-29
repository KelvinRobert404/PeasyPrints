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

Printing pipeline for PDF will be implemented next; current build shows the Windows dialog with prefilled options.

## Settings

- Stored at `%LOCALAPPDATA%/PeasyPrint/settings.json`:
  - `preferredPrinterNameSubstring`: optional string used to preselect a printer by name match.
  - `allowedDomains`: optional array of allowed website domains (future use).
  - `apiBaseOverride`: optional API base URL override (env `PEASYPRINT_API_BASE` wins).


## Install (ZIP)

1. Unzip the published folder (or the generated zip) to a permanent location, e.g. `C:\Program Files\PeasyPrint\PeasyPrint.Helper`.
2. Double-click `peasyprint-protocol.reg` to register the `peasyprint://` protocol.
3. Set backend auth API key (pick one):
   - Double-click `peasyprint-api-key.reg` (user-scoped env var), or
   - Run `setup-peasyprint-env.ps1` (sets it and restarts Explorer), or
   - Manual PowerShell: `[Environment]::SetEnvironmentVariable("PEASYPRINT_API_KEY","<token>","User")`
4. Optional: set API base override with PowerShell: `$env:PEASYPRINT_API_BASE="https://<your-api-base>"`.
5. Test launch: `peasyprint://print?file=https%3A%2F%2Fexample.com%2Fsample.pdf&copies=2&color=bw`.

