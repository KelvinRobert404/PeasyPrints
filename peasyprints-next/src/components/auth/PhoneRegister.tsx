'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useRouter } from 'next/navigation';

export function PhoneRegister() {
  const { initRecaptcha, sendOTP, verificationId, loading, error } = useAuthStore();
  const [phone, setPhone] = useState('');
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
      {error && <div className="text-sm text-red-600">{error}</div>}
      <button className="w-full h-12 bg-blue-600 text-white rounded" disabled={loading} onClick={() => sendOTP(phone)}>
        {loading ? 'Sending...' : 'Send OTP'}
      </button>
      <div id="recaptcha-container-register" />
    </div>
  );
}
