'use client';

import { useMemo, useState } from 'react';
import { swButton } from '@/components/swoop/primitives';
import { listColleges } from '@/lib/campus/catalog';
import { GoogleMark } from '@/components/auth/GoogleMark';
import { EmailCodeForm } from '@/components/auth/EmailCodeForm';
import type { AuthResult, EmailCodeHandlers } from '@/components/auth/useCollegeSignIn';

type View = 'choose' | 'email';

/**
 * Step 2 of sign-in: Continue with Google first, 6-digit email code second.
 * Pure UI (no Clerk hooks): the login page wires it to useCollegeSignIn, previews pass no-ops.
 *
 *   <SignInStep
 *     collegeCode="KJU"
 *     onGoogle={() => auth.google(next)}
 *     onEmailCode={{ sendCode: auth.sendCode, verifyCode: (c) => auth.verifyCode(c, next) }}
 *   />
 */
export function SignInStep({
  collegeCode,
  onGoogle,
  onEmailCode,
  initialView = 'choose'
}: {
  /** College code from step 1, e.g. 'KJU'. */
  collegeCode: string;
  onGoogle: () => Promise<AuthResult | void> | void;
  onEmailCode: EmailCodeHandlers;
  /** For previews: open on the email-code form. */
  initialView?: View;
}) {
  const [view, setView] = useState<View>(initialView);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const college = useMemo(() => listColleges().find((c) => c.code === collegeCode) ?? null, [collegeCode]);
  const label = college?.code ?? collegeCode;
  const domain = college?.emailDomains[0];
  const placeholder = domain ? `you@${domain}` : 'Your college email';

  const continueWithGoogle = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await onGoogle();
      // On success the browser is leaving for Google, so stay busy.
      if (res && !res.ok) {
        setError(res.error);
        setBusy(false);
      }
    } catch {
      setError('Something went wrong. Try again.');
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="sign-in-step-title" className="flex flex-col">
      <h1 id="sign-in-step-title" className="font-heading text-[20px] leading-[1.1] text-ink">
        Sign in with your {label} email
      </h1>
      <p className="mt-1 text-[12.5px] leading-[1.4] text-slate">Hey, pick the account your college gave you.</p>

      <div className="mt-5 flex flex-col gap-2.5">
        {view === 'choose' ? (
          <>
            <button
              type="button"
              onClick={() => void continueWithGoogle()}
              disabled={busy}
              className={swButton({ variant: 'white', size: 'lg', className: 'w-full border border-line' })}
            >
              <GoogleMark size={18} />
              {busy ? 'Opening Google…' : 'Continue with Google'}
            </button>
            {error && (
              <p role="alert" className="text-[11.5px] font-semibold text-market">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                setError(null);
                setView('email');
              }}
              disabled={busy}
              className="self-center py-1 text-[12px] font-bold text-royal underline-offset-2 hover:underline disabled:text-slate"
            >
              Get a 6-digit code instead
            </button>
          </>
        ) : (
          <EmailCodeForm
            onSendCode={onEmailCode.sendCode}
            onVerifyCode={onEmailCode.verifyCode}
            onBack={() => setView('choose')}
            emailPlaceholder={placeholder}
          />
        )}
      </div>

      <p className="mt-4 text-[11.5px] leading-[1.45] text-slate">No college email? Use your ID card after signing in.</p>
    </section>
  );
}
