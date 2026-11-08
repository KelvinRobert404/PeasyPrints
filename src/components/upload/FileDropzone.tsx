'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useUploadStore } from '@/lib/stores/uploadStore';
import { DocIcon, UploadIcon } from '@/components/swoop/icons';
import { PdfPreviewer } from '@/components/upload/PdfPreviewer';
import { usePosthog } from '@/hooks/usePosthog';
import { cn } from '@/lib/utils/cn';
import { swButton } from '@/components/swoop/primitives';
import { isDemoMode } from '@/lib/demo/mode';

/** Demo only: offer a sample PDF under the drop area. */
const OFFER_SAMPLE_PDF = isDemoMode();

/** Builds the demo's sample notes and hands them to the same handler as a dropped file. */
function SamplePdfButton({ onPick }: { onPick: (files: File[]) => Promise<void> }) {
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle');

  async function pick() {
    setState('busy');
    try {
      const { makeSamplePdf } = await import('@/lib/demo/samplePdf');
      await onPick([await makeSamplePdf()]);
      setState('idle');
    } catch {
      setState('error');
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={pick}
        disabled={state === 'busy'}
        className={cn(swButton({ variant: 'surface', size: 'sm' }), 'w-full')}
      >
        <DocIcon size={14} />
        {state === 'busy' ? 'Making the sample…' : 'Try a sample PDF'}
      </button>
      {state === 'error' && (
        <p role="alert" className="text-center text-[11px] text-market">
          Could not make the sample. Try again.
        </p>
      )}
    </>
  );
}

export function FileDropzone() {
  const { setFile, file } = useUploadStore();
  const { capture } = usePosthog();

  const onDrop = useCallback(async (accepted: File[]) => {
    const pdf = accepted[0];
    if (pdf) {
      await setFile(pdf);
      capture('upload_selected', {
        totalPages: useUploadStore.getState().pageCount,
        printSettings: useUploadStore.getState().settings,
      });
    }
  }, [setFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: { 'application/pdf': ['.pdf'] }
  });

  const dropArea = (
    <div
      {...getRootProps()}
      className={cn(
        OFFER_SAMPLE_PDF && !file && 'flex flex-1 flex-col justify-center',
        'cursor-pointer select-none rounded-[14px] text-center outline-none focus-visible:ring-2 focus-visible:ring-royal/40',
        file ? 'bg-surface p-1.5' : 'border-[1.5px] border-dashed px-3 py-5',
        !file && (isDragActive ? 'border-royal bg-royal-tint' : 'border-line bg-surface')
      )}
    >
      <input {...getInputProps()} />
      {file ? (
        <div className="overflow-hidden rounded-[12px] border border-line bg-white">
          <div className="h-64 overflow-auto p-2">
            <PdfPreviewer />
          </div>
          <div className="flex items-center gap-2 border-t border-line px-2.5 py-2 text-left">
            <DocIcon size={18} className="shrink-0 text-royal" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-bold text-ink">{file.name}</p>
              <p className="text-[11px] text-slate">Tap to replace</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-1">
          <UploadIcon size={24} className={isDragActive ? 'text-royal' : 'text-ink'} />
          <p className="mt-0.5 text-[12.5px] font-bold text-ink">{isDragActive ? 'Drop the PDF here' : 'Select a PDF'}</p>
          <p className="text-[11px] text-slate">Tap to add or drag and drop</p>
        </div>
      )}
    </div>
  );

  if (!OFFER_SAMPLE_PDF) return dropArea;
  return (
    <div className="flex flex-col gap-1.5">
      {dropArea}
      {!file && <SamplePdfButton onPick={onDrop} />}
    </div>
  );
}
