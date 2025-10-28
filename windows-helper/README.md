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


