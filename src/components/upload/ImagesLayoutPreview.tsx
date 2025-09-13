'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useUploadStore } from '@/lib/stores/uploadStore';
import { chooseBestGrid } from '@/lib/utils/imagePacking';

export function ImagesLayoutPreview() {
  const { images, imagesPages, settings, imagesGapCm, imagesScale } = useUploadStore();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const layout = useMemo(() => {
    const n = images.length;
    const pages = Math.max(1, Math.min(5, Math.floor(imagesPages || 1)));
    const perPage = Math.max(1, Math.ceil(n / pages));
    const cols = Math.ceil(Math.sqrt(perPage));
    const rows = Math.ceil(perPage / cols);
    const chunks: File[][] = [];
    for (let i = 0; i < pages; i++) {
      const start = i * perPage;
      const end = Math.min(start + perPage, n);
      chunks.push(images.slice(start, end));
    }
    return { pages, perPage, cols, rows, pageChunks: chunks };
  }, [images, imagesPages]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Do not clear; we will update in place
    const isA4 = settings.paperSize === 'A4';
    const pageW = isA4 ? 210 : 297; // mm
    const pageH = isA4 ? 297 : 420; // mm
    const pxPerMm = 2; // preview resolution
    const gapPx = Math.max(0, Math.min(imagesGapCm, 4)) * 10 * pxPerMm; // 1cm=10mm

    const render = async () => {
      // Ensure wrappers exist and update their content in place
      const ensureWrapper = (idx: number) => {
        let wrapper = el.querySelector(`.image-page[data-idx="${idx}"]`) as HTMLDivElement | null;
        if (!wrapper) {
          wrapper = document.createElement('div');
          wrapper.className = 'image-page min-w-[220px] max-w-[260px] h-[360px] border rounded bg-white p-2 overflow-hidden shadow-sm flex flex-col';
          wrapper.setAttribute('data-idx', String(idx));
          const pager = document.createElement('div');
          pager.className = 'image-page-pager inline-flex items-center justify-center px-2 py-0.5 text-[10px] text-emerald-900 bg-emerald-100 border border-emerald-200 rounded self-start flex-none';
          wrapper.appendChild(pager);
          const viewport = document.createElement('div');
          viewport.className = 'image-page-viewport mt-2 bg-white border rounded flex-1 overflow-hidden';
          const img = document.createElement('img');
          img.className = 'image-page-img w-full h-full object-contain block';
          viewport.appendChild(img);
          wrapper.appendChild(viewport);
          el.appendChild(wrapper);
        }
        return wrapper;
      };

      for (let index = 0; index < layout.pageChunks.length; index++) {
        const files = layout.pageChunks[index];
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(pageW * pxPerMm);
        canvas.height = Math.floor(pageH * pxPerMm);
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Heuristic grid chooser (mirror of PDF)
        // Load all images for this page first
        const loaded = await Promise.all(files.map((file) => new Promise<{ img: HTMLImageElement; url: string }>((resolve) => {
          const img = new Image();
          const url = URL.createObjectURL(file);
          img.onload = () => resolve({ img, url });
          img.src = url;
        })));

        // Use real image sizes to choose the same grid as the composer
        const sizes = loaded.map(({ img }) => ({ w: img.width, h: img.height }));
        const grid = chooseBestGrid(sizes, canvas.width, canvas.height, gapPx);
        const cellCols = grid.cols;
        const cellRows = grid.rows;
        const cellW = (canvas.width - (cellCols + 1) * gapPx) / cellCols;
        const cellH = (canvas.height - (cellRows + 1) * gapPx) / cellRows;

        loaded.forEach(({ img, url }, i) => {
          const c = i % cellCols;
          const r = Math.floor(i / cellCols);
          const scale0 = Math.min(cellW / img.width, cellH / img.height);
          const area0 = Math.max(scale0, 0) * img.width * Math.max(scale0, 0) * img.height;
          const scale1 = Math.min(cellW / img.height, cellH / img.width);
          const area1 = Math.max(scale1, 0) * img.width * Math.max(scale1, 0) * img.height;
          const useRot = area1 > area0;
          const w = useRot ? img.height : img.width;
          const h = useRot ? img.width : img.height;
          const baseFit = Math.min(cellW / w, cellH / h);
          // Never exceed cell size in preview; clamp to baseFit
          const scale = baseFit * Math.max(0.5, Math.min(imagesScale, 1.0));
          const iw = w * scale;
          const ih = h * scale;
          const x = gapPx + c * (cellW + gapPx) + (cellW - iw) / 2;
          const y = gapPx + r * (cellH + gapPx) + (cellH - ih) / 2;
          if (useRot) {
            ctx.save();
            ctx.translate(x + iw / 2, y + ih / 2);
            ctx.rotate(Math.PI / 2);
            ctx.drawImage(img, -ih / 2, -iw / 2, ih, iw);
            ctx.restore();
          } else {
            ctx.drawImage(img, x, y, iw, ih);
          }
          URL.revokeObjectURL(url);
        });

        const wrapper = ensureWrapper(index);
        const pager = wrapper.querySelector('.image-page-pager') as HTMLDivElement;
        const img = wrapper.querySelector('.image-page-img') as HTMLImageElement;
        if (pager) pager.textContent = `Page ${index + 1} of ${layout.pageChunks.length}`;
        if (img) img.src = canvas.toDataURL('image/png');
      }
      // Remove any extra wrappers (if pages decreased)
      const wrappers = Array.from(el.querySelectorAll('.image-page')) as HTMLDivElement[];
      for (let i = layout.pageChunks.length; i < wrappers.length; i++) {
        wrappers[i].remove();
      }
    };

    void render();
  }, [layout, settings.paperSize, imagesGapCm, imagesScale]);

  if (!images.length) return null;

  return (
    <div className="space-y-3">
      <div className="relative">
        <div ref={containerRef} className="flex gap-3 overflow-x-auto no-scrollbar min-h-[260px]" />
      </div>
    </div>
  );
}


