export function getAllowedOrigins(): string[] {
  const fromEnv = (process.env.NEXT_PUBLIC_ALLOWED_ORIGINS || '').split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Always include same-host origin by signaling with a special token we handle in validation
  // Also include common localhost dev variants for convenience
  const defaults = [
    'self',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://localhost:3000',
    'https://127.0.0.1:3000'
  ];

  // Deduplicate while preserving order
  const set = new Set([...fromEnv, ...defaults]);
  return Array.from(set);
}

export function isAllowedOrigin(
  requestUrl: string,
  requestOriginHeader: string | null,
  forwardedHost?: string | null,
  forwardedProto?: string | null
): boolean {
  // If no Origin header (same-origin or non-browser), allow
  if (!requestOriginHeader) return true;

  const url = new URL(requestUrl);
  const sameOrigin = `${url.protocol}//${url.host}`;

  // Also consider reverse proxy forwarded headers (e.g. ngrok, vercel, cloudflared)
  const proxyOrigin = forwardedHost
    ? `${(forwardedProto || url.protocol.replace(':', ''))}://${forwardedHost}`
    : null;

  const allowed = getAllowedOrigins();
  for (const allowedOrigin of allowed) {
    if (allowedOrigin === 'self') {
      if (requestOriginHeader === sameOrigin) return true;
      if (proxyOrigin && requestOriginHeader === proxyOrigin) return true;
      continue;
    }
    if (requestOriginHeader === allowedOrigin) return true;
  }
  return false;
}


