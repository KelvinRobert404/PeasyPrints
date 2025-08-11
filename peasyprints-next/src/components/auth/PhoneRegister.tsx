'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useRouter } from 'next/navigation';

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
    <div className="space-y-3">
      <input
        className="w-full border rounded px-3 h-12"
        placeholder="+91XXXXXXXXXX"
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <input
        className="w-full border rounded px-3 h-12"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      {error && <div className="text-sm text-red-600">{error}</div>}
      <button className="w-full h-12 bg-blue-600 text-white rounded" disabled={loading || !recaptchaReady} onClick={() => startPhoneRegistration(username, phone)}>
        {loading ? 'Sending...' : 'Send OTP'}
      </button>
      <div id="recaptcha-container-register" className="mt-2" />
    </div>
  );
}
