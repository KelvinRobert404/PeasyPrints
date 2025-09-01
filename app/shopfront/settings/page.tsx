"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export default function ShopfrontSettingsPage() {
  const [zoom, setZoom] = useState<number>(() => {
    try {
      const v = localStorage.getItem('sf_ui_zoom');
      return v ? Number(v) : 1;
    } catch {
      return 1;
    }
  });

  function clampZoom(value: number) {
    const min = 0.8;
    const max = 1.4;
    const step = 0.1;
    const snapped = Math.round(value / step) * step;
    return Math.min(max, Math.max(min, Number(snapped.toFixed(2))));
  }

  useEffect(() => {
    try { localStorage.setItem('sf_ui_zoom', String(zoom)); } catch {}
    const root = document.documentElement;
    root.style.setProperty('--sf-ui-zoom', String(zoom));
  }, [zoom]);

  const decrease = () => setZoom((z) => clampZoom(z - 0.1));
  const increase = () => setZoom((z) => clampZoom(z + 0.1));
  const reset = () => setZoom(1);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="text-sm text-gray-600">Interface Zoom</div>
        <div className="text-xs text-gray-500">Adjust UI scale across the shopfront</div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={decrease} aria-label="Decrease zoom">−</Button>
        <div className="text-sm w-16 text-center">{Math.round(zoom * 100)}%</div>
        <Button variant="outline" onClick={increase} aria-label="Increase zoom">+</Button>
        <Button variant="ghost" onClick={reset} aria-label="Reset zoom">Reset</Button>
      </div>
    </div>
  );
}


