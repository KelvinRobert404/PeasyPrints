'use client';

import { useMemo, useState } from 'react';
import { useUploadStore } from '@/lib/stores/uploadStore';
import { cn } from '@/lib/utils/cn';

export function AssignmentConfigurator() {
  const { settings, setSettings, pageCount, assignmentMode, setAssignmentMode, assignmentColorPages, toggleAssignmentColorPage, assignmentConfirmed, setAssignmentConfirmed } = useUploadStore();

  function selectBW() { setAssignmentMode('BW'); setSettings({ printColor: 'Black & White' }); }
  function selectMixed() { setAssignmentMode('Mixed'); setSettings({ printColor: 'Black & White' }); }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <button
          className={cn('h-12 rounded-xl border text-xs font-semibold', assignmentMode === 'BW' ? 'bg-blue-600 text-white' : 'bg-white text-gray-900')}
          onClick={selectBW}
        >
          Full Black & White
        </button>
        <button
          className={cn('h-12 rounded-xl border text-xs font-semibold', assignmentMode === 'Mixed' ? 'bg-blue-600 text-white' : 'bg-white text-gray-900')}
          onClick={selectMixed}
        >
          B&W + Color (select pages)
        </button>
      </div>
      <div className="text-xs text-gray-600">
        Assignments are A4 only. Double-sided control is hidden; printing is single-sided.
      </div>
      {assignmentMode === 'Mixed' && (
        <div className="rounded-md border p-3 bg-white">
          <div className="text-sm font-medium mb-2">Select color pages</div>
          <div className="grid grid-cols-8 gap-1">
            {Array.from({ length: Math.max(pageCount, 0) }, (_, i) => i + 1).map((p) => {
              const selected = assignmentColorPages.includes(p);
              return (
                <button
                  type="button"
                  key={p}
                  onClick={() => toggleAssignmentColorPage(p)}
                  className={cn('h-8 rounded border flex items-center justify-center text-xs', selected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-800')}
                >
                  <span>{p}</span>
                </button>
              );
            })}
          </div>
          <div className="text-xs text-gray-600 mt-2">Confirm selection before checkout. We will split the PDF into B&W and Color documents.</div>
          <div className="mt-3 flex items-center justify-end">
            <button type="button" onClick={() => setAssignmentConfirmed(true)} className="h-9 px-3 rounded-md bg-blue-600 text-white text-sm">
              Confirm Selection
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


