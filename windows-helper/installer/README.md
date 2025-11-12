# Installer (Modern)

This folder contains the Inno Setup script for Windows 10/11:

- `PeasyPrint.Modern.iss` — Windows 10/11 installer

Build prerequisites:
- Inno Setup 6 (ISCC.exe on PATH recommended)

Build steps (recommended):
1) From repo root, run the packaging script (builds the app and compiles the installer if ISCC is found):
   ```powershell
   pwsh windows-helper\scripts\package-all.ps1 -Configuration Release -Runtime win-x64 -SelfContained $true -ApiKey "<YOUR_TOKEN>"
   ```
2) Outputs:
   - Modern app: `windows-helper/PeasyPrint.Helper/app`
   - Modern ZIP: `windows-helper/dist/PeasyPrint.Helper.zip`
   - Installer: Inno default Output folder (or as configured)

Manual compile (if needed):
```powershell
"C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe" windows-helper\installer\PeasyPrint.Modern.iss
```

What the installer does:
- Installs under `C:\\Program Files\\PeasyPrint\\PeasyPrint.Helper`
- Registers `peasyprint://` protocol to the installed EXE
- Prompts for `PEASYPRINT_API_KEY` (and optional `PEASYPRINT_API_BASE`)
- Optional auto‑start `--tray`
