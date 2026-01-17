'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
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
    <div className="min-h-screen flex flex-col bg-gray-50 font-outfit">
      {/* Navbar */}
      <div className="bg-blue-600 px-4 py-3 flex items-center gap-3">
        <a href="/" className="text-white active:opacity-70">
          <span className="material-symbols-rounded text-2xl">arrow_back</span>
        </a>
        <h1 className="text-lg font-semibold text-white">Print</h1>
      </div>

      <main className="flex-1 overflow-y-auto p-4 pb-24 md:pb-10 space-y-4">
        <Card>
          <CardContent className="pt-3">
            <div className="relative">
              <div
                ref={scrollerRef}
                onScroll={updateScrollIndicators}
                className="grid grid-flow-col auto-cols-[25%] gap-2 overflow-x-auto snap-x py-1 no-scrollbar"
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
                          'relative aspect-[4/3] rounded-xl border shadow-sm p-1.5 flex flex-col items-center justify-between text-center overflow-hidden',
                          'transition-all',
                          isOpen ? 'bg-white hover:shadow-md' : 'bg-gray-100 opacity-60 grayscale cursor-not-allowed',
                          isSelected && isOpen ? 'ring-2 ring-blue-600' : '',
                          'snap-start shrink-0'
                        ].join(' ')}
                      >
                        <div className="w-full flex justify-center">
                          {isOpen ? (
                            <Badge className="px-2 py-0.5 text-[10px]">OPEN</Badge>
                          ) : (
                            <Badge variant="destructive" className="px-2 py-0.5 text-[10px]">Closed</Badge>
                          )}
                        </div>
                        <div className="px-1 w-full min-w-0">
                          <div className="text-xs font-semibold w-full line-clamp-2 leading-tight">{s.name}</div>
                        </div>

                      </button>
                    );
                  })}
              </div>
              {showLeft && (
                <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent z-10" />
              )}
              {showRight && (
                <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10" />
              )}
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
              <div className="mt-3 rounded-xl border bg-white p-3 shadow-sm">
                {selectedShop.address && (
                  <div className="text-xs text-gray-800">
                    <div className="font-medium mb-0.5">Address:</div>
                    <div className="text-gray-700 leading-relaxed">{selectedShop.address}</div>
                  </div>
                )}
                {formatShopTiming(selectedShop) && (
                  <div className="text-xs text-gray-800 mt-2">
                    <span className="font-medium mr-1">Timing:</span>
                    <Badge
                      variant="outline"
                      className="px-2 py-0.5 text-[10px] bg-yellow-500/10 text-yellow-700 border-yellow-500/20"
                    >
                      {formatShopTiming(selectedShop) as string}
                    </Badge>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">What are we printing today?</CardTitle>
          </CardHeader>
          <CardContent>
            <UmbrellaSelector />
          </CardContent>
        </Card>

        <div className="relative" onClick={disabled ? nudgeSelectShop : undefined}>
          <Card className={disabled ? 'opacity-60 pointer-events-none select-none' : ''}>
            <CardHeader>
              <CardTitle className="text-base">
                {jobType === 'Assignment' ? 'Select Assignment PDF' : 'Select PDF or Images'}
              </CardTitle>
            </CardHeader>
            <CardContent>
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

        <Card className={disabled ? 'opacity-60 pointer-events-none select-none' : ''}>
          <CardHeader>
            <CardTitle className="text-base">Print Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            {jobType === 'Assignment' ? (
              <AssignmentConfigurator />
            ) : (
              <PrintConfigurator />
            )}
          </CardContent>
        </Card>

        <Card className={disabled ? 'opacity-60 pointer-events-none select-none' : ''}>
          <CardHeader>
            <CardTitle className="text-base">Print Upgrades</CardTitle>
          </CardHeader>
          <CardContent>
            <PrintUpgrades shopTiming={selectedShop?.timing} />
          </CardContent>
        </Card>

        <Card className={disabled ? 'opacity-60 pointer-events-none select-none' : ''}>
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <PriceSummary />
          </CardContent>
        </Card>

        {/* Checkout CTA separated */}
        <div className={disabled ? 'opacity-60 pointer-events-none select-none' : ''}>
          <CheckoutButton shopId={selectedShopId} shopName={selectedShop?.name} />
        </div>
      </main>
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[60]">
          <div className="rounded-md bg-gray-900 text-white px-3 py-2 text-sm shadow-lg">
            {toast}
          </div>
        </div>
      )}
      <BottomNavigation />
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
