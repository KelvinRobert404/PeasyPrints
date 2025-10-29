# Installer notes (temporary)

- The MSI should:
  - Install `PeasyPrint.Helper.exe` under `C:\Program Files\PeasyPrint\PeasyPrint.Helper\`.
  - Register custom URL protocol `peasyprint://` pointing to the helper exe with `"%1"` arg.
  - Optionally add Start Menu entry and enable auto-update.

- During development, you can register the protocol manually by editing and importing `peasyprint-protocol.reg` (update the EXE path first).

- To set the helper's bearer token env var automatically, during install set a user-scoped env var `PEASYPRINT_API_KEY` under `HKCU\Environment`.
  - For ZIP installs, use the generated `peasyprint-api-key.reg` (double-click) or run `setup-peasyprint-env.ps1` to set it and restart Explorer.



