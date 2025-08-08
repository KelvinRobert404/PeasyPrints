'use client';

export const dynamic = 'force-dynamic';

import { useAuthStore } from '@/lib/stores/authStore';
import { useState } from 'react';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function OTPPage() {
  const { verifyOTP, loading, error, sendOTP, lastPhoneNumber } = useAuthStore();
  const [code, setCode] = useState('');

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b px-4 py-3">
        <h1 className="text-lg font-semibold">Verify OTP</h1>
      </header>
      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Enter Code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (code.length === 6) await verifyOTP(code);
              }}
            >
              <Input
                placeholder="------"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="tracking-widest text-center"
              />
              {error && <div className="text-sm text-red-600">{error}</div>}
              <Button className="w-full" disabled={loading || code.length !== 6}>
                {loading ? 'Verifying...' : 'Verify'}
              </Button>
            </form>
            <Button
              variant="outline"
              className="w-full"
              disabled={loading || !lastPhoneNumber}
              onClick={() => lastPhoneNumber && sendOTP(lastPhoneNumber)}
            >
              Resend OTP
            </Button>
          </CardContent>
        </Card>
      </main>
      <BottomNavigation />
    </div>
  );
}
