'use client';

import { useMemo, useState } from 'react';
import { useUploadStore } from '@/lib/stores/uploadStore';
import { cn } from '@/lib/utils/cn';
import { AssignmentPagePicker } from '@/components/upload/AssignmentPagePicker';

export function AssignmentConfigurator() {
  const { settings, setSettings, pageCount, assignmentMode, setAssignmentMode, assignmentColorPages, toggleAssignmentColorPage, assignmentConfirmed, setAssignmentConfirmed } = useUploadStore();

  function selectBW() { setAssignmentMode('BW'); setSettings({ printColor: 'Black & White' }); }
  function selectMixed() { setAssignmentMode('Mixed'); setSettings({ printColor: 'Black & White' }); }
  const [pickerOpen, setPickerOpen] = useState(false);

  function formatRanges(nums: number[]): string {
    if (!nums.length) return '';
    const a = [...nums].sort((x, y) => x - y);
    const parts: string[] = [];
    let start = a[0];
    let prev = a[0];
    for (let i = 1; i < a.length; i++) {
      if (a[i] === prev + 1) prev = a[i];
      else { parts.push(start === prev ? String(start) : `${start}-${prev}`); start = prev = a[i]; }
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
          <div className="flex items-center gap-2">
            <button type="button" className="h-9 px-3 rounded-md border text-sm" onClick={() => setPickerOpen(true)}>Open preview picker</button>
            <div className="text-xs text-gray-600">Select pages visually with thumbnails.</div>
          </div>
          {assignmentConfirmed && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">Color: {colorText || 'None'}</span>
              <span className="px-2 py-0.5 rounded bg-gray-50 text-gray-700 border">B/W: {bwText || 'None'}</span>
            </div>
          )}
          <div className="text-xs text-gray-600 mt-2">We will split the PDF into B&W and Color documents.</div>
          <AssignmentPagePicker open={pickerOpen} onOpenChange={setPickerOpen} />
        </div>
      )}
    </div>
  );
}


