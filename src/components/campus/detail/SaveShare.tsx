'use client';

import { useEffect, useRef, useState } from 'react';
import { BookmarkIcon, ShareIcon, type IconProps } from '@/components/swoop/icons';
import { IconButton } from '@/components/swoop/primitives';
import { cn } from '@/lib/utils/cn';

type Props = {
  contentType: 'marketplace' | 'housing';
  contentId: string;
  /** Used as the share sheet title. */
  title: string;
  /** Starting saved state, from the listing's isSaved. */
  saved?: boolean;
  onSavedChange?: (saved: boolean) => void;
  /** Link to share. Defaults to the current page. */
  shareUrl?: string;
  className?: string;
};

const SavedIcon = (props: IconProps) => <BookmarkIcon filled {...props} />;

/** Share and save icon buttons for a listing header. Save goes to POST /api/campus/actions. */
export function SaveShare({ contentType, contentId, title, saved = false, onSavedChange, shareUrl, className }: Props) {
  const [isSaved, setIsSaved] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setIsSaved(saved), [saved]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const flash = (text: string) => {
    setNotice(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(''), 2500);
  };

  const toggleSave = async () => {
    if (busy) return;
    const next = !isSaved;
    setIsSaved(next);
    onSavedChange?.(next);
    setBusy(true);
    try {
      const response = await fetch('/api/campus/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: next ? 'save' : 'unsave', contentType, contentId }),
      });
      if (!response.ok) throw new Error('save failed');
      flash(next ? 'Saved' : 'Removed from saved');
    } catch {
      setIsSaved(!next);
      onSavedChange?.(!next);
      flash('Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    const url = shareUrl ?? window.location.href;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        flash('Link copied');
      }
    } catch (cause) {
      if ((cause as Error).name !== 'AbortError') flash('Could not share this post');
    }
  };

  return (
    <div className={cn('relative flex shrink-0 items-center gap-1.5', className)}>
      <IconButton label="Share post" icon={ShareIcon} onClick={() => void share()} />
      <IconButton
        label={isSaved ? 'Remove from saved' : 'Save post'}
        icon={isSaved ? SavedIcon : BookmarkIcon}
        onClick={() => void toggleSave()}
        className={isSaved ? 'text-royal' : undefined}
      />
      <span
        role="status"
        className={cn(
          'pointer-events-none absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-full bg-ink px-2 py-0.5 text-[10.5px] font-bold text-white transition-opacity',
          notice ? 'opacity-100' : 'opacity-0',
        )}
      >
        {notice}
      </span>
    </div>
  );
}
