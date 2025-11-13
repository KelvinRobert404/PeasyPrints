'use client';

import { useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useUploadStore } from '@/lib/stores/uploadStore';
import { ImagesLayoutPreview } from '@/components/upload/ImagesLayoutPreview';
import { Image as ImageIcon, Plus } from 'lucide-react';

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

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className="rounded-2xl bg-gray-100 p-4 text-center text-sm cursor-pointer select-none"
      >
        <input {...getInputProps()} />
        {images && images.length > 0 ? (
          <div className="overflow-hidden rounded-xl border bg-white">
            <div className="h-64 overflow-auto">
              <ImagesLayoutPreview />
            </div>
            <div className="px-3 py-2 text-xs text-gray-600 text-left border-t">
              {images.length} image{images.length > 1 ? 's' : ''} selected
            </div>
          </div>
        ) : isDragActive ? (
          <div className="text-gray-600">Drop images here...</div>
        ) : (
          <div className="text-gray-600 flex flex-col items-center justify-center gap-2 py-6">
            <ImageIcon className="w-8 h-8 text-gray-400" />
            <div className="font-medium">Select Images</div>
            <div className="text-xs flex items-center gap-1"><Plus className="w-3 h-3" /> Tap to add or drag & drop</div>
          </div>
        )}
      </div>
      {error && <div className="text-xs text-red-600">{error}</div>}

      {/* Controls moved to Customize in Print Configuration */}

      {/* Precise overflow warning */}
      {overflow && (
        <div className="text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 rounded p-2">
          Current image size and pages cannot fit all images without overlap. Increase Pages or reduce image size.
        </div>
      )}

      {/* Keep preview within the dropzone when images exist */}
    </div>
  );
}


