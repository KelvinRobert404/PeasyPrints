'use client';

export const dynamic = 'force-dynamic';

import { useAuthStore } from '@/lib/stores/authStore';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthShell } from '@/components/auth/AuthShell';
import { swButton } from '@/components/swoop/primitives';
import { cn } from '@/lib/utils/cn';

export default function OTPPage() {
  const { verifyOTP, loading, error, sendOTP, lastPhoneNumber, initRecaptcha, resetRecaptcha, recaptchaReady } = useAuthStore();
  const [code, setCode] = useState('');
  const router = useRouter();

  // Ensure a recaptcha instance exists on this page for Resend OTP
  useEffect(() => {
    initRecaptcha('recaptcha-container-otp');
    return () => {
      resetRecaptcha('recaptcha-container-otp');
    };
  }, [initRecaptcha, resetRecaptcha]);

  return (
    <AuthShell
      title="Enter the code"
      subtitle={lastPhoneNumber ? `We sent a 6-digit code to ${lastPhoneNumber}` : 'We sent a 6-digit code to your phone'}
    >
      <form
        className="flex flex-col gap-2.5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (code.length === 6) await verifyOTP(code);
        }}
      >
        <label htmlFor="otp-code" className="text-[11.5px] font-bold text-ink">
          Verification code
        </label>
        <input
          id="otp-code"
          placeholder="------"
          maxLength={6}
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'otp-error' : undefined}
          className="campus-input text-center text-[18px] font-bold tracking-[0.5em] tabular-nums"
        />
        {error && (
          <p id="otp-error" role="alert" className="text-[11.5px] font-semibold text-market">
            {error}
          </p>
        )}
        <button type="submit" className={cn(swButton({ size: 'lg' }), 'mt-1 w-full')} disabled={loading || code.length !== 6}>
          {loading ? 'Verifying...' : 'Verify'}
        </button>
      </form>
      <button
        type="button"
        className={cn(swButton({ variant: 'surface', size: 'lg' }), 'mt-2 w-full')}
        disabled={loading || !lastPhoneNumber || !recaptchaReady}
        onClick={() => lastPhoneNumber && sendOTP(lastPhoneNumber)}
      >
        Resend OTP
      </button>
      <div id="recaptcha-container-otp" className="mt-2" />
    </AuthShell>
  );
}
