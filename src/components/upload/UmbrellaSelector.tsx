'use client';

import { useUploadStore } from '@/lib/stores/uploadStore';
import { cn } from '@/lib/utils/cn';

const options: Array<{ key: 'PDF' | 'Assignment'; label: string }> = [
  { key: 'PDF', label: 'PDF/Images' },
  { key: 'Assignment', label: 'Assignments' },
];

export function UmbrellaSelector() {
  const { jobType, setJobType } = useUploadStore();
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => setJobType(o.key)}
          className={cn(
            'h-9 rounded-full border px-3 text-sm',
            jobType === o.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-900'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}


