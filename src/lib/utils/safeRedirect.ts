/**
 * Returns `target` only when it is a same-origin path (e.g. "/orders?tab=1"),
 * otherwise `fallback`. Guards `redirect_url` against open redirects such as
 * "https://evil.example", "//evil.example" or "/\evil.example".
 */
export function safeRedirectPath(target: string | null | undefined, fallback = '/'): string {
  if (!target || !target.startsWith('/')) return fallback;
  try {
    const base = 'http://same-origin.invalid';
    const url = new URL(target, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
