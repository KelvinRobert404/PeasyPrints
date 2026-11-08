'use client';

// The demo's step 2 sign-in, with the same shape as the Clerk hook in
// useCollegeSignIn.ts. Nothing leaves localhost:
// - google() opens the Demo account sheet instead of Google.
// - sendCode() sends nothing; verifyCode() takes any 6 digits.
// Never throws: every action resolves to an AuthResult.

import { useCallback, useRef } from 'react';
import type { AuthResult, CollegeSignIn } from '@/components/auth/useCollegeSignIn';
import { isWalkthroughPick, openDemoAccountChooser } from '@/components/demo/auth/DemoAccountChooser';
import { DemoSessionError, signInAs, signInWithEmailCode, signInWithGoogle } from '@/lib/demo/client/session';
import { safeRedirectPath } from '@/lib/utils/safeRedirect';

const OK: AuthResult = { ok: true };
const fail = (error: string): AuthResult => ({ ok: false, error });

/** The visitor closed the sheet: not an error, so the button just goes back to idle. */
export const DEMO_SIGN_IN_CANCELLED: AuthResult = { ok: false, error: '' };

const CODE_LENGTH = 6;

// Same as campusVerifyPath in useCollegeSignIn.ts. Kept here so the two
// modules don't import each other at runtime.
function verifyPath(next: string | null | undefined): string {
  return `/campus/verify?next=${encodeURIComponent(safeRedirectPath(next))}`;
}

function plainError(err: unknown): string {
  if (err instanceof DemoSessionError && err.message) return err.message;
  return 'Something went wrong. Try again.';
}

/**
 * "Just looking?": opens the sample-student sheet, then signs in as the pick
 * and loads `next`. Cancel resolves DEMO_SIGN_IN_CANCELLED.
 */
export async function skipInAsSampleStudent(next?: string | null): Promise<AuthResult> {
  try {
    const pick = await openDemoAccountChooser({ mode: 'students' });
    if (!pick || isWalkthroughPick(pick)) return DEMO_SIGN_IN_CANCELLED;
    await signInAs(pick, safeRedirectPath(next));
    return OK;
  } catch (err) {
    return fail(plainError(err));
  }
}

export function useDemoCollegeSignIn(): CollegeSignIn {
  const pendingEmail = useRef<string | null>(null);

  const google = useCallback(async (next?: string | null): Promise<AuthResult> => {
    try {
      const pick = await openDemoAccountChooser({ mode: 'google' });
      if (!pick) return DEMO_SIGN_IN_CANCELLED;
      if (isWalkthroughPick(pick)) {
        // Riya, a new student: "Signing you in", then the campus check.
        await signInWithGoogle(pick, verifyPath(next));
      } else {
        // A sample student is already set up, so go straight on.
        await signInAs(pick, safeRedirectPath(next));
      }
      return OK;
    } catch (err) {
      return fail(plainError(err));
    }
  }, []);

  const sendCode = useCallback(async (rawEmail: string): Promise<AuthResult> => {
    const email = rawEmail.trim().toLowerCase();
    if (!email) return fail('Enter your email first.');
    pendingEmail.current = email;
    return OK;
  }, []);

  const verifyCode = useCallback(async (rawCode: string, next?: string | null): Promise<AuthResult> => {
    const code = rawCode.replace(/\D/g, '');
    if (code.length !== CODE_LENGTH) return fail('Enter all 6 digits.');
    const email = pendingEmail.current;
    if (!email) return fail('Send yourself a code first.');
    try {
      await signInWithEmailCode(email, verifyPath(next));
      pendingEmail.current = null;
      return OK;
    } catch (err) {
      return fail(plainError(err));
    }
  }, []);

  return { isLoaded: true, google, sendCode, verifyCode };
}
