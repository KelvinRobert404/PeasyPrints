'use client';

import { useId, useRef, useState, type ChangeEvent } from 'react';
import { CameraIcon, CloseIcon } from '@/components/swoop/icons';
import { cn } from '@/lib/utils/cn';
import type { CampusAudience } from '@/types/campus';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 6 * 1024 * 1024;

type Props = {
  /** Uploaded photo urls ('/api/campus/media/<id>'). Leave undefined to let the field keep its own list. */
  value?: string[];
  defaultValue?: string[];
  onChange?: (urls: string[]) => void;
  /** Most photos a student can add. */
  max?: number;
  audience?: CampusAudience;
  label?: string;
  hint?: string;
  className?: string;
};

async function uploadPhoto(file: File, audience: CampusAudience): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  form.append('audience', audience);
  const response = await fetch('/api/campus/media', { method: 'POST', body: form });
  const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!response.ok || !data.url) throw new Error(data.error || 'Could not upload that photo');
  return data.url;
}

/** Up to `max` student photos, uploaded through POST /api/campus/media. */
export function PhotoField({
  value,
  defaultValue = [],
  onChange,
  max = 5,
  audience = 'campus',
  label = 'Photos',
  hint = 'Your own photos only. JPG, PNG or WEBP.',
  className,
}: Props) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [inner, setInner] = useState<string[]>(defaultValue);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState('');
  const photos = value ?? inner;
  // Keeps the latest list across awaits, so parallel uploads all land.
  const latest = useRef(photos);
  latest.current = photos;

  const commit = (next: string[]) => {
    latest.current = next;
    if (value === undefined) setInner(next);
    onChange?.(next);
  };

  const room = Math.max(0, max - photos.length - uploading);

  const pickFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;
    setError('');

    const usable: File[] = [];
    let problem = '';
    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type)) problem = 'Use a JPG, PNG or WEBP photo.';
      else if (file.size > MAX_BYTES) problem = 'Each photo must be under 6 MB.';
      else usable.push(file);
    }
    if (usable.length > room) problem = `You can add ${max} photos at most.`;
    const batch = usable.slice(0, room);
    if (problem) setError(problem);
    if (!batch.length) return;

    setUploading((count) => count + batch.length);
    await Promise.all(
      batch.map(async (file) => {
        try {
          const url = await uploadPhoto(file, audience);
          commit([...latest.current, url].slice(0, max));
        } catch (cause) {
          setError((cause as Error).message || 'Could not upload that photo');
        } finally {
          setUploading((count) => count - 1);
        }
      }),
    );
  };

  const remove = (url: string) => commit(latest.current.filter((entry) => entry !== url));

  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[11.5px] font-bold text-ink">
          {label}
        </label>
        <span className="text-[11px] font-semibold tabular-nums text-slate">
          {photos.length} of {max}
        </span>
      </div>

      <div className="mt-1 grid grid-cols-4 gap-1.5 sm:grid-cols-5">
        {photos.map((url, index) => (
          <div key={url} className="relative aspect-square overflow-hidden rounded-[12px] bg-surface">
            <img src={url} alt={`Photo ${index + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              aria-label={`Remove photo ${index + 1}`}
              onClick={() => remove(url)}
              className="campus-press absolute right-0.5 top-0.5 grid h-8 w-8 place-items-center rounded-full bg-ink/75 text-white"
            >
              <CloseIcon size={13} />
            </button>
          </div>
        ))}
        {Array.from({ length: uploading }, (_, index) => (
          <div key={`uploading-${index}`} className="grid aspect-square animate-pulse place-items-center rounded-[12px] bg-surface" aria-hidden="true">
            <CameraIcon size={20} className="text-text-muted" />
          </div>
        ))}
        {room > 0 ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="campus-press flex aspect-square flex-col items-center justify-center gap-0.5 rounded-[12px] border border-dashed border-slate/40 bg-surface text-ink"
          >
            <CameraIcon size={20} />
            <span className="text-[11px] font-bold">Add photo</span>
          </button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        multiple={room > 1}
        onChange={(event) => void pickFiles(event)}
        className="sr-only"
        tabIndex={-1}
      />

      <p className="mt-1 text-[11px] text-slate" aria-live="polite">
        {uploading ? `Uploading ${uploading} photo${uploading > 1 ? 's' : ''}…` : hint}
      </p>
      {error ? (
        <p role="alert" className="mt-1 text-[11.5px] font-bold text-market">
          {error}
        </p>
      ) : null}
    </div>
  );
}
