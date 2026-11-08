// Demo stand-in for @clerk/nextjs/errors. Only the demo dev build aliases it in
// (src/lib/demo/build-config.cjs). The client stand-in throws DemoClerkError
// where Clerk would throw a ClerkAPIResponseError, so the existing plain-English
// error mapping keeps working. Never touches window.

export interface DemoClerkErrorItem {
  code: string;
  message: string;
  longMessage?: string;
  meta?: Record<string, unknown>;
}

/** Shaped like Clerk's ClerkAPIResponseError: `errors[].code` and `status`. */
export class DemoClerkError extends Error {
  readonly clerkError = true;
  status: number;
  errors: DemoClerkErrorItem[];

  constructor(code: string, message: string, status = 422) {
    super(message);
    this.name = 'DemoClerkError';
    this.status = status;
    this.errors = [{ code, message, longMessage: message }];
  }
}

/** True for errors thrown by the demo's Clerk stand-in. */
export function isClerkAPIResponseError(err: unknown): err is DemoClerkError {
  if (err instanceof DemoClerkError) return true;
  // Also accept a copy from a second bundle (server and client layers).
  const raw = err as { clerkError?: unknown; errors?: unknown; name?: unknown } | null;
  return Boolean(raw && raw.clerkError === true && raw.name === 'DemoClerkError' && Array.isArray(raw.errors));
}

/** The demo has no Clerk runtime errors. */
export function isClerkRuntimeError(_err: unknown): boolean {
  return false;
}

export function isKnownError(err: unknown): boolean {
  return isClerkAPIResponseError(err);
}
