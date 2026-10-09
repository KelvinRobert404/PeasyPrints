'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FileDropzone } from '@/components/upload/FileDropzone';
import { PrintConfigurator } from '@/components/upload/PrintConfigurator';
import { PrintUpgrades } from '@/components/upload/PrintUpgrades';
import { PriceSummary } from '@/components/upload/PriceSummary';
import { CheckoutButton } from '@/components/upload/CheckoutButton';
import { UmbrellaSelector } from '@/components/upload/UmbrellaSelector';
import { ImagesUploader } from '@/components/upload/ImagesUploader';
import { AssignmentConfigurator } from '@/components/upload/AssignmentConfigurator';
import { ChevronLeftIcon } from '@/components/upload/icons';
import { PageHeader, SectionHeader, StatusLine } from '@/components/swoop/primitives';
import { ChevronRightIcon, ClockIcon, PinIcon } from '@/components/swoop/icons';
import { useShopsStore } from '@/lib/stores/shopsStore';
import { useUploadStore } from '@/lib/stores/uploadStore';
import { useCollegeStore } from '@/lib/stores/collegeStore';
import { useHideDock } from '@/lib/stores/dockStore';
import haptics from '@/lib/utils/haptics';
import { cn } from '@/lib/utils/cn';

function Section({ title, dimmed, children }: { title: ReactNode; dimmed?: boolean; children: ReactNode }) {
  return (
    <section className={cn('pt-3.5', dimmed && 'pointer-events-none select-none opacity-60')}>
      <SectionHeader title={title} className="mb-2" />
      {children}
    </section>
  );
}

export default function UploadEntryPage() {
  const { shops, subscribe } = useShopsStore();
  const { setShopPricing, jobType, file, images } = useUploadStore();
  const { selectedCollege, colleges, subscribe: subscribeColleges } = useCollegeStore();
  const [selectedShopId, setSelectedShopId] = useState<string>('');

  // This screen owns a sticky checkout bar, so the global dock steps aside.
  useHideDock();

  // Read window.location rather than useSearchParams to keep this page statically renderable.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('shopId');
    if (requested) setSelectedShopId((current) => current || requested);
  }, []);


  useEffect(() => {
    const unsub = subscribe();
    return () => unsub();
  }, [subscribe]);

  // Subscribe to colleges
  useEffect(() => {
    const unsub = subscribeColleges();
    return () => unsub();
  }, [subscribeColleges]);

  // Filter shops by selected college
  const filteredShops = useMemo(() => {
    // Find the college ID for the selected college name
    const selectedCollegeObj = colleges.find(c => c.name === selectedCollege);
    if (!selectedCollegeObj) return shops; // Show all if no college selected
    return shops.filter(s => s.collegeId === selectedCollegeObj.id);
  }, [shops, colleges, selectedCollege]);

  const selectedShop = useMemo(() => shops.find((s) => s.id === selectedShopId), [shops, selectedShopId]);

  useEffect(() => {
    setShopPricing(selectedShop?.pricing);
  }, [selectedShop, setShopPricing]);

  const disabled = !selectedShopId;

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);
  const [toast, setToast] = useState<string>('');

  function updateScrollIndicators() {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollLeft, clientWidth, scrollWidth } = el;
    setShowLeft(scrollLeft > 0);
    setShowRight(scrollLeft + clientWidth < scrollWidth - 1);
  }

  useEffect(() => {
    // Recompute on mount and when list changes
    updateScrollIndicators();
  }, [shops.length]);

  function formatHourLabel(raw?: string): string | null {
    if (!raw) return null;
    const s = String(raw).trim();
    // e.g., 10, 10:30, 18, 18:00
    let m = s.match(/^(\d{1,2})(?::(\d{2}))?$/);
    if (m) {
      let h = Number(m[1]);
      const suffix = h >= 12 ? 'PM' : 'AM';
      if (h === 0) h = 12;
      if (h > 12) h = h - 12;
      return `${h}${suffix}`;
    }
    // e.g., 10AM, 10:30am, 12 pm
    m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*([AaPp][Mm])$/);
    if (m) {
      let h = Number(m[1]);
      const suffix = m[3].toUpperCase();
      if (h === 0) h = 12;
      if (h > 12) h = h % 12;
      return `${h}${suffix}`;
    }
    return null;
  }

  function formatShopTiming(s: { openingTime?: string; closingTime?: string; timing?: string }): string | undefined {
    const open = formatHourLabel(s.openingTime);
    const close = formatHourLabel(s.closingTime);
    if (open && close) return `${open} – ${close}`;
    return s.timing ?? undefined;
  }

  function nudgeSelectShop() {
    // Show toast and auto-scroll to the shops scroller
    try { haptics.warn(); } catch { }
    setToast('Select a shop first to continue.');
    try {
      scrollerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch { }
    // Auto-hide after 2.5s
    window.setTimeout(() => setToast(''), 2500);
  }

  const shopTiming = selectedShop ? formatShopTiming(selectedShop) : undefined;

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans">
      <PageHeader
        backHref="/"
        kicker={selectedShop?.name ?? 'PeasyPrints'}
        title="Print"
        className="sticky top-0 z-30 border-b border-line bg-white pb-1.5"
      />

      <main className="flex-1 px-3 pb-3">
        {/* Shop picker */}
        <section className="pt-3">
          <SectionHeader title="Pick a shop" className="mb-2" />
          <div className="relative">
            <div
              ref={scrollerRef}
              onScroll={updateScrollIndicators}
              className="no-scrollbar grid snap-x auto-cols-[30%] grid-flow-col gap-1.5 overflow-x-auto py-0.5"
            >
              {[...filteredShops]
                .sort((a, b) => Number(Boolean(b.isOpen)) - Number(Boolean(a.isOpen)))
                .map((s) => {
                  const isSelected = selectedShopId === s.id;
                  const isOpen = Boolean(s.isOpen);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        if (!isOpen) return;
                        setSelectedShopId(s.id);
                      }}
                      aria-disabled={!isOpen}
                      aria-pressed={isSelected && isOpen}
                      className={cn(
                        'campus-press relative flex h-[72px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-[12px] p-2 text-left transition-colors',
                        isOpen ? 'bg-surface' : 'cursor-not-allowed bg-surface opacity-60 grayscale',
                        isSelected && isOpen && 'bg-royal-tint ring-2 ring-inset ring-royal'
                      )}
                    >
                      <StatusLine open={isOpen} label={isOpen ? 'Open' : 'Closed'} />
                      <span className="font-heading line-clamp-2 w-full text-[12.5px] leading-[1.1] text-ink">{s.name}</span>
                    </button>
                  );
                })}
            </div>
            {showLeft && (
              <span aria-hidden className="pointer-events-none absolute left-1 top-1/2 z-20 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow-[0_1px_3px_rgba(16,24,40,0.16)]">
                <ChevronLeftIcon size={12} />
              </span>
            )}
            {showRight && (
              <span aria-hidden className="pointer-events-none absolute right-1 top-1/2 z-20 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow-[0_1px_3px_rgba(16,24,40,0.16)]">
                <ChevronRightIcon size={12} />
              </span>
            )}
          </div>
          {selectedShop && (selectedShop.address || shopTiming) && (
            <div className="mt-2 flex flex-col gap-1 rounded-[12px] bg-surface px-2.5 py-2">
              {selectedShop.address && (
                <p className="flex items-start gap-1.5 text-[11px] leading-[1.4] text-text-secondary">
                  <PinIcon size={14} className="mt-px shrink-0 text-slate" />
                  <span className="min-w-0">{selectedShop.address}</span>
                </p>
              )}
              {shopTiming && (
                <p className="flex items-center gap-1.5 text-[11px] font-bold text-ink tabular-nums">
                  <ClockIcon size={14} className="shrink-0 text-slate" />
                  {shopTiming}
                </p>
              )}
            </div>
          )}
        </section>

        <Section title="What are we printing?">
          <UmbrellaSelector />
        </Section>

        <div className="relative" onClick={disabled ? nudgeSelectShop : undefined}>
          <Section title={jobType === 'Assignment' ? 'Select assignment PDF' : 'Select PDF or images'} dimmed={disabled}>
            {jobType === 'Assignment' ? (
              <FileDropzone />
            ) : (() => {
              const hasPdf = Boolean(file);
              const hasImages = Boolean(images && images.length > 0);
              if (hasPdf) return <FileDropzone />;
              if (hasImages) return <ImagesUploader />;
              return (
                <div className="grid grid-cols-2 gap-2">
                  <FileDropzone />
                  <ImagesUploader />
                </div>
              );
            })()}
          </Section>
          {disabled && (
            <button
              type="button"
              aria-label="Select a shop first to continue"
              onClick={nudgeSelectShop}
              className="absolute inset-0 z-20 bg-transparent"
            />
          )}
        </div>

        <Section title="Print settings" dimmed={disabled}>
          {jobType === 'Assignment' ? (
            <AssignmentConfigurator />
          ) : (
            <PrintConfigurator />
          )}
        </Section>

        <Section title="Upgrades" dimmed={disabled}>
          <PrintUpgrades shopTiming={selectedShop?.timing} />
        </Section>

        <Section title="Summary" dimmed={disabled}>
          <PriceSummary />
        </Section>
      </main>

      {/* Sticky checkout bar (the dock is hidden on this screen) */}
      <div className="sticky bottom-0 z-30 border-t border-line bg-white px-3 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2.5">
        <div className={disabled ? 'pointer-events-none select-none opacity-60' : ''}>
          <CheckoutButton shopId={selectedShopId} shopName={selectedShop?.name} />
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-[60] w-full max-w-[428px] -translate-x-1/2 px-3">
          <div role="status" className="rounded-full bg-ink px-4 py-2.5 text-center text-[12.5px] font-semibold text-white shadow-[0_4px_16px_rgba(16,24,40,0.18)]">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
