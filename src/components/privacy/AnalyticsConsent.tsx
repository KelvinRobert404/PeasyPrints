'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { useDockStore } from '@/lib/stores/dockStore';
import { swButton } from '@/components/swoop/primitives';
import { cn } from '@/lib/utils/cn';

export const ANALYTICS_CONSENT_KEY = 'peasy_analytics_consent';

export function AnalyticsConsent() {
  const [consent, setConsent] = useState<'granted' | 'denied' | null>(null);
  // Read-only: sit just above the dock (tab bar 52px, live slot +46px).
  const hasSlot = useDockStore((s) => Boolean(s.slot));
  const dockHidden = useDockStore((s) => s.hidden);
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

  const bottom = dockHidden
    ? 'bottom-[calc(12px+env(safe-area-inset-bottom))]'
    : hasSlot
      ? 'bottom-[calc(112px+env(safe-area-inset-bottom))]'
      : 'bottom-[calc(60px+env(safe-area-inset-bottom))]';

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
    {consent === null ? (
      <aside
        role="dialog"
        aria-label="Analytics preferences"
        className={cn('fixed inset-x-0 z-[100] mx-auto w-full max-w-[428px] px-2', bottom)}
      >
        <div className="rounded-[14px] border border-line bg-white p-3 shadow-[0_8px_22px_rgba(16,24,40,0.14)]">
          <p className="font-heading text-[14px] leading-[1.15] text-ink">Help improve Swoop?</p>
          <p className="mt-1 text-[11.5px] leading-[1.45] text-slate">
            Optional analytics help us diagnose checkout problems. They stay off until you agree. Essential authentication and payment storage still work.
          </p>
          <div className="mt-2.5 flex items-center gap-1.5">
            <button type="button" onClick={() => choose('granted')} className={swButton({ size: 'sm' })}>
              Allow analytics
            </button>
            <button type="button" onClick={() => choose('denied')} className={swButton({ variant: 'surface', size: 'sm' })}>
              Only essential
            </button>
            <Link href="/privacy" className="ml-auto flex min-h-8 items-center text-[11.5px] font-bold text-royal">
              Privacy details
            </Link>
          </div>
        </div>
      </aside>
    ) : null}
  </>;
}
