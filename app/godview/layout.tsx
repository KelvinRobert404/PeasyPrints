"use client";

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { onAuthStateChanged, getIdTokenResult } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { isFeatureEnabled } from '@/lib/utils/featureFlags';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function GodviewLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [passphraseOk, setPassphraseOk] = useState<boolean>(false);
  const [passphrase, setPassphrase] = useState<string>('');

  // Feature flag gate
  const enabled = isFeatureEnabled('MASTER_GODVIEW');
  const expectedPass = (process.env.NEXT_PUBLIC_GODVIEW_PASSPHRASE || 'swoopistheking').toString();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setSignedIn(!!u);
      if (!u) {
        setIsAdmin(false);
        return;
      }
      try {
        const token = await getIdTokenResult(u, true);
        const claims = token.claims as any;
        const adminClaim = claims?.admin === true || claims?.role === 'super_admin' || (Array.isArray(claims?.roles) && claims.roles.includes('SUPER_ADMIN'));
        setIsAdmin(!!adminClaim);
      } catch {
        setIsAdmin(false);
      }
    });
    return () => unsub();
  }, []);

  const showLogin = useMemo(() => signedIn === false, [signedIn]);
  const accessDenied = useMemo(() => signedIn === true && isAdmin === false, [signedIn, isAdmin]);

  if (!enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-lg text-center">
          <h1 className="text-2xl font-semibold mb-2">Godview is disabled</h1>
          <p className="text-muted-foreground mb-4">Enable NEXT_PUBLIC_MASTER_GODVIEW to access this route.</p>
        </div>
      </div>
    );
  }

  // In passphrase-only mode, we do not require sign-in

  if (accessDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-lg text-center">
          <h1 className="text-2xl font-semibold mb-2">Enter passphrase</h1>
          <p className="text-muted-foreground mb-4">Provide the godview passphrase to proceed.</p>
          <div className="flex items-center justify-center gap-2">
            <Input placeholder="Passphrase" type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} className="w-64" />
            <Button onClick={() => { if (passphrase === expectedPass) { try { sessionStorage.setItem('godview_passphrase', passphrase); } catch {} setPassphraseOk(true); } }}>Submit</Button>
          </div>
          {passphraseOk && <p className="text-green-600 mt-2">Passphrase accepted. Reloading...</p>}
        </div>
      </div>
    );
  }

  if (!isAdmin && !passphraseOk) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-lg text-center">
          <h1 className="text-2xl font-semibold mb-2">Enter passphrase</h1>
          <p className="text-muted-foreground mb-4">Provide the godview passphrase to proceed.</p>
          <div className="flex items-center justify-center gap-2">
            <Input placeholder="Passphrase" type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} className="w-64" />
            <Button onClick={() => { if (passphrase === expectedPass) { try { sessionStorage.setItem('godview_passphrase', passphrase); } catch {} setPassphraseOk(true); } }}>Submit</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Simple top bar */}
      <div className="sticky top-0 z-20 bg-slate-900 text-white">
        <div className="h-12 px-4 flex items-center justify-between gap-3">
          <span className="font-quinn text-2xl">Godview</span>
          {signedIn && (
            <div className="flex items-center gap-2 ml-auto">
              <Button size="sm" variant="destructive" className="h-8" onClick={() => auth.signOut()}>Logout</Button>
            </div>
          )}
        </div>
      </div>
      <main className="p-3 sm:p-6 max-w-[1400px] mx-auto w-full">{children}</main>
    </div>
  );
}


