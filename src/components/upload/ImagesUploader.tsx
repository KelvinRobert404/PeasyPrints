'use client';

import { useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useUploadStore } from '@/lib/stores/uploadStore';
import { ImagesLayoutPreview } from '@/components/upload/ImagesLayoutPreview';
import { AlertIcon, ImageIcon } from '@/components/swoop/icons';
import { cn } from '@/lib/utils/cn';

const ACCEPT = ['image/png', 'image/jpeg'];
const MAX_IMAGE_MB = 8;

export function ImagesUploader() {
  const { images, setImages, imagesPages, settings, imagesScale } = useUploadStore();
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const n = images.length;
      if (n === 0) { setOverflow(false); return; }
      const perPage = Math.max(1, Math.ceil(n / Math.max(1, imagesPages)));
      const sample = images.slice(0, perPage);
      // load sizes
      const sizes = await Promise.all(sample.map((f) => new Promise<{ w: number; h: number }>((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(f);
        img.onload = () => { resolve({ w: img.width, h: img.height }); URL.revokeObjectURL(url); };
        img.onerror = () => { resolve({ w: 1, h: 1 }); URL.revokeObjectURL(url); };
        img.src = url;
      })));
      // page size in points
      const [pw, ph] = settings.paperSize === 'A4' ? [595.28, 841.89] : [841.89, 1190.55];
      const gapPt = 0.5 * 28.3465;
      function chooseBestGrid(k: number, sz: Array<{ w: number; h: number }>) {
        const candidates: Array<{ rows: number; cols: number }> = [];
        const maxRowsToTry = Math.min(k, 8);
        for (let r = 1; r <= maxRowsToTry; r++) candidates.push({ rows: r, cols: Math.ceil(k / r) });
        const c0 = Math.ceil(Math.sqrt(k));
        candidates.push({ rows: Math.ceil(k / c0), cols: c0 });
        let best = candidates[0];
        let bestUtil = -1;
        for (const cand of candidates) {
          const cw = (pw - (cand.cols + 1) * gapPt) / cand.cols;
          const ch = (ph - (cand.rows + 1) * gapPt) / cand.rows;
          if (cw <= 0 || ch <= 0) continue;
          let used = 0;
          for (const s of sz) {
            const scale0 = Math.min(cw / s.w, ch / s.h);
            const area0 = Math.max(scale0, 0) * s.w * Math.max(scale0, 0) * s.h;
            const scale1 = Math.min(cw / s.h, ch / s.w);
            const area1 = Math.max(scale1, 0) * s.w * Math.max(scale1, 0) * s.h;
            used += Math.max(area0, area1);
          }
          const util = used / (pw * ph);
          if (util > bestUtil) { bestUtil = util; best = cand; }
        }
        return best;
      }
      const grid = chooseBestGrid(sample.length, sizes);
      const cellW = (pw - (grid.cols + 1) * gapPt) / grid.cols;
      const cellH = (ph - (grid.rows + 1) * gapPt) / grid.rows;
      const willOverflow = sizes.some((s) => {
        const base0 = Math.min(cellW / s.w, cellH / s.h);
        const base1 = Math.min(cellW / s.h, cellH / s.w);
        const base = Math.max(base0, base1);
        // Trigger warning as soon as requested scale exceeds exact fit
        return imagesScale > 1.0 && (imagesScale - 1.0) > 1e-3 && (base * imagesScale) - 1.0 > 1e-3;
      });
      if (!cancelled) setOverflow(willOverflow);
    })();
    return () => { cancelled = true; };
  }, [images, imagesPages, settings.paperSize, imagesScale]);

  const [error, setError] = useState<string | null>(null);

  const onDrop = (accepted: File[]) => {
    const valid: File[] = [];
    for (const f of accepted) {
      if (!ACCEPT.includes(f.type)) {
        setError('Only PNG and JPG are supported');
        continue;
      }
      if (f.size > MAX_IMAGE_MB * 1024 * 1024) {
        setError(`Each image must be ≤ ${MAX_IMAGE_MB} MB`);
        continue;
      }
      valid.push(f);
    }
    if (valid.length) {
      setError(null);
      setImages(valid);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg'] }
  });

  const hasImages = Boolean(images && images.length > 0);

  return (
    <div className="space-y-2">
      <div
        {...getRootProps()}
        className={cn(
          'cursor-pointer select-none rounded-[14px] text-center outline-none focus-visible:ring-2 focus-visible:ring-royal/40',
          hasImages ? 'bg-surface p-1.5' : 'border-[1.5px] border-dashed px-3 py-5',
          !hasImages && (isDragActive ? 'border-royal bg-royal-tint' : 'border-line bg-surface')
        )}
      >
        <input {...getInputProps()} />
        {hasImages ? (
          <div className="overflow-hidden rounded-[12px] border border-line bg-white">
            <div className="h-64 overflow-auto p-2">
              <ImagesLayoutPreview />
            </div>
            <div className="flex items-center gap-2 border-t border-line px-2.5 py-2 text-left">
              <ImageIcon size={18} className="shrink-0 text-royal" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-bold text-ink">
                  {images.length} image{images.length > 1 ? 's' : ''} selected
                </p>
                <p className="text-[11px] text-slate">Tap to replace</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-1">
            <ImageIcon size={24} className={isDragActive ? 'text-royal' : 'text-ink'} />
            <p className="mt-0.5 text-[12.5px] font-bold text-ink">{isDragActive ? 'Drop images here' : 'Select images'}</p>
            <p className="text-[11px] text-slate">Tap to add or drag and drop</p>
          </div>
        )}
      </div>
      {error && <p role="alert" className="text-[11px] font-semibold text-market">{error}</p>}

      {/* Controls moved to Customize in Print Configuration */}

      {/* Precise overflow warning */}
      {overflow && (
        <div className="flex items-start gap-2 rounded-[12px] bg-market-tint px-2.5 py-2">
          <AlertIcon size={16} className="mt-px shrink-0 text-market" />
          <p className="text-[11px] leading-[1.4] text-ink">
            These images won&apos;t fit without overlapping. Add pages or reduce the image size.
          </p>
        </div>
      )}

      {/* Keep preview within the dropzone when images exist */}
    </div>
  );
}
