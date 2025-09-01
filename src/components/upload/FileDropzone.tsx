'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useUploadStore } from '@/lib/stores/uploadStore';
import { FileText, Plus } from 'lucide-react';
import { PdfPreviewer } from '@/components/upload/PdfPreviewer';
import { usePosthog } from '@/hooks/usePosthog';

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
      className="rounded-2xl bg-gray-100 p-4 text-center text-sm cursor-pointer select-none"
    >
      <input {...getInputProps()} />
      {file ? (
        <div className="overflow-hidden rounded-xl border bg-white">
          <div className="h-64 overflow-auto">
            <PdfPreviewer />
          </div>
          <div className="px-3 py-2 text-xs text-gray-600 text-left border-t">{file.name}</div>
        </div>
      ) : isDragActive ? (
        <div className="text-gray-600">Drop the PDF here...</div>
      ) : (
        <div className="text-gray-600 flex flex-col items-center justify-center gap-2 py-6">
          <FileText className="w-8 h-8 text-gray-400" />
          <div className="font-medium">Select a PDF</div>
          <div className="text-xs flex items-center gap-1"><Plus className="w-3 h-3" /> Tap to add or drag & drop</div>
        </div>
      )}
    </div>
  );
}
