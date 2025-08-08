'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useUploadStore } from '@/lib/stores/uploadStore';

export function FileDropzone() {
  const { setFile, file } = useUploadStore();

  const onDrop = useCallback(async (accepted: File[]) => {
    const pdf = accepted[0];
    if (pdf) await setFile(pdf);
  }, [setFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: { 'application/pdf': ['.pdf'] }
  });

  return (
    <div
      {...getRootProps()}
      className="border-2 border-dashed rounded-lg p-6 text-center text-sm cursor-pointer select-none"
    >
      <input {...getInputProps()} />
      {file ? (
        <div className="text-gray-700">{file.name}</div>
      ) : isDragActive ? (
        <div className="text-gray-600">Drop the PDF here...</div>
      ) : (
        <div className="text-gray-600">
          <div className="font-medium mb-1">Upload PDF</div>
          <div className="text-xs">Tap to select or drag & drop</div>
        </div>
      )}
    </div>
  );
}
