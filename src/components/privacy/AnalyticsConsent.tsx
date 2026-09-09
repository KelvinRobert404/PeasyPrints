'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { SpeedInsights } from '@vercel/speed-insights/next';

export const ANALYTICS_CONSENT_KEY = 'peasy_analytics_consent';

export function AnalyticsConsent() {
  const [consent, setConsent] = useState<'granted' | 'denied' | null>(null);
  useEffect(() => {
    const stored = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    setConsent(stored === 'granted' || stored === 'denied' ? stored : null);
  }, []);

  const choose = (value: 'granted' | 'denied') => {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
    setConsent(value);
    window.dispatchEvent(new CustomEvent('peasy-analytics-consent', { detail: value }));
    if (value === 'granted') window.location.reload();
  };

  return <>
    {consent === 'granted' ? <>
      <SpeedInsights />
      <Script src="https://www.googletagmanager.com/gtag/js?id=G-049MSKR11F" strategy="afterInteractive" />
      <Script id="gtag-init" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('consent', 'default', { analytics_storage: 'granted' });
        gtag('config', 'G-049MSKR11F', { anonymize_ip: true });
      `}</Script>
    </> : null}
    {consent === null ? <aside role="dialog" aria-label="Analytics preferences" className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-xl rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl">
      <p className="text-sm font-semibold text-zinc-900">Help improve PeasyPrints?</p>
      <p className="mt-1 text-xs leading-5 text-zinc-600">Optional analytics help us diagnose checkout problems. They stay off until you agree. Essential authentication and payment storage still work.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2"><button onClick={() => choose('granted')} className="rounded-xl bg-black px-4 py-2 text-xs font-bold text-white">Allow analytics</button><button onClick={() => choose('denied')} className="rounded-xl border px-4 py-2 text-xs font-bold text-zinc-700">Only essential</button><Link href="/privacy" className="ml-auto text-xs font-semibold text-blue-700 underline">Privacy details</Link></div>
    </aside> : null}
  </>;
}
