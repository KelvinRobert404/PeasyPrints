'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useUploadStore } from '@/lib/stores/uploadStore';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils/cn';

export function AssignmentPagePicker({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { fileUrl, pageCount, assignmentColorPages, toggleAssignmentColorPage, clearAssignmentSelection, setAssignmentConfirmed } = useUploadStore();
  const [pdfjs, setPdfjs] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  function formatRanges(nums: number[]): string {
    if (!nums.length) return '';
    const a = [...nums].sort((x, y) => x - y);
    const parts: string[] = [];
    let start = a[0];
    let prev = a[0];
    for (let i = 1; i < a.length; i++) {
      if (a[i] === prev + 1) {
        prev = a[i];
      } else {
        parts.push(start === prev ? String(start) : `${start}-${prev}`);
        start = prev = a[i];
      }
    }
    parts.push(start === prev ? String(start) : `${start}-${prev}`);
    return parts.join(', ');
  }

  const colorText = useMemo(() => formatRanges(assignmentColorPages), [assignmentColorPages]);
  const bwText = useMemo(() => {
    const color = new Set(assignmentColorPages);
    const bw: number[] = [];
    for (let i = 1; i <= pageCount; i++) if (!color.has(i)) bw.push(i);
    return formatRanges(bw);
  }, [assignmentColorPages, pageCount]);

  // Load pdfjs lazily
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!open) return;
      const pdfjsLib = await import('pdfjs-dist');
      // Align worker version with the runtime API to avoid mismatch
      const version: string = (pdfjsLib as any)?.version || '4.8.69';
      const envUrl = process.env.NEXT_PUBLIC_PDF_WORKER_URL as string | undefined;
      let workerSrc: string = envUrl
        ? envUrl.replace('{version}', version)
        : `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
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
    return () => { cancelled = true; };
  }, [open]);

  // Render thumbnails when dialog is open
  useEffect(() => {
    if (!open || !pdfjs || !fileUrl || !containerRef.current || pageCount === 0) return;
    let cancelled = false;
    (async () => {
      const loadingTask = pdfjs.getDocument(fileUrl);
      const pdf = await loadingTask.promise;
      if (cancelled) return;
      const container = containerRef.current!;
      container.innerHTML = '';
      for (let i = 1; i <= pageCount; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.35 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: context, viewport }).promise;

        const wrapper = document.createElement('button');
        wrapper.type = 'button';
        wrapper.className = 'relative rounded-md border bg-white overflow-hidden shadow-sm focus:outline-none';
        wrapper.onclick = () => toggleAssignmentColorPage(i);

        const img = document.createElement('img');
        img.src = canvas.toDataURL('image/png');
        img.className = 'block w-full h-auto pointer-events-none';
        wrapper.appendChild(img);

        const badge = document.createElement('div');
        badge.className = 'absolute left-1 top-1 inline-flex items-center justify-center px-1.5 h-5 rounded text-[10px] font-medium bg-black/70 text-white';
        badge.textContent = String(i);
        wrapper.appendChild(badge);

        const overlay = document.createElement('div');
        const selected = assignmentColorPages.includes(i);
        overlay.className = selected ? 'absolute inset-0 ring-2 ring-inset ring-blue-600 pointer-events-none' : 'absolute inset-0 pointer-events-none';
        overlay.setAttribute('data-overlay', '');
        wrapper.appendChild(overlay);

        const typeBadge = document.createElement('div');
        typeBadge.className = selected
          ? 'absolute right-1 bottom-1 px-1.5 h-5 rounded text-[10px] font-medium bg-blue-600 text-white pointer-events-none'
          : 'absolute right-1 bottom-1 px-1.5 h-5 rounded text-[10px] font-medium bg-gray-700/70 text-white pointer-events-none';
        typeBadge.setAttribute('data-type', '');
        typeBadge.textContent = selected ? 'Color' : 'B/W';
        wrapper.appendChild(typeBadge);

        // Track selected state reactively via MutationObserver pattern
        (wrapper as any)._pageIndex = i;
        container.appendChild(wrapper);
      }

      // Simple reactive refresh when selection changes
      const refresh = () => {
        const children = Array.from(container.children) as HTMLButtonElement[];
        for (const child of children) {
          const idx = (child as any)._pageIndex as number;
          const selected = useUploadStore.getState().assignmentColorPages.includes(idx);
          const overlay = child.querySelector('[data-overlay]') as HTMLDivElement | null;
          if (overlay) overlay.className = selected ? 'absolute inset-0 ring-2 ring-inset ring-blue-600 pointer-events-none' : 'absolute inset-0 pointer-events-none';
          const type = child.querySelector('[data-type]') as HTMLDivElement | null;
          if (type) {
            type.className = selected
              ? 'absolute right-1 bottom-1 px-1.5 h-5 rounded text-[10px] font-medium bg-blue-600 text-white pointer-events-none'
              : 'absolute right-1 bottom-1 px-1.5 h-5 rounded text-[10px] font-medium bg-gray-700/70 text-white pointer-events-none';
            type.textContent = selected ? 'Color' : 'B/W';
          }
        }
      };
      const unsub = useUploadStore.subscribe(() => refresh());
      refresh();
      (container as any)._unsub = unsub;
    })();
    return () => {
      const c = containerRef.current as any;
      if (c && c._unsub) c._unsub();
      cancelled = true;
    };
  }, [open, pdfjs, fileUrl, pageCount]);

  const colorCount = useMemo(() => assignmentColorPages.length, [assignmentColorPages]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[90vw]">
        <DialogHeader>
          <DialogTitle>Select color pages</DialogTitle>
          <DialogDescription>Click pages to toggle color. You can change this later.</DialogDescription>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">Color: {colorText || 'None'}</span>
            <span className="px-2 py-0.5 rounded bg-gray-50 text-gray-700 border">B/W: {bwText || 'None'}</span>
          </div>
        </DialogHeader>
        <div className="grid grid-cols-4 gap-3 max-h-[70vh] overflow-auto" ref={containerRef} />
        <DialogFooter>
          <div className="mr-auto text-xs text-gray-600">{colorCount} page(s) selected</div>
          <button type="button" className="h-9 px-3 rounded-md border" onClick={clearAssignmentSelection}>Clear</button>
          <button
            type="button"
            className="h-9 px-3 rounded-md bg-blue-600 text-white"
            onClick={() => { setAssignmentConfirmed(true); onOpenChange(false); }}
          >
            Done
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


