// Wanted post card: 'Any cycle available?' with an 'I have this' button.
// No hooks, so it renders on the server too.

import Link from 'next/link';
import { HandIcon } from '@/components/swoop/icons';
import { Tag } from '@/components/swoop/primitives';
import { DistanceLine } from '@/components/campus/places/DistanceLine';
import { MARKET_STATUS_LABELS } from '@/lib/campus/constants';
import { cn } from '@/lib/utils/cn';
import type { MarketListing } from '@/types/market';
import { formatDay, RowIconTile } from './PassRow';
import { budgetText } from './PriceBits';

// Same look as swButton({ size: 'sm' }); primitives is a client module, so its
// cva helper cannot be called while this renders on the server.
const BUTTON =
  'campus-press inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-[9px] px-3 text-[12px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/40 bg-ink text-white hover:bg-ink/90';

export type WantedCardListing = Pick<MarketListing, 'id' | 'status' | 'title' | 'details' | 'place' | 'seller' | 'isOwner'>;

const LEAD_WORDS =
  /^(?:(?:i\s+)?(?:am\s+)?(?:looking|searching)\s+for|(?:i\s+)?need(?:ed)?|(?:i\s+)?want(?:ed)?|wanted:?|anyone\s+(?:selling|has|have)|any|buying)\s+/i;
const ARTICLE = /^(?:an?|some|one)\s+/i;

/**
 * The ask as a question. 'Looking for a used cycle' -> 'Any used cycle available?'.
 * A title that already asks ('Anyone has a drafter?') stays as it is.
 */
export function askQuestion(title: string): string {
  const clean = title.trim().replace(/\s+/g, ' ');
  if (clean === '') return 'Anything available?';
  if (clean.endsWith('?')) return clean;
  let thing = clean.replace(LEAD_WORDS, '').replace(ARTICLE, '').replace(/[.!]+$/, '').replace(/\s+available$/i, '').trim();
  if (thing === '') thing = clean;
  // Lower-case the first letter unless it starts an acronym ('BCom' stays).
  if (!/^[A-Z]{2}/.test(thing) && !/^[A-Z][a-z]*[A-Z]/.test(thing)) thing = thing.charAt(0).toLowerCase() + thing.slice(1);
  return `Any ${thing} available?`;
}

const CLOSED = new Set(['filled', 'expired', 'closed', 'removed', 'sold']);

/** A student's ask. 'I have this' opens the post to reply. */
export function WantedCard({
  listing,
  campusLabel,
  href,
  className,
}: {
  listing: WantedCardListing;
  /** Short campus name for the distance line, e.g. 'KJU'. */
  campusLabel: string;
  /** Where 'I have this' goes. Defaults to /marketplace/{id}. */
  href?: string;
  className?: string;
}) {
  const details = listing.details.kind === 'wanted' ? listing.details : null;
  const closed = CLOSED.has(listing.status);
  const by = details?.neededBy ? `by ${formatDay(details.neededBy)}` : null;
  const meta = [listing.seller.displayName, budgetText(details?.budgetMax ?? null), by].filter(Boolean).join(' · ');
  const target = href ?? `/marketplace/${listing.id}`;

  return (
    <article className={cn('relative flex min-w-0 items-start gap-2.5 rounded-[14px] border border-line bg-white p-2.5', className)}>
      <RowIconTile icon={HandIcon} muted={closed} />
      <div className={cn('min-w-0 flex-1', closed && 'opacity-60')}>
        {/* The question link covers the whole card, so the card is one big target. */}
        <Link
          href={target}
          className="font-heading line-clamp-2 text-[13px] leading-[1.15] text-ink after:absolute after:inset-0 after:rounded-[14px] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-royal/40"
        >
          {askQuestion(listing.title)}
        </Link>
        <p className="mt-0.5 truncate text-[11px] font-semibold text-slate">{meta}</p>
        <DistanceLine meters={listing.place?.roughDistanceM} campusLabel={campusLabel} icon={false} className="mt-0.5 text-[10.5px]" />
      </div>
      {closed ? (
        <Tag className="mt-1 shrink-0">{MARKET_STATUS_LABELS[listing.status]}</Tag>
      ) : listing.isOwner ? null : (
        <Link href={target} className={cn(BUTTON, 'relative z-10 shrink-0')}>
          I have this
        </Link>
      )}
    </article>
  );
}
