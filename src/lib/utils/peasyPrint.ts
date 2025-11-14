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

const PROD_API_BASE = typeof window !== 'undefined' && window.location?.origin
  ? `${window.location.origin}/api`
  : 'https://theswoop.club/api';

export function triggerPeasyPrint(jobId: string, opts: PeasyPrintOptions = {}): void {
  const { timeoutMs = 3000, installUrl, onMissingHelper, onLaunched } = opts;

  if (!jobId) return;
  if (typeof window === 'undefined') return;

  // Only attempt on Windows; elsewhere, the caller should fallback (e.g., window.print())
  if (!isWindows()) {
    return;
  }

  // Prefer jobUrl so the helper needs no local API configuration
  const jobUrl = `${PROD_API_BASE}/print-jobs/${encodeURIComponent(jobId)}`;
  const url = `peasyprint://print?jobUrl=${encodeURIComponent(jobUrl)}`;

  // Heuristics: consider launch successful if the tab gets hidden/blurred soon after triggering
  let handled = false;
  const markHandled = () => { handled = true; };
  const onVisibility = () => { if (document.hidden) markHandled(); };
  const onBlur = () => { markHandled(); };
  window.addEventListener('blur', onBlur, { once: true });
  document.addEventListener('visibilitychange', onVisibility, { once: true });

  try {
    // Prefer anchor click for better compatibility with some Chromium builds
    const a = document.createElement('a');
    a.href = url;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    window.setTimeout(() => { try { document.body.removeChild(a); } catch {} }, 0);
  } catch {
    try {
      window.location.href = url;
    } catch {
      // ignore and rely on timeout fallback
    }
  }

  const timer = window.setTimeout(() => {
    if (!handled) {
      if (installUrl) {
        try { window.open(installUrl, '_blank'); } catch {}
      }
      onMissingHelper?.();
    } else {
      onLaunched?.();
    }
    // cleanup listeners
    try { document.removeEventListener('visibilitychange', onVisibility as any); } catch {}
    try { window.removeEventListener('blur', onBlur as any); } catch {}
  }, timeoutMs);
}

