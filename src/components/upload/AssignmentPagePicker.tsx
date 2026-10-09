'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useUploadStore } from '@/lib/stores/uploadStore';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { swButton } from '@/components/swoop/primitives';

// Thumbnails are built imperatively; these are their Swoop classes.
const OVERLAY_ON = 'absolute inset-0 rounded-[12px] ring-2 ring-inset ring-royal pointer-events-none';
const OVERLAY_OFF = 'absolute inset-0 pointer-events-none';
const TYPE_ON = 'absolute right-1 bottom-1 inline-flex h-5 items-center rounded-full bg-royal px-1.5 text-[10px] font-bold text-white pointer-events-none';
const TYPE_OFF = 'absolute right-1 bottom-1 inline-flex h-5 items-center rounded-full bg-ink/70 px-1.5 text-[10px] font-bold text-white pointer-events-none';

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
        wrapper.className = 'relative overflow-hidden rounded-[12px] border border-line bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-royal/40';
        wrapper.setAttribute('aria-label', `Page ${i}`);
        wrapper.onclick = () => toggleAssignmentColorPage(i);

        const img = document.createElement('img');
        img.src = canvas.toDataURL('image/png');
        img.alt = '';
        img.className = 'block w-full h-auto pointer-events-none';
        wrapper.appendChild(img);

        const badge = document.createElement('div');
        badge.className = 'absolute left-1 top-1 inline-flex h-5 items-center justify-center rounded-full bg-ink/85 px-1.5 text-[10px] font-bold text-white tabular-nums';
        badge.textContent = String(i);
        wrapper.appendChild(badge);

        const overlay = document.createElement('div');
        const selected = assignmentColorPages.includes(i);
        overlay.className = selected ? OVERLAY_ON : OVERLAY_OFF;
        wrapper.setAttribute('aria-pressed', String(selected));
        overlay.setAttribute('data-overlay', '');
        wrapper.appendChild(overlay);

        const typeBadge = document.createElement('div');
        typeBadge.className = selected ? TYPE_ON : TYPE_OFF;
        typeBadge.setAttribute('data-type', '');
        typeBadge.textContent = selected ? 'Colour' : 'B&W';
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
          if (overlay) overlay.className = selected ? OVERLAY_ON : OVERLAY_OFF;
          child.setAttribute('aria-pressed', String(selected));
          const type = child.querySelector('[data-type]') as HTMLDivElement | null;
          if (type) {
            type.className = selected ? TYPE_ON : TYPE_OFF;
            type.textContent = selected ? 'Colour' : 'B&W';
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
      <DialogContent className="w-[92vw] max-w-4xl rounded-[14px] p-3.5">
        <DialogHeader className="mb-2.5">
          <DialogTitle className="font-heading text-[16px] text-ink">Pick colour pages</DialogTitle>
          <DialogDescription className="mt-0.5 text-[11.5px] text-slate">Tap a page to switch it between colour and B&W. You can change this later.</DialogDescription>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-royal-tint px-2 py-0.5 text-[11px] font-bold text-royal tabular-nums">Colour: {colorText || 'None'}</span>
            <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-bold text-ink tabular-nums">B&W: {bwText || 'None'}</span>
          </div>
        </DialogHeader>
        <div className="grid max-h-[70vh] grid-cols-3 gap-2 overflow-auto sm:grid-cols-4" ref={containerRef} />
        <DialogFooter className="mt-3 items-center gap-1.5">
          <div className="mr-auto text-[11px] font-semibold text-slate tabular-nums">{colorCount} page{colorCount === 1 ? '' : 's'} in colour</div>
          <button type="button" className={swButton({ variant: 'surface', size: 'sm' })} onClick={clearAssignmentSelection}>Clear</button>
          <button
            type="button"
            className={swButton({ variant: 'primary', size: 'sm' })}
            onClick={() => { setAssignmentConfirmed(true); onOpenChange(false); }}
          >
            Done
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


