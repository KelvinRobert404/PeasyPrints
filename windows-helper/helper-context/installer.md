# Installer notes (Inno Setup, v1.0.1)

- Script: `windows-helper/installer/PeasyPrint.Modern.iss`
- Output: `windows-helper/installer/PeasyHelper-Win10.exe`
- Behavior:
  - Installs to `C:\Program Files\PeasyPrint\PeasyPrint.Helper\`
  - Registers `peasyprint://` protocol to `PeasyPrint.Helper.exe "%1"`
  - Optional auto-start task (tray mode)
  - Closes running helper processes on upgrade (Restart Manager)
  - Single-instance lock (`AppMutex=Global\PeasyPrint.Helper`)
  - Prompts for `PEASYPRINT_API_KEY` (and optional `PEASYPRINT_API_BASE`)

Dev notes:
- You can still register the protocol manually via the generated `peasyprint-protocol.reg` under the publish/app folder.
- The web app exposes a download endpoint at `/api/helper/download` that serves the installer EXE when present (ZIP fallback).
