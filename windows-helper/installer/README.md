# Installer notes (temporary)

- The MSI should:
  - Install `PeasyPrint.Helper.exe` under `C:\Program Files\PeasyPrint\PeasyPrint.Helper\`.
  - Register custom URL protocol `peasyprint://` pointing to the helper exe with `"%1"` arg.
  - Optionally add Start Menu entry and enable auto-update.

- During development, you can register the protocol manually by editing and importing `peasyprint-protocol.reg` (update the EXE path first).


