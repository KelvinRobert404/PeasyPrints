'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { FileDropzone } from '@/components/upload/FileDropzone';
import { PrintConfigurator } from '@/components/upload/PrintConfigurator';
import { PrintUpgrades } from '@/components/upload/PrintUpgrades';
import { PriceSummary } from '@/components/upload/PriceSummary';
import { CheckoutButton } from '@/components/upload/CheckoutButton';
import { UmbrellaSelector } from '@/components/upload/UmbrellaSelector';
import { ImagesUploader } from '@/components/upload/ImagesUploader';
import { AssignmentConfigurator } from '@/components/upload/AssignmentConfigurator';
import { useShopsStore } from '@/lib/stores/shopsStore';
import { useUploadStore } from '@/lib/stores/uploadStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCollegeStore } from '@/lib/stores/collegeStore';
import haptics from '@/lib/utils/haptics';

export default function UploadEntryPage() {
  const { shops, subscribe } = useShopsStore();
  const { setShopPricing, jobType, file, images } = useUploadStore();
  const { selectedCollege, colleges, subscribe: subscribeColleges } = useCollegeStore();
  const [selectedShopId, setSelectedShopId] = useState<string>('');

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
    if (open && close) return `${open}:${close}`;
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

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F5F7] font-sans">
      {/* Slim title row — the single header on this page */}
      <div className="sticky top-0 z-30 border-b border-black/[0.05] bg-[#F4F5F7]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-2.5 px-3 py-3">
          <Link href="/" aria-label="Back home" className="campus-press flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
            <ArrowLeft size={18} className="text-black" />
          </Link>
          <div className="min-w-0 flex-1 leading-tight">
            <h1 className="truncate font-quinn text-[18px] font-bold tracking-tight text-black">print</h1>
          </div>
          {selectedShop ? <span className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-cream">{selectedShop.name}</span> : null}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto px-3 pt-3 pb-28 space-y-2.5">
        <Card className="rounded-[20px] border-black/[0.06]">
          <CardContent className="p-3">
            <div className="relative">
              <div
                ref={scrollerRef}
                onScroll={updateScrollIndicators}
                className="grid grid-flow-col auto-cols-[22%] gap-1.5 overflow-x-auto snap-x py-0.5 no-scrollbar"
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
                        className={[
                          'relative aspect-[4/5] rounded-2xl border shadow-sm p-1.5 flex flex-col items-center justify-between text-center overflow-hidden',
                          'transition-all',
                          isOpen ? 'bg-white hover:shadow-md' : 'bg-zinc-100 opacity-60 grayscale cursor-not-allowed',
                          isSelected && isOpen ? 'ring-2 ring-royal border-transparent' : 'border-black/[0.06]',
                          'snap-start shrink-0'
                        ].join(' ')}
                      >
                        <div className="w-full flex justify-center">
                          {isOpen ? (
                            <span className="rounded-full bg-ink px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.08em] text-cream">Open</span>
                          ) : (
                            <span className="rounded-full bg-zinc-200/70 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.08em] text-zinc-500">Closed</span>
                          )}
                        </div>
                        <div className="px-0.5 w-full min-w-0">
                          <div className="font-quinn text-[12px] font-bold w-full line-clamp-2 leading-tight text-ink">{s.name}</div>
                        </div>

                      </button>
                    );
                  })}
              </div>
              {showLeft && (
                <div className="absolute left-1 top-1/2 -translate-y-1/2 z-20">
                  <ChevronLeft className="w-4 h-4 text-gray-500" />
                </div>
              )}
              {showRight && (
                <div className="absolute right-1 top-1/2 -translate-y-1/2 z-20">
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </div>
              )}
            </div>
            {selectedShop && (
              <div className="mt-2.5 rounded-2xl bg-[#F4F5F7] p-2.5">
                {selectedShop.address && (
                  <div className="text-[11px] text-zinc-600 leading-relaxed">{selectedShop.address}</div>
                )}
                {formatShopTiming(selectedShop) && (
                  <div className="mt-1">
                    <Badge
                      variant="outline"
                      className="px-2 py-0.5 text-[10px] bg-cream/60 text-ink border-ink/10"
                    >
                      {formatShopTiming(selectedShop) as string}
                    </Badge>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[20px] border-black/[0.06]">
          <CardHeader className="p-3 pb-0">
            <CardTitle className="font-quinn text-[17px] font-bold text-ink">What are we printing today?</CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <UmbrellaSelector />
          </CardContent>
        </Card>

        <div className="relative" onClick={disabled ? nudgeSelectShop : undefined}>
          <Card className={`rounded-[20px] border-black/[0.06] ${disabled ? 'opacity-60 pointer-events-none select-none' : ''}`}>
            <CardHeader className="p-3 pb-0">
              <CardTitle className="font-quinn text-[17px] font-bold text-ink">
                {jobType === 'Assignment' ? 'Select Assignment PDF' : 'Select PDF or Images'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
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
            </CardContent>
          </Card>
          {disabled && (
            <button
              type="button"
              aria-label="Select a shop first to continue"
              onClick={nudgeSelectShop}
              className="absolute inset-0 z-20 bg-transparent"
            />
          )}
        </div>

        <Card className={`rounded-[20px] border-black/[0.06] ${disabled ? 'opacity-60 pointer-events-none select-none' : ''}`}>
          <CardHeader className="p-3 pb-0">
            <CardTitle className="font-quinn text-[17px] font-bold text-ink">Print Configuration</CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            {jobType === 'Assignment' ? (
              <AssignmentConfigurator />
            ) : (
              <PrintConfigurator />
            )}
          </CardContent>
        </Card>

        <Card className={`rounded-[20px] border-black/[0.06] ${disabled ? 'opacity-60 pointer-events-none select-none' : ''}`}>
          <CardHeader className="p-3 pb-0">
            <CardTitle className="font-quinn text-[17px] font-bold text-ink">Print Upgrades</CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <PrintUpgrades shopTiming={selectedShop?.timing} />
          </CardContent>
        </Card>

        <Card className={`rounded-[20px] border-black/[0.06] ${disabled ? 'opacity-60 pointer-events-none select-none' : ''}`}>
          <CardHeader className="p-3 pb-0">
            <CardTitle className="font-quinn text-[17px] font-bold text-ink">Summary</CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <PriceSummary />
          </CardContent>
        </Card>

        {/* Checkout CTA separated */}
        <div className={disabled ? 'opacity-60 pointer-events-none select-none' : ''}>
          <CheckoutButton shopId={selectedShopId} shopName={selectedShop?.name} />
        </div>
      </main>
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] w-full max-w-[428px] px-4">
          <div className="rounded-full bg-ink text-cream px-4 py-2.5 text-[13px] font-semibold text-center shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}


function CollegePill() {
  const { selectedCollege } = useCollegeStore();
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-white/90 text-blue-900 px-3 py-1 text-xs">
      <span className="inline-block w-2 h-2 rounded-full bg-blue-900" />
      <span className="truncate max-w-[180px]">{selectedCollege}</span>
    </div>
  );
}
