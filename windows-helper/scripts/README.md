# Packaging helper locally

Run from project root in PowerShell:

```powershell
pwsh windows-helper\scripts\package.ps1
```

Outputs:
- `windows-helper/dist/PeasyPrint.Helper.zip` (publish folder + protocol `.reg`)
- `windows-helper/PeasyPrint.Helper/bin/Release/net8.0-windows10.0.19041.0/win-x64/publish/peasyprint-protocol.reg`

Install steps on a Windows PC:
1. Unzip `PeasyPrint.Helper.zip` anywhere.
2. Register `peasyprint://` to the publish EXE (recommended), or double‑click the generated `.reg` inside the publish folder.

Recommended manual registration:
```powershell
$pubExe = 'C:\\Path\\To\\PeasyPrint.Helper\\bin\\Release\\net8.0-windows10.0.19041.0\\win-x64\\publish\\PeasyPrint.Helper.exe'
$base = 'HKCU:\\Software\\Classes\\peasyprint'
New-Item -Path $base -Force | Out-Null
Set-ItemProperty -Path $base -Name '(default)' -Value 'URL:PeasyPrint Protocol' -Type String -Force
New-ItemProperty -Path $base -Name 'URL Protocol' -Value '' -PropertyType String -Force
New-Item -Path "$base\\shell\\open\\command" -Force | Out-Null
Set-ItemProperty -Path "$base\\shell\\open\\command" -Name '(default)' -Value ("`"$pubExe`" `"%1`"") -Type String -Force
Stop-Process -Name explorer -Force; Start-Process explorer.exe
```
3. Optional: create `%LOCALAPPDATA%\PeasyPrint\settings.json` with `{ "preferredPrinterNameSubstring": "Canon" }`.
4. Set `PEASYPRINT_API_BASE` (PowerShell): `$env:PEASYPRINT_API_BASE="https://your-api"`.
5. Launch a test: `peasyprint://settings` and `peasyprint://print?file=https%3A%2F%2Fexample.com%2Fsample.pdf&copies=2&color=color`, or a jobId/jobUrl flow.



