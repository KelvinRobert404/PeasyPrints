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
      // Prefer external worker in production to avoid SW interception/CORS issues.
      // Ensure API/Worker versions match by deriving from the loaded library version.
      const version: string = (pdfjsLib as any)?.version || '4.8.69';
      const envUrl = process.env.NEXT_PUBLIC_PDF_WORKER_URL as string | undefined;
      // If env is provided and uses a {version} token, substitute it; otherwise use unpkg with the exact version.
      let workerSrc: string = envUrl
        ? envUrl.replace('{version}', version)
        : `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
      // Fallback to local copy if external fails (useful in dev)
      try {
        const res = await fetch(workerSrc, { method: 'HEAD', cache: 'no-store' });
        if (!res.ok) workerSrc = '/pdf.worker.min.mjs';
      } catch {
        workerSrc = '/pdf.worker.min.mjs';
      }
      // @ts-ignore
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
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
