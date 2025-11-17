# Windows Helper Ops (v1.0.1)

- Installer: `windows-helper/installer/PeasyHelper-Win10.exe`
- Download endpoint: `/api/helper/download` (serves EXE if present, ZIP fallback)
- Protocol: `peasyprint://print?...` and `peasyprint://settings`

Install (shops)
- Run the EXE; accept prompts; enter `PEASYPRINT_API_KEY`.
- It registers `peasyprint://` and can auto-start in tray.
- Re-run the EXE to upgrade in place; it closes running instances.

Env/Config
- User env: `PEASYPRINT_API_KEY` (required if server enforces auth)
- Optional: `PEASYPRINT_API_BASE` (override; otherwise the helper uses the jobUrl or site origin)
- Settings file: `%LOCALAPPDATA%/PeasyPrint/settings.json` (printer name substrings, ApiBaseOverride)

Common issues
- 401 Unauthorized: token mismatch. Set user `PEASYPRINT_API_KEY` == server `PEASYPRINT_API_KEY`.
- HTML instead of JSON: hitting login/redirect. Use `https://www.theswoop.club/api` (not apex), or pass a full `jobUrl`. Ensure Vercel Functions lists `/api/print-jobs/[id]` and Domains map apex→www with redirect.
- Multiple processes: v1.0.1 enforces single-instance and installer closes running helper.
- Protocol not opening: import `peasyprint-protocol.reg` that points to the actual EXE path; restart Explorer.

Versioning / verification
- App shows Settings title “v1.0.1”.
- On a PC, verify running EXE:
  - `Get-Process PeasyPrint.Helper | Select Id,Path,@{n='Version';e={$_.FileVersionInfo.ProductVersion}}`
- Hash the EXE:
  - `Get-FileHash "C:\Program Files\PeasyPrint\PeasyPrint.Helper\PeasyPrint.Helper.exe" -Algorithm SHA256`

Build notes (internal)
- Build & package: `windows-helper/scripts/package-all.ps1 -Configuration Release -Runtime win-x64 -SelfContained $true`
- Only ZIP/app: `windows-helper/scripts/package.ps1`
- Installer script: `windows-helper/installer/PeasyPrint.Modern.iss` (AppVersion 1.0.1)
- Branding icon: `windows-helper/installer/branding/swoop.ico` (auto-generated from `public/figma/*.svg` if missing)

Frontend integration
- Trigger helper: builds `peasyprint://print?jobUrl=...` using the page origin (www host).
- Download button: `/helper` page → `/api/helper/download`.
