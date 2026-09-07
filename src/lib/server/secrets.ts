import crypto from 'crypto';

export function safeTokenEqual(supplied: string | null | undefined, expected: string | null | undefined) {
  if (!supplied || !expected) return false;
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(suppliedBuffer, expectedBuffer);
}

export function bearerToken(authorization: string | null) {
  return authorization?.replace(/^Bearer\s+/i, '') || null;
}
