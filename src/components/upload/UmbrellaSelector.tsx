'use client';

import { useUploadStore } from '@/lib/stores/uploadStore';
import { Segmented } from '@/components/swoop/primitives';

const options: Array<{ key: 'PDF' | 'Assignment'; label: string }> = [
  { key: 'PDF', label: 'PDF or images' },
  { key: 'Assignment', label: 'Assignment' },
];

export function UmbrellaSelector() {
  const { jobType, setJobType } = useUploadStore();
  return (
    <Segmented
      label="What you're printing"
      value={jobType}
      onChange={(value) => setJobType(value)}
      options={options.map((o) => ({ value: o.key, label: <span className="normal-case">{o.label}</span> }))}
    />
  );
}
