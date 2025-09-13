'use client';

import { useEffect, useRef, useState } from 'react';
import { useUploadStore } from '@/lib/stores/uploadStore';

export function PdfPreviewer() {
  const { fileUrl, pageCount } = useUploadStore();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pdfjs, setPdfjs] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === 'undefined') return;
      const pdfjsLib = await import('pdfjs-dist');
      // Always use same-origin worker to avoid cross-origin module import issues
      // Place the worker at public/pdf.worker.min.mjs (copied from pdfjs-dist in postinstall)
      // @ts-ignore
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      if (!cancelled) setPdfjs(pdfjsLib);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!pdfjs || !fileUrl || !containerRef.current || pageCount === 0) return;
    let cancelled = false;
    (async () => {
      const loadingTask = pdfjs.getDocument(fileUrl);
      const pdf = await loadingTask.promise;
      if (cancelled) return;
      const container = containerRef.current!;
      container.innerHTML = '';

      for (let i = 1; i <= pageCount; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: context, viewport }).promise;

        const wrapper = document.createElement('div');
        wrapper.className = 'mb-4';
        const label = document.createElement('div');
        label.className = 'mb-2 text-xs text-gray-600';
        label.textContent = `Page ${i} of ${pageCount}`;
        wrapper.appendChild(label);
        wrapper.appendChild(canvas);
        container.appendChild(wrapper);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfjs, fileUrl, pageCount]);

  if (!fileUrl) return null;

  return <div ref={containerRef} data-ph-no-capture />;
}
