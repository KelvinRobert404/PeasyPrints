export type TriggerPeasyPrintOptions = {
  onMissingHelper?: () => void;
};

/**
 * Returns true if running on Windows (best-effort, browser-only).
 */
export function isWindows(): boolean {
  if (typeof navigator === 'undefined') return false;
  const uaDataPlatform = (navigator as any).userAgentData?.platform as string | undefined;
  const platform = navigator.platform || uaDataPlatform || '';
  const ua = navigator.userAgent || '';
  return /win/i.test(platform) || /windows/i.test(ua) || /win32/i.test(ua);
}

/**
 * Attempt to trigger the PeasyPrint helper.
 * Strategy (best-effort, non-blocking):
 * 1) If a global helper is exposed (window.PeasyPrint.print), call it.
 * 2) Else, try a short-timeout request to a local helper endpoint.
 * 3) If neither succeeds, invoke onMissingHelper.
 */
export async function triggerPeasyPrint(jobId: string, opts?: TriggerPeasyPrintOptions): Promise<void> {
  const onMissing = () => { try { opts?.onMissingHelper?.(); } catch {} };
  try {
    if (typeof window === 'undefined') { onMissing(); return; }

    // 1) Global bridge (e.g., injected by native helper or Electron preload)
    const anyWindow = window as any;
    const maybePrint = anyWindow?.PeasyPrint?.print;
    if (typeof maybePrint === 'function') {
      await Promise.resolve(maybePrint(jobId));
      return;
    }

    // 2) Localhost helper (best-guess). Use short timeout to avoid hanging.
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 1000);
    try {
      const res = await fetch('http://127.0.0.1:17653/peasyprint/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
        signal: controller.signal,
      }).catch((e) => { throw e; });
      window.clearTimeout(timeout);
      if (res && res.ok) return;
    } catch {
      // ignore; will fall through to onMissing
    }

    onMissing();
  } catch {
    onMissing();
  }
}



