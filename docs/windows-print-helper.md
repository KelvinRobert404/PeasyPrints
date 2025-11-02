## Windows Print Helper — How To

This document explains what the Windows Helper does, how to build/package/install it on a new PC, how to invoke it (custom URL and CLI), and the minimal API your backend should expose to pass print jobs.

### What it is
- **Purpose**: Receives a file URL or a job ID and opens the native Windows Print dialog with sensible defaults (A4, copies, color/BW), then prints a rendered PDF via XPS.
- **Launch methods**:
  - Custom URL protocol: `peasyprint://print?...`
  - Command-line: `PeasyPrint.Helper.exe --file=... --copies=2 --color=true`
  - System tray mode: `PeasyPrint.Helper.exe --tray` (right-click icon → Settings)

### Prerequisites
- Windows 10/11 for Modern helper (or Windows 7 for Legacy)
- For building installers locally:
  - .NET 8 SDK for Modern
  - MSBuild/.NET Framework toolchain for Legacy
  - Inno Setup 6 (optional, for compiling .iss)

### Building locally
From repository root (preferred):

```powershell
# Build + package + generate protocol files
windows-helper\scripts\package.ps1 -Configuration Release -Runtime win-x64
```

This produces:
- `windows-helper/dist/PeasyPrint.Helper.zip`
- `windows-helper/PeasyPrint.Helper/bin/Release/net8.0-windows10.0.19041.0/win-x64/publish` (canonical publish folder)

Notes:
- Prefer wiring the protocol directly to the EXE under the publish folder (path above).
- If you need to build manually for diagnostics:

```powershell
dotnet publish windows-helper/PeasyPrint.Helper/PeasyPrint.Helper.csproj -c Release -r win-x64 --self-contained false
```

### Installers (single-file)
Build both Modern (Win10/11) and Legacy (Win7) installers:

```powershell
pwsh windows-helper\scripts\package-all.ps1 -Configuration Release -Runtime win-x64 -SelfContained $true -ApiKey "<YOUR_TOKEN>"
```

Outputs:
- Modern app folder: `windows-helper/PeasyPrint.Helper/app`
- Legacy app folder: `windows-helper/PeasyPrint.Helper.Legacy/app`
- Modern ZIP: `windows-helper/dist/PeasyPrint.Helper.zip`
- Installers: compiled via Inno if ISCC.exe is found

Notes:
- To build only the Modern ZIP/app, run `windows-helper\scripts\package.ps1`.
- For Legacy, place `windows-helper/installer/files/SumatraPDF.exe` before compiling the installer.

### Installing on a new Windows PC
Preferred: use the single-file installer (Modern for Win10/11, Legacy for Win7) and follow the prompts to set `PEASYPRINT_API_KEY`.

Alternative (ZIP for Modern helper):
1) Unzip `PeasyPrint.Helper.zip` anywhere (e.g., `C:\Program Files\PeasyPrint\PeasyPrint.Helper`).
2) Register the `peasyprint://` protocol to the publish EXE (recommended):

```powershell
$pubExe = 'C:\\Path\\To\\PeasyPrint.Helper\\bin\\Release\\net8.0-windows10.0.19041.0\\win-x64\\publish\\PeasyPrint.Helper.exe'
$base = 'HKCU:\\Software\\Classes\\peasyprint'
New-Item -Path $base -Force | Out-Null
Set-ItemProperty -Path $base -Name '(default)' -Value 'URL:PeasyPrint Protocol' -Type String -Force
New-ItemProperty -Path $base -Name 'URL Protocol' -Value '' -PropertyType String -Force
New-Item -Path "$base\\shell\\open\\command" -Force | Out-Null
Set-ItemProperty -Path "$base\\shell\\open\\command" -Name '(default)' -Value ("`"$pubExe`" `"%1`"") -Type String -Force
# Apply without reboot
Stop-Process -Name explorer -Force; Start-Process explorer.exe
```

Alternatively, double‑click the generated `peasyprint-protocol.reg` inside the publish folder to register to that exact path.

3) Optional settings file: create `%LOCALAPPDATA%/PeasyPrint/settings.json` with fields shown below.
4) Backend API key for the helper (recommended):
   - Double-click `peasyprint-api-key.reg` (sets `PEASYPRINT_API_KEY` for current user), or
   - Run `setup-peasyprint-env.ps1` (sets it and restarts Explorer), or
   - Manual PowerShell: `[Environment]::SetEnvironmentVariable("PEASYPRINT_API_KEY","<token>","User")`
5) Optional environment variables (PowerShell):
   - `$env:PEASYPRINT_API_BASE="https://<your-api-base>"`
6) Test:
   - `peasyprint://settings`
   - `peasyprint://print?file=https%3A%2F%2Fexample.com%2Fsample.pdf&copies=2&color=color`

### Settings
Stored at `%LOCALAPPDATA%/PeasyPrint/settings.json`:

```json
{
  "BwPrinterNameSubstring": "Brother",
  "ColorPrinterNameSubstring": "Canon",
  "PreferredPrinterNameSubstring": "Office",
  "ApiBaseOverride": "https://api.example.com"
}
```

Notes:
- `BwPrinterNameSubstring`/`ColorPrinterNameSubstring` are used to preselect printers by name match.
- `PreferredPrinterNameSubstring` is a fallback substring if role-based match fails.
- `ApiBaseOverride` overrides the API base if not supplied via URL param or env var.

You can also open the Settings UI via:
- `peasyprint://settings`
- Running the EXE with no arguments
- Tray icon → Settings

### How to invoke the helper

Custom URL protocol (`peasyprint://print`):
- Supported query params:
  - `file` (URL-encoded absolute URL to PDF) — optional if using `jobId` or `jobUrl`
  - `jobId` (string) — if provided, helper resolves via the API base
  - `jobUrl` (absolute URL) — full URL to job resource
  - `api` (string) — base API URL (overrides settings/env)
  - `copies` (int ≥ 1)
  - `color` (`true`/`false`, or `color`/`bw`/`grayscale`)

Examples:
```text
peasyprint://print?file=https%3A%2F%2Fexample.com%2Fsample.pdf&copies=2&color=bw
peasyprint://print?jobId=abc123&api=https%3A%2F%2Fapi.example.com
peasyprint://print?jobUrl=https%3A%2F%2Fapi.example.com%2Fprint-jobs%2Fabc123
```

CLI invocation (useful for testing):
```powershell
PeasyPrint.Helper.exe --file=https://example.com/sample.pdf --copies=2 --color=true
```

Tray mode:
```powershell
PeasyPrint.Helper.exe --tray
```

### Minimal backend API to pass a file (Print Job API)
When using `jobId` or `jobUrl`, the helper fetches a small JSON payload describing what to print.

- Default API base precedence: URL `api` param → settings `ApiBaseOverride` → env `PEASYPRINT_API_BASE` → internal default.
- Authentication: If env `PEASYPRINT_API_KEY` is set, the helper sends `Authorization: Bearer <token>`.

Endpoint: GET `{API_BASE}/print-jobs/{jobId}`

Response JSON shape:
```json
{
  "fileUrl": "https://cdn.example.com/invoices/123.pdf",
  "copies": 1,
  "isColor": true
}
```

Field semantics:
- `fileUrl` (required): Absolute URL to a PDF file the helper can download.
- `copies` (optional, default 1): Number of copies to prefill.
- `isColor` (optional, default true): Whether to prefill color mode.

Alternative: Direct `jobUrl`
- If you pass `jobUrl` in the protocol/CLI, the helper will call that URL directly (same JSON shape, same `Authorization` header behavior).

Example Next.js route (outline):
```ts
// app/api/print-jobs/[id]/route.ts
import { NextResponse } from 'next/server'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  // TODO: AuthN/AuthZ using Authorization header if required
  // TODO: Lookup job by params.id and build an absolute file URL
  return NextResponse.json({
    fileUrl: 'https://cdn.example.com/your.pdf',
    copies: 1,
    isColor: true,
  })
}
```

### Security considerations
- Only return files that the requesting environment is authorized to print.
- Prefer expiring, signed URLs for `fileUrl`.
- If you require a token, set `PEASYPRINT_API_KEY` on the Windows machine so the helper includes a Bearer token.

### Troubleshooting
- Protocol not opening the app: Re-run `peasyprint-protocol.reg` and ensure the EXE path in the file matches the actual location.
- Print dialog shows but nothing prints: Ensure the PDF is reachable (open the `fileUrl` in a browser), and that the selected printer is online.
- API 401/403: Set or update `PEASYPRINT_API_KEY` environment variable on the machine.
- “Application not found” when launching peasyprint://:
  - Verify registry: `HKCU:\Software\Classes\peasyprint` has `(default) = URL:PeasyPrint Protocol` and `URL Protocol = ''`
  - Verify `HKCU:\Software\Classes\peasyprint\shell\open\command` points to a real EXE path (no `..` segments)
  - Restart Explorer (or sign out/in): `Stop-Process -Name explorer -Force; Start-Process explorer.exe`
- Copies not prefilled: Some drivers ignore `CopyCount` (e.g., PDF). Use a hardware printer to validate. The dialog prefill merges a validated `PrintTicket`, but capabilities may limit copies.

### Queue job name
- The helper sets the print job name to the source file name derived from the `fileUrl` when available; otherwise it falls back to `PeasyPrint Job`.
- Many drivers will display this as the job name; “Microsoft Print to PDF” typically uses it as the default Save‑As filename.

### Where the logic lives (code pointers)
- Argument parsing and launch flow: `windows-helper/PeasyPrint.Helper/App.xaml.cs`
- Job fetching: `windows-helper/PeasyPrint.Helper/JobClient.cs`
- PDF rendering and printing: `windows-helper/PeasyPrint.Helper/PdfPrintService.cs`
- Downloading files: `windows-helper/PeasyPrint.Helper/FileDownloader.cs`
- Settings persistence/UI: `windows-helper/PeasyPrint.Helper/Settings*.cs`, `SettingsWindow*`
- Protocol template: `windows-helper/installer/peasyprint-protocol.reg`
