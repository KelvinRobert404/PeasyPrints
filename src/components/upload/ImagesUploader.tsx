'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useUploadStore } from '@/lib/stores/uploadStore';
import { ImagesLayoutPreview } from '@/components/upload/ImagesLayoutPreview';

const ACCEPT = ['image/png', 'image/jpeg'];
const MAX_IMAGE_MB = 8;

export function ImagesUploader() {
  const { images, setImages, imagesPages, setImagesPages, settings, setSettings, imagesScale, setImagesScale } = useUploadStore();
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

  // No auto page increment on scale; user controls Pages explicitly
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onFilesSelected(filesList: FileList | null) {
    if (!filesList) return;
    const valid: File[] = [];
    for (const f of Array.from(filesList)) {
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
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="h-10 rounded-md bg-blue-600 text-white px-3"
        >
          Select Images
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT.join(',')}
          multiple
          className="hidden"
          onChange={(e) => onFilesSelected(e.currentTarget.files)}
        />
        <div className="text-xs text-gray-600">PNG/JPG only • A3/A4 • Auto layout</div>
      </div>
      {error && <div className="text-xs text-red-600">{error}</div>}

      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Pages</label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="h-8 w-8 rounded bg-white border"
            onClick={() => setImagesPages(Math.max(1, imagesPages - 1))}
          >
            −
          </button>
          <div className="w-10 text-center text-sm font-semibold">{imagesPages}</div>
          <button
            type="button"
            className="h-8 w-8 rounded bg-white border"
            onClick={() => setImagesPages(Math.min(5, imagesPages + 1))}
          >
            +
          </button>
        </div>
      </div>

      {/* spacing fixed at 0.5cm by default; control removed */}

      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Image size</label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="h-8 w-8 rounded bg-white border"
            onClick={() => setImagesScale(Math.max(0.5, Math.round((imagesScale - 0.1) * 10) / 10))}
          >
            −
          </button>
          <div className="w-10 text-center text-sm font-semibold">{Math.round(imagesScale * 100)}%</div>
          <button
            type="button"
            className="h-8 w-8 rounded bg-white border"
            onClick={() => setImagesScale(Math.min(2.0, Math.round((imagesScale + 0.1) * 10) / 10))}
          >
            +
          </button>
        </div>
      </div>

      {/* Precise overflow warning */}
      {overflow && (
        <div className="text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 rounded p-2">
          Current image size and pages cannot fit all images without overlap. Increase Pages or reduce image size.
        </div>
      )}

      <ImagesLayoutPreview />
    </div>
  );
}


