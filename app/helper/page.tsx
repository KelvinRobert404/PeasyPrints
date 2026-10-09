"use client";

import Link from 'next/link';
import { Card, IconTile, swButton } from '@/components/swoop/primitives';
import { CheckIcon, PrintIcon } from '@/components/swoop/icons';
import { DownloadIcon } from '@/components/auth/icons';
import { cn } from '@/lib/utils/cn';

const CURRENT_VERSION = "2.0.0";
const BUILD_DATE = "2025-12-14";

const CHANGES = [
  { title: 'Perfect print quality', body: 'Prints at original PDF resolution (no more blurry text)' },
  { title: 'API Base override', body: 'Advanced setting for custom server endpoints' },
  { title: 'Better stability', body: 'Fixed memory leaks and improved error handling' },
  { title: 'Debug logging', body: 'Logs saved to %LOCALAPPDATA%\\PeasyPrint\\logs' }
];

export default function HelperPage() {
  return (
    <main className="flex flex-1 flex-col bg-white px-3 pb-3 pt-3">
      <div className="flex items-center gap-2.5">
        <IconTile icon={PrintIcon} tone="royal" shape="square" size={40} />
        <div className="min-w-0">
          <h1 className="font-heading text-[16px] leading-[1.1] text-ink">PeasyPrint Helper</h1>
          <p className="text-[11px] text-slate">
            Version {CURRENT_VERSION} • Build {BUILD_DATE}
          </p>
        </div>
      </div>

      <p className="mt-3 text-[12.5px] leading-[1.5] text-text-secondary">
        Install PeasyPrint Helper on your Windows PC to enable one-click printing from the dashboard.
      </p>

      <Link href="/api/helper/download" className={cn(swButton({ size: 'lg' }), 'mt-3 w-full')}>
        <DownloadIcon size={18} />
        Download Helper
      </Link>
      <p className="mt-1.5 text-center text-[11px] text-slate">Windows 10/11 • Run and follow on-screen steps</p>

      <section className="pt-3.5">
        <h2 className="font-heading text-[14.5px] leading-[1.1] text-ink">What&apos;s new in v{CURRENT_VERSION}</h2>
        <Card className="mt-2 px-3 py-1">
          <ul>
            {CHANGES.map((c, i) => (
              <li key={c.title} className={cn('flex items-start gap-2 py-2', i < CHANGES.length - 1 && 'border-b border-line')}>
                <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-go-tint text-go-text">
                  <CheckIcon size={10} />
                </span>
                <span className="text-[11.5px] leading-[1.45] text-text-secondary">
                  <strong className="font-bold text-ink">{c.title}</strong> – {c.body}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <p className="mt-3 text-[11.5px] leading-[1.45] text-slate">After installation, return to the dashboard and click Print again.</p>
    </main>
  );
}
