# Packaging helper locally

Run from project root in PowerShell:

```powershell
pwsh windows-helper\scripts\package.ps1
```

Outputs:
- `windows-helper/dist/PeasyPrint.Helper.zip` (publish folder + protocol `.reg`)
- `windows-helper/PeasyPrint.Helper/bin/Release/net8.0-windows/win-x64/publish/peasyprint-protocol.reg`

Install steps on a Windows PC:
1. Unzip `PeasyPrint.Helper.zip` anywhere.
2. Double-click `peasyprint-protocol.reg` (accept prompt) to register `peasyprint://`.
3. Optional: create `%LOCALAPPDATA%\PeasyPrint\settings.json` with `{ "preferredPrinterNameSubstring": "Canon" }`.
4. Set `PEASYPRINT_API_BASE` (PowerShell): `$env:PEASYPRINT_API_BASE="https://your-api"`.
5. Launch a test: `peasyprint://print?file=https%3A%2F%2Fexample.com%2Fsample.pdf&copies=2&color=color` or jobId flow.
