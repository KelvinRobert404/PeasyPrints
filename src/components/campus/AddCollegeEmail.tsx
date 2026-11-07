'use client';

import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useUser } from '@clerk/nextjs';
import { isClerkAPIResponseError } from '@clerk/nextjs/errors';
import { CodeInput } from '@/components/auth/EmailCodeForm';
import type { AuthResult } from '@/components/auth/useCollegeSignIn';
import {
  AlertIcon,
  ChevronRightIcon,
  IdCardIcon,
  InboxIcon,
  LogOutIcon,
  type IconProps,
} from '@/components/swoop/icons';
import { IconTile, swButton } from '@/components/swoop/primitives';
import type { CampusSession, VerificationStatus } from '@/types/campus';
import { cn } from '@/lib/utils/cn';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 30;

/* POST /api/campus/onboarding ------------------------------- */

export type OnboardingBody = {
  collegeId?: string;
  campusId?: string;
  stay?: { type: string; distanceM: number | null } | null;
  course?: { programmeId: string; specialisation: string | null; semester: number };
};

export type OnboardingResponse =
  | { ok: true; session: CampusSession; domainMismatch: boolean }
  | { ok: false; error: string };

/**
 * Saves an onboarding step. An empty body re-runs the college email check
 * against the saved college. Never throws.
 */
export async function postOnboarding(body: OnboardingBody): Promise<OnboardingResponse> {
  try {
    const response = await fetch('/api/campus/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.session) {
      if (response.status === 429) return { ok: false, error: 'Too many tries. Wait a bit.' };
      return { ok: false, error: typeof data?.error === 'string' ? data.error : 'Could not save. Try again.' };
    }
    return { ok: true, session: data.session as CampusSession, domainMismatch: Boolean(data.domainMismatch) };
  } catch {
    return { ok: false, error: "You're offline. Check your connection." };
  }
}

/* Domain mismatch step -------------------------------------- */

type Panel = 'email' | 'idcard' | null;

const MISMATCH_COPY: Partial<Record<VerificationStatus, { title: string; body: string }>> = {
  rejected: { title: 'Your ID card wasn’t accepted', body: 'Try a clearer photo or your college email.' },
  expired: { title: 'Time to verify again', body: 'Your check lasts a year. Verify once more.' },
};

/**
 * Step 2 outcome when the account is not on the college's email list:
 * add a college email, send an ID card, or switch accounts.
 * Presentational: the parent passes the two panels and the sign-out action.
 */
export function DomainMismatchStep({
  collegeCode,
  status,
  email,
  emailPanel,
  idCardPanel,
  onSignOut,
  initialPanel = null,
}: {
  collegeCode: string;
  status: VerificationStatus;
  /** The email the student signed in with, when known. */
  email?: string | null;
  emailPanel: ReactNode;
  idCardPanel: ReactNode;
  onSignOut: () => void;
  initialPanel?: Panel;
}) {
  const titleId = useId();
  const [panel, setPanel] = useState<Panel>(initialPanel);
  const copy = MISMATCH_COPY[status] ?? {
    title: `That’s not a ${collegeCode} email`,
    body: email ? `${email} isn’t on the ${collegeCode} list.` : `We couldn’t match your email to ${collegeCode}.`,
  };
  const toggle = (next: Exclude<Panel, null>) => setPanel((open) => (open === next ? null : next));

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3">
      <div className="flex items-start gap-2.5">
        <IconTile icon={AlertIcon} tone="market" size={36} />
        <div className="min-w-0">
          <h2 id={titleId} className="font-heading text-[16px] leading-[1.15] text-ink">
            {copy.title}
          </h2>
          <p className="mt-1 break-words text-[12px] leading-[1.45] text-slate">{copy.body}</p>
          <p className="text-[12px] leading-[1.45] text-slate">Pick one way to get in.</p>
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        <OptionRow
          icon={InboxIcon}
          title="Add your college email"
          subtitle="We’ll send it a 6-digit code"
          open={panel === 'email'}
          onClick={() => toggle('email')}
        >
          {emailPanel}
        </OptionRow>
        <OptionRow
          icon={IdCardIcon}
          title="Use your ID card"
          subtitle="The campus team checks it by hand"
          open={panel === 'idcard'}
          onClick={() => toggle('idcard')}
        >
          {idCardPanel}
        </OptionRow>
        <li>
          <button
            type="button"
            onClick={onSignOut}
            className="campus-press flex min-h-14 w-full items-center gap-2.5 rounded-[12px] bg-surface px-3 text-left"
          >
            <IconTile icon={LogOutIcon} tone="surface" size={32} className="bg-white" />
            <span className="flex min-w-0 flex-1 flex-col gap-px">
              <span className="truncate text-[12.5px] font-bold text-ink">Sign in with another account</span>
              <span className="truncate text-[11px] text-slate">Try your college Google account</span>
            </span>
            <ChevronRightIcon size={16} className="shrink-0 text-slate" />
          </button>
        </li>
      </ul>
    </section>
  );
}

function OptionRow({
  icon,
  title,
  subtitle,
  open,
  onClick,
  children,
}: {
  icon: React.ComponentType<IconProps>;
  title: string;
  subtitle: string;
  open: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const panelId = useId();
  return (
    <li className={cn('rounded-[12px] transition-colors', open ? 'bg-white ring-1 ring-line' : 'bg-surface')}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onClick}
        className="campus-press flex min-h-14 w-full items-center gap-2.5 rounded-[12px] px-3 text-left"
      >
        <IconTile icon={icon} tone="royal" size={32} />
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="truncate text-[12.5px] font-bold text-ink">{title}</span>
          <span className="truncate text-[11px] text-slate">{subtitle}</span>
        </span>
        <ChevronRightIcon size={16} className={cn('shrink-0 text-slate transition-transform', open && 'rotate-90')} />
      </button>
      {open ? (
        <div id={panelId} className="px-3 pb-3 pt-1">
          {children}
        </div>
      ) : null}
    </li>
  );
}

/* Add college email: pure form ------------------------------ */

type Stage = 'email' | 'code';

/**
 * College email, then the 6-digit code sent to it. Pure UI: the parent passes the
 * actions, so previews can pass no-op handlers.
 */
export function AddCollegeEmailForm({
  collegeCode,
  onSendCode,
  onVerifyCode,
  initialStage = 'email',
  initialEmail = '',
}: {
  collegeCode: string;
  onSendCode: (email: string) => Promise<AuthResult>;
  onVerifyCode: (code: string) => Promise<AuthResult>;
  initialStage?: Stage;
  initialEmail?: string;
}) {
  const emailId = useId();
  const errorId = useId();
  const [stage, setStage] = useState<Stage>(initialStage);
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const send = async () => {
    if (busy) return;
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('That email doesn’t look right.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await onSendCode(trimmed);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCode('');
    setStage('code');
    setCooldown(RESEND_SECONDS);
  };

  const verify = async (value: string) => {
    if (busy) return;
    if (value.length !== CODE_LENGTH) {
      setError('Enter all 6 digits.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await onVerifyCode(value);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      setCode('');
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (stage === 'email') void send();
    else void verify(code);
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2">
      {stage === 'email' ? (
        <>
          <label htmlFor={emailId} className="text-[12px] font-bold text-ink">
            Your {collegeCode} email
          </label>
          <input
            id={emailId}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="you@college.edu"
            value={email}
            disabled={busy}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => {
              setEmail(event.target.value);
              if (error) setError(null);
            }}
            className="h-11 w-full rounded-[10px] border border-transparent bg-surface px-3 text-[16px] text-ink outline-none placeholder:text-slate focus:border-royal focus:bg-white disabled:opacity-45"
          />
          {error ? (
            <p id={errorId} role="alert" className="text-[11.5px] font-semibold text-market">
              {error}
            </p>
          ) : null}
          <button type="submit" disabled={busy} className={swButton({ size: 'md', className: 'w-full' })}>
            {busy ? 'Sending code…' : 'Send code'}
          </button>
        </>
      ) : (
        <>
          <div>
            <p className="text-[12.5px] font-bold text-ink">Enter the 6-digit code</p>
            <p className="mt-0.5 break-words text-[11.5px] text-slate">
              Sent to <span className="font-semibold text-ink">{email.trim()}</span>.{' '}
              <button
                type="button"
                onClick={() => {
                  setStage('email');
                  setCode('');
                  setError(null);
                }}
                className="font-bold text-royal underline-offset-2 hover:underline"
              >
                Change
              </button>
            </p>
          </div>
          <CodeInput
            value={code}
            onChange={(value) => {
              setCode(value);
              if (error) setError(null);
            }}
            onComplete={(value) => void verify(value)}
            disabled={busy}
            invalid={Boolean(error)}
            autoFocus
            label="6-digit code from your college email"
          />
          {error ? (
            <p role="alert" className="text-[11.5px] font-semibold text-market">
              {error}
            </p>
          ) : null}
          <button type="submit" disabled={busy} className={swButton({ size: 'md', className: 'w-full' })}>
            {busy ? 'Checking…' : 'Verify email'}
          </button>
          <button
            type="button"
            disabled={busy || cooldown > 0}
            onClick={() => void send()}
            className="min-h-8 self-center text-[12px] font-bold text-royal disabled:text-slate"
          >
            {cooldown > 0 ? `Send a new code in ${cooldown}s` : 'Send a new code'}
          </button>
        </>
      )}
    </form>
  );
}

/* Add college email: wired to Clerk ------------------------- */

type ClerkUser = NonNullable<ReturnType<typeof useUser>['user']>;
type EmailResource = Awaited<ReturnType<ClerkUser['createEmailAddress']>>;

const fail = (error: string): AuthResult => ({ ok: false, error });

function errorCodes(err: unknown): string[] {
  return isClerkAPIResponseError(err) ? err.errors.map((item) => item.code) : [];
}

/** Clerk errors in plain English. Each line stays short. */
function plainError(err: unknown): string {
  const codes = errorCodes(err);
  const has = (...wanted: string[]) => wanted.some((code) => codes.includes(code));
  if (has('form_code_incorrect')) return 'That code is wrong. Try again.';
  if (has('verification_expired')) return 'That code expired. Send a new one.';
  if (has('verification_failed')) return 'Too many wrong codes. Send a new one.';
  if (has('form_identifier_exists')) return 'That email is on another account.';
  if (has('form_param_format_invalid', 'form_identifier_invalid')) return 'That email doesn’t look right.';
  if (has('session_reverification_required')) return 'Sign in again, then add your email.';
  if (has('too_many_requests') || (isClerkAPIResponseError(err) && err.status === 429)) return 'Too many tries. Wait a minute.';
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'You’re offline. Check your connection.';
  return 'Something went wrong. Try again.';
}

/**
 * Adds a college email to the signed-in Clerk account with a 6-digit code, then
 * re-runs the onboarding email check. Calls onChecked with the new session once
 * the college accepts the email.
 */
export function AddCollegeEmail({
  collegeCode,
  onChecked,
}: {
  collegeCode: string;
  onChecked: (session: CampusSession) => void;
}) {
  const { isLoaded, user } = useUser();
  const pending = useRef<EmailResource | null>(null);

  const sendCode = useCallback(
    async (email: string): Promise<AuthResult> => {
      if (!isLoaded) return fail('Still loading. Try again.');
      if (!user) return fail('Sign in again to add an email.');
      pending.current = null;
      const existing = user.emailAddresses.find((item) => item.emailAddress.toLowerCase() === email);
      if (existing?.verification?.status === 'verified') return fail('That email is already on your account.');
      try {
        const resource = existing ?? (await user.createEmailAddress({ email }));
        await resource.prepareVerification({ strategy: 'email_code' });
        pending.current = resource;
        return { ok: true };
      } catch (err) {
        return fail(plainError(err));
      }
    },
    [isLoaded, user]
  );

  const verifyCode = useCallback(
    async (code: string): Promise<AuthResult> => {
      const resource = pending.current;
      if (!resource || !user) return fail('Send yourself a code first.');
      try {
        const verified = await resource.attemptVerification({ code });
        if (verified.verification?.status !== 'verified') return fail('That code didn’t work. Try again.');
        await user.reload();
      } catch (err) {
        return fail(plainError(err));
      }
      pending.current = null;
      const result = await postOnboarding({});
      if (!result.ok) return fail(result.error);
      if (result.domainMismatch) return fail(`${collegeCode} didn’t accept that email. Try your ID card.`);
      onChecked(result.session);
      return { ok: true };
    },
    [user, collegeCode, onChecked]
  );

  return <AddCollegeEmailForm collegeCode={collegeCode} onSendCode={sendCode} onVerifyCode={verifyCode} />;
}

export default AddCollegeEmail;
