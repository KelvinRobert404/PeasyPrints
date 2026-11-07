'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { swButton } from '@/components/swoop/primitives';
import { cn } from '@/lib/utils/cn';
import type { AuthResult } from '@/components/auth/useCollegeSignIn';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 30;

/* CodeInput ------------------------------------------------ */

/**
 * Six code boxes over one real input, so SMS/email one-time-code autofill and paste work
 * and screen readers hear a single labelled field. Digits only.
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  invalid = false,
  autoFocus = false,
  label = '6-digit code',
  id,
  className
}: {
  value: string;
  onChange: (value: string) => void;
  /** Called once the sixth digit lands (typed, pasted or autofilled). */
  onComplete?: (code: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  /** Accessible name for the field. */
  label?: string;
  id?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const digits = value.replace(/\D/g, '').slice(0, CODE_LENGTH);
  const activeIndex = Math.min(digits.length, CODE_LENGTH - 1);

  useEffect(() => {
    if (autoFocus && !disabled) inputRef.current?.focus();
  }, [autoFocus, disabled]);

  const keepCaretAtEnd = () => {
    const el = inputRef.current;
    if (el) el.setSelectionRange(el.value.length, el.value.length);
  };

  return (
    <div className={cn('relative', className)}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={CODE_LENGTH}
        aria-label={label}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        value={digits}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH);
          onChange(next);
          if (next.length === CODE_LENGTH && next !== digits) onComplete?.(next);
        }}
        onFocus={() => {
          setFocused(true);
          keepCaretAtEnd();
        }}
        onBlur={() => setFocused(false)}
        onClick={keepCaretAtEnd}
        className="absolute inset-0 z-10 h-full w-full cursor-text bg-transparent text-[16px] text-transparent caret-transparent opacity-0 outline-none disabled:cursor-not-allowed"
      />
      <div aria-hidden="true" className="flex gap-1.5">
        {Array.from({ length: CODE_LENGTH }, (_, i) => {
          const isActive = focused && i === activeIndex;
          return (
            <div
              key={i}
              className={cn(
                'flex h-12 min-w-0 flex-1 items-center justify-center rounded-[10px] border bg-surface font-heading text-[20px] text-ink transition-colors',
                invalid ? 'border-market' : isActive ? 'border-royal bg-white ring-2 ring-royal/20' : 'border-transparent',
                disabled && 'opacity-45'
              )}
            >
              {digits[i] ?? ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* EmailCodeForm -------------------------------------------- */

type Stage = 'email' | 'code';

/**
 * Email, then 6-digit code. Pure UI: the parent passes the actions (see useCollegeSignIn),
 * so previews can pass no-op handlers.
 */
export function EmailCodeForm({
  onSendCode,
  onVerifyCode,
  onBack,
  emailPlaceholder = 'you@college.edu',
  initialStage = 'email',
  initialEmail = ''
}: {
  onSendCode: (email: string) => Promise<AuthResult>;
  onVerifyCode: (code: string) => Promise<AuthResult>;
  /** Shows "Use Google instead" when given. */
  onBack?: () => void;
  emailPlaceholder?: string;
  /** For previews: open straight on the code boxes. */
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
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = async () => {
    if (busy) return;
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("That email doesn't look right.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await onSendCode(trimmed);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
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
    const res = await onVerifyCode(value);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      setCode('');
    }
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (stage === 'email') void send();
    else void verify(code);
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2.5">
      {stage === 'email' ? (
        <>
          <label htmlFor={emailId} className="text-[12px] font-bold text-ink">
            Your email
          </label>
          <input
            id={emailId}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            placeholder={emailPlaceholder}
            value={email}
            disabled={busy}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            className="h-11 w-full rounded-[10px] border border-transparent bg-surface px-3 text-[16px] text-ink outline-none placeholder:text-slate focus:border-royal focus:bg-white disabled:opacity-45"
          />
          {error && (
            <p id={errorId} role="alert" className="text-[11.5px] font-semibold text-market">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className={swButton({ variant: 'primary', size: 'lg', className: 'w-full' })}>
            {busy ? 'Sending code…' : 'Send code'}
          </button>
        </>
      ) : (
        <>
          <div>
            <p className="text-[12.5px] font-bold text-ink">Enter the 6-digit code</p>
            <p className="mt-0.5 text-[11.5px] text-slate">
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
            onChange={(v) => {
              setCode(v);
              if (error) setError(null);
            }}
            onComplete={(v) => void verify(v)}
            disabled={busy}
            invalid={Boolean(error)}
            autoFocus
          />
          {error && (
            <p role="alert" className="text-[11.5px] font-semibold text-market">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className={swButton({ variant: 'primary', size: 'lg', className: 'w-full' })}>
            {busy ? 'Checking…' : 'Verify'}
          </button>
          <button
            type="button"
            disabled={busy || cooldown > 0}
            onClick={() => void send()}
            className="self-center text-[12px] font-bold text-royal disabled:text-slate"
          >
            {cooldown > 0 ? `Send a new code in ${cooldown}s` : 'Send a new code'}
          </button>
        </>
      )}

      {onBack && (
        <button type="button" onClick={onBack} className="self-center text-[12px] font-bold text-ink underline-offset-2 hover:underline">
          Use Google instead
        </button>
      )}

      {/* Clerk mounts its bot check here for custom sign-up flows. */}
      <div id="clerk-captcha" />
    </form>
  );
}
