'use client';

import { useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSignIn, useSignUp } from '@clerk/nextjs';
import { isClerkAPIResponseError } from '@clerk/nextjs/errors';
import { safeRedirectPath } from '@/lib/utils/safeRedirect';

/** What every sign-in action resolves to. `error` is plain English, ready to show. */
export type AuthResult = { ok: true } | { ok: false; error: string };

/** The email-code half of step 2, as SignInStep and EmailCodeForm consume it. */
export interface EmailCodeHandlers {
  sendCode: (email: string) => Promise<AuthResult>;
  verifyCode: (code: string) => Promise<AuthResult>;
}

type SignInResource = NonNullable<ReturnType<typeof useSignIn>['signIn']>;
type SignUpResource = NonNullable<ReturnType<typeof useSignUp>['signUp']>;

type PendingCode = { kind: 'signIn'; resource: SignInResource } | { kind: 'signUp'; resource: SignUpResource };

const OK: AuthResult = { ok: true };
const fail = (error: string): AuthResult => ({ ok: false, error });

/** Where every finished sign-in lands: the campus check, carrying the original destination. */
export function campusVerifyPath(next: string | null | undefined): string {
  return `/campus/verify?next=${encodeURIComponent(safeRedirectPath(next))}`;
}

function errorCodes(err: unknown): string[] {
  return isClerkAPIResponseError(err) ? err.errors.map((e) => e.code) : [];
}

/** Clerk errors in plain English. Each line stays short. */
function plainError(err: unknown): string {
  const codes = errorCodes(err);
  const has = (...wanted: string[]) => wanted.some((c) => codes.includes(c));
  if (has('form_code_incorrect')) return 'That code is wrong. Try again.';
  if (has('verification_expired')) return 'That code expired. Send a new one.';
  if (has('verification_failed')) return 'Too many wrong codes. Send a new one.';
  if (has('form_param_format_invalid', 'form_identifier_invalid')) return "That email doesn't look right.";
  if (has('too_many_requests') || (isClerkAPIResponseError(err) && err.status === 429)) return 'Too many tries. Wait a minute.';
  if (has('form_identifier_exists')) return 'That email already has an account.';
  if (has('session_exists')) return "You're already signed in. Reload the page.";
  if (has('captcha_invalid', 'captcha_unavailable')) return "We couldn't check your browser. Reload and retry.";
  if (typeof navigator !== 'undefined' && !navigator.onLine) return "You're offline. Check your connection.";
  return 'Something went wrong. Try again.';
}

/**
 * Step 2 sign-in on top of Clerk 6.39's useSignIn/useSignUp.
 * - google(next): Google OAuth redirect, account picker always shown.
 * - sendCode(email): 6-digit email code; signs in a known email, signs up a new one.
 * - verifyCode(code, next): checks the code, starts the session, goes to /campus/verify.
 * Never throws: every action resolves to an AuthResult.
 */
export function useCollegeSignIn() {
  const router = useRouter();
  const { isLoaded: signInLoaded, signIn, setActive } = useSignIn();
  const { isLoaded: signUpLoaded, signUp } = useSignUp();
  const pending = useRef<PendingCode | null>(null);

  const isLoaded = signInLoaded && signUpLoaded;

  const google = useCallback(
    async (next?: string | null): Promise<AuthResult> => {
      if (!signInLoaded || !signIn) return fail('Still loading. Try again.');
      try {
        await signIn.authenticateWithRedirect({
          strategy: 'oauth_google',
          redirectUrl: '/sso-callback',
          redirectUrlComplete: campusVerifyPath(next),
          oidcPrompt: 'select_account'
        });
        return OK;
      } catch (err) {
        return fail(plainError(err));
      }
    },
    [signInLoaded, signIn]
  );

  const sendCode = useCallback(
    async (rawEmail: string): Promise<AuthResult> => {
      if (!signInLoaded || !signUpLoaded || !signIn || !signUp) return fail('Still loading. Try again.');
      const email = rawEmail.trim().toLowerCase();
      if (!email) return fail('Enter your email first.');
      pending.current = null;

      try {
        const attempt = await signIn.create({ identifier: email });
        let emailAddressId: string | null = null;
        for (const factor of attempt.supportedFirstFactors ?? []) {
          if (factor.strategy === 'email_code') {
            emailAddressId = factor.emailAddressId;
            break;
          }
        }
        if (!emailAddressId) return fail("This account can't use a code. Try Google.");
        const prepared = await attempt.prepareFirstFactor({ strategy: 'email_code', emailAddressId });
        pending.current = { kind: 'signIn', resource: prepared };
        return OK;
      } catch (err) {
        if (!errorCodes(err).includes('form_identifier_not_found')) return fail(plainError(err));
      }

      // New email: start a sign-up and verify the address with the same 6-digit code.
      try {
        const created = await signUp.create({ emailAddress: email });
        const prepared = await created.prepareEmailAddressVerification({ strategy: 'email_code' });
        pending.current = { kind: 'signUp', resource: prepared };
        return OK;
      } catch (err) {
        return fail(plainError(err));
      }
    },
    [signInLoaded, signUpLoaded, signIn, signUp]
  );

  const verifyCode = useCallback(
    async (rawCode: string, next?: string | null): Promise<AuthResult> => {
      const code = rawCode.replace(/\D/g, '');
      if (code.length !== 6) return fail('Enter all 6 digits.');
      const current = pending.current;
      if (!current || !setActive) return fail('Send yourself a code first.');

      try {
        if (current.kind === 'signIn') {
          const res = await current.resource.attemptFirstFactor({ strategy: 'email_code', code });
          if (res.status !== 'complete' || !res.createdSessionId) {
            return fail('This account needs another step. Try Google.');
          }
          await setActive({ session: res.createdSessionId });
        } else {
          const res = await current.resource.attemptEmailAddressVerification({ code });
          if (res.status !== 'complete' || !res.createdSessionId) {
            return fail("Sign up isn't finished. Try Google instead.");
          }
          await setActive({ session: res.createdSessionId });
        }
        pending.current = null;
        router.push(campusVerifyPath(next));
        return OK;
      } catch (err) {
        return fail(plainError(err));
      }
    },
    [setActive, router]
  );

  return { isLoaded, google, sendCode, verifyCode };
}
