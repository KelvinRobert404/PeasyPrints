'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useRouter } from 'next/navigation';
import { swButton } from '@/components/swoop/primitives';
import { cn } from '@/lib/utils/cn';

export function PhoneRegister() {
  const { initRecaptcha, startPhoneRegistration, verificationId, loading, error, recaptchaReady } = useAuthStore();
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const router = useRouter();

  useEffect(() => {
    initRecaptcha('recaptcha-container-register');
  }, [initRecaptcha]);

  useEffect(() => {
    if (verificationId) router.replace('/otp');
  }, [verificationId, router]);

  return (
    <div className="flex flex-col gap-2.5">
      <label htmlFor="phone-register" className="text-[11.5px] font-bold text-ink">
        Phone number
      </label>
      <input
        id="phone-register"
        className="campus-input"
        placeholder="+91XXXXXXXXXX"
        type="tel"
        autoComplete="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <label htmlFor="username-register" className="mt-1 text-[11.5px] font-bold text-ink">
        Username
      </label>
      <input
        id="username-register"
        className="campus-input"
        placeholder="Username"
        autoComplete="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
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
        onClick={() => startPhoneRegistration(username, phone)}
      >
        {loading ? 'Sending...' : 'Send OTP'}
      </button>
      <div id="recaptcha-container-register" className="mt-2" />
    </div>
  );
}
