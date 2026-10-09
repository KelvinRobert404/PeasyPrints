'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useRouter } from 'next/navigation';
import { swButton } from '@/components/swoop/primitives';
import { cn } from '@/lib/utils/cn';

export function PhoneLogin() {
  const { initRecaptcha, startPhoneLogin, verificationId, loading, error, recaptchaReady } = useAuthStore();
  const [phone, setPhone] = useState('');
  const router = useRouter();

  useEffect(() => {
    initRecaptcha('recaptcha-container-login');
  }, [initRecaptcha]);

  useEffect(() => {
    if (verificationId) router.replace('/otp');
  }, [verificationId, router]);

  return (
    <div className="flex flex-col gap-2.5">
      <label htmlFor="phone-login" className="text-[11.5px] font-bold text-ink">
        Phone number
      </label>
      <input
        id="phone-login"
        className="campus-input"
        placeholder="+91XXXXXXXXXX"
        type="tel"
        autoComplete="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      {error && (
        <p role="alert" className="text-[11.5px] font-semibold text-market">
          {error}
        </p>
      )}
      <button
        type="button"
        className={cn(swButton({ size: 'lg' }), 'mt-1 w-full')}
        disabled={loading || !recaptchaReady}
        onClick={() => startPhoneLogin(phone)}
      >
        {loading ? 'Sending...' : 'Send OTP'}
      </button>
      <div id="recaptcha-container-login" className="mt-2" />
    </div>
  );
}
