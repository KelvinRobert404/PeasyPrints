'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useUploadStore } from '@/lib/stores/uploadStore';
import { DocIcon, UploadIcon } from '@/components/swoop/icons';
import { PdfPreviewer } from '@/components/upload/PdfPreviewer';
import { usePosthog } from '@/hooks/usePosthog';
import { cn } from '@/lib/utils/cn';

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

  return (
    <div
      {...getRootProps()}
      className={cn(
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
}
