/**
 * Tiny trigger to launch the Windows helper via custom URL protocol.
 * - Builds peasyprint://print?jobId=...
 * - Attempts to open it (user must click a button for best results)
 * - If helper not installed, fires onMissingHelper after a short timeout
 */

export type PeasyPrintOptions = {
  timeoutMs?: number;
  installUrl?: string;
  onMissingHelper?: () => void;
  onLaunched?: () => void;
};

export function isWindows(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Windows NT/i.test(navigator.userAgent);
}

export function triggerPeasyPrint(jobId: string, opts: PeasyPrintOptions = {}): void {
  const { timeoutMs = 1200, installUrl, onMissingHelper, onLaunched } = opts;

  if (!jobId) return;
  if (typeof window === 'undefined') return;

  // Only attempt on Windows; elsewhere, the caller should fallback (e.g., window.print())
  if (!isWindows()) {
    return;
  }

  const url = `peasyprint://print?jobId=${encodeURIComponent(jobId)}`;

  // Kick off protocol launch (must be in direct response to a user gesture for best compatibility)
  try {
    // Using location.href is broadly compatible across Edge/Chrome
    window.location.href = url;
    onLaunched?.();
  } catch {
    // ignore and rely on timeout fallback
  }

  // Fallback: if helper is not installed, the browser won't hand off; show install prompt
  const start = Date.now();
  window.setTimeout(() => {
    const elapsed = Date.now() - start;
    if (elapsed < timeoutMs + 100) {
      // Likely no helper; offer install
      if (installUrl) {
        try {
          window.open(installUrl, '_blank');
        } catch {
          // best-effort only
        }
      }
      onMissingHelper?.();
    }
  }, timeoutMs);
}


