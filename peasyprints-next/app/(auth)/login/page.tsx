'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { useState } from 'react';
import { PhoneLogin } from '@/components/auth/PhoneLogin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
  const { loginWithEmail, loading, error, sendPasswordReset, registerWithEmail } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b px-4 py-3">
        <h1 className="text-lg font-semibold">Login</h1>
      </header>
      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Email Login</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                await loginWithEmail(email, password);
              }}
            >
              <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              {error && <div className="text-sm text-red-600">{error}</div>}
              <Button className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <Input placeholder="Username (for new account)" value={username} onChange={(e) => setUsername(e.target.value)} />
                <button
                  type="button"
                  className="text-blue-600"
                  onClick={async () => {
                    if (!email) return;
                    await sendPasswordReset(email);
                    alert('Password reset email sent (if account exists).');
                  }}
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  className="text-gray-700"
                  onClick={async () => {
                    if (!email || !password || !username) return;
                    await registerWithEmail(email, password, username);
                    router.replace('/dashboard');
                  }}
                >
                  Create with email
                </button>
              </div>
              <div className="text-center text-sm text-gray-600">
                New here? <Link className="text-blue-600" href="/register">Create account</Link>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-gray-500">OR</div>
        <Card>
          <CardHeader>
            <CardTitle>Phone Login</CardTitle>
          </CardHeader>
          <CardContent>
            <PhoneLogin />
          </CardContent>
        </Card>
      </main>
      <BottomNavigation />
    </div>
  );
}
