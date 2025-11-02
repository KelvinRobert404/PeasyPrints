# Installers (Modern and Legacy)

This folder contains two Inno Setup scripts:

- `PeasyPrint.Modern.iss` — Windows 10/11 installer
- `PeasyPrint.Legacy.iss` — Windows 7 installer (bundles SumatraPDF for non‑silent print dialog)

Build prerequisites:
- Inno Setup 6 (ISCC.exe on PATH recommended)

Build steps (recommended):
1) From repo root, run the unified packaging script (builds both apps and compiles installers if ISCC is found):
   ```powershell
   pwsh windows-helper\scripts\package-all.ps1 -Configuration Release -Runtime win-x64 -SelfContained $true -ApiKey "<YOUR_TOKEN>"
   ```
2) Outputs:
   - Modern app: `windows-helper/PeasyPrint.Helper/app`
   - Legacy app: `windows-helper/PeasyPrint.Helper.Legacy/app`
   - Modern ZIP: `windows-helper/dist/PeasyPrint.Helper.zip`
   - Installers: Inno default Output folder (or as configured)

Manual compile (if needed):
```powershell
"C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe" windows-helper\installer\PeasyPrint.Modern.iss
"C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe" windows-helper\installer\PeasyPrint.Legacy.iss
```

Sumatra for Legacy:
- Place `SumatraPDF.exe` at `windows-helper/installer/files/SumatraPDF.exe` before building the legacy installer.

What installers do:
- Install under `C:\\Program Files\\PeasyPrint\\...`
- Register `peasyprint://` protocol to the installed EXE
- Prompt for `PEASYPRINT_API_KEY` (and optional `PEASYPRINT_API_BASE`)
- Optionally enable auto‑start `--tray` (Modern only supports tray)
