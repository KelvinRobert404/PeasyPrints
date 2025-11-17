# Packaging helper locally (Modern, v1.0.1)

From repo root (PowerShell):

```powershell
# Build app + ZIP only
powershell -NoProfile -ExecutionPolicy Bypass -File .\windows-helper\scripts\package.ps1 -Configuration Release -Runtime win-x64

# Build app + ZIP and compile installer (if ISCC is installed)
powershell -NoProfile -ExecutionPolicy Bypass -File .\windows-helper\scripts\package-all.ps1 -Configuration Release -Runtime win-x64 -SelfContained $true -ApiKey "<YOUR_TOKEN>"
```

Outputs:
- App: `windows-helper/PeasyPrint.Helper/app`
- ZIP: `windows-helper/dist/PeasyPrint.Helper.zip`
- Installer: `windows-helper/installer/PeasyHelper-Win10.exe`

Manual install (ZIP):
1) Unzip `PeasyPrint.Helper.zip` anywhere (e.g., `C:\Program Files\PeasyPrint\PeasyPrint.Helper`).
2) Register protocol (either `peasyprint-protocol.reg` or the Inno installer).
3) Set `PEASYPRINT_API_KEY` for the user.
4) Test: `peasyprint://print?file=...` or `peasyprint://settings`.
