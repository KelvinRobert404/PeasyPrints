# PeasyPrint Windows Helper

A small Windows helper app that opens the native Windows Print dialog prefilled with A4, copies, and color/BW from a custom URL like `peasyprint://print?jobId=...`.

## Build prerequisites

- Windows 10/11
- .NET 8 SDK (Desktop)

## Run (dev)

- Launch with a custom URL or CLI args, e.g.:
  - `PeasyPrint.Helper.exe --file=https://example.com/sample.pdf --copies=2 --color=true`
  - `peasyprint://print?file=https%3A%2F%2Fexample.com%2Fsample.pdf&copies=2&color=bw`

Printing pipeline for PDF will be implemented next; current build shows the Windows dialog with prefilled options.


