'use client';

import { useMemo, useState } from 'react';
import { useUploadStore } from '@/lib/stores/uploadStore';
import { AssignmentPagePicker } from '@/components/upload/AssignmentPagePicker';
import { Segmented, swButton } from '@/components/swoop/primitives';

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
    <div className="flex flex-col gap-2">
      <p className="text-[12.5px] font-bold text-ink">Colour</p>
      <Segmented
        label="Assignment colour"
        value={assignmentMode}
        onChange={(mode) => (mode === 'BW' ? selectBW() : selectMixed())}
        options={[
          { value: 'BW', label: <span className="normal-case">All black & white</span> },
          { value: 'Mixed', label: <span className="normal-case">B&W + colour pages</span> }
        ]}
      />
      <p className="text-[11px] text-slate">Assignments print single-sided on A4.</p>
      {assignmentMode === 'Mixed' && (
        <div className="rounded-[12px] bg-surface p-2.5">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-bold text-ink">Colour pages</p>
              <p className="text-[11px] text-slate">Pick them from page thumbnails.</p>
            </div>
            <button type="button" className={swButton({ variant: 'ink', size: 'sm' })} onClick={() => setPickerOpen(true)}>
              Pick pages
            </button>
          </div>
          {assignmentConfirmed && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-royal-tint px-2 py-0.5 text-[11px] font-bold text-royal tabular-nums">Colour: {colorText || 'None'}</span>
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-ink tabular-nums">B&W: {bwText || 'None'}</span>
            </div>
          )}
          <p className="mt-2 text-[11px] text-slate">We split the PDF into a B&W and a colour document for the shop.</p>
          <AssignmentPagePicker open={pickerOpen} onOpenChange={setPickerOpen} />
        </div>
      )}
    </div>
  );
}


