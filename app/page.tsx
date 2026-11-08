'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { AnnouncementCarousel } from '@/components/AnnouncementCarousel';
import { UtilityRow } from '@/components/home/UtilityRow';
import { useCampusSession } from '@/hooks/useCampusSession';
import { useCurrentCampus } from '@/hooks/useCurrentCampus';
import { useAuthStore } from '@/lib/stores/authStore';
import { useOrdersStore } from '@/lib/stores/ordersStore';
import { useShopsStore } from '@/lib/stores/shopsStore';
import { useDockSlot } from '@/lib/stores/dockStore';
import { FIXTURE_SHOPS } from '@/lib/campus/fixtures/shops';
import { isFixtureMode } from '@/lib/firebase/fixtureMode';
import { isDemoMode } from '@/lib/demo/mode';
import { homeSeasonalSlot } from '@/lib/campus/season';
import { useSeasonNow } from '@/lib/demo/season';
import { Chip, IconTile, ListRow, SectionHeader, ServiceTile, SmallTile, swButton } from '@/components/swoop/primitives';
import {
  GirlsSpaceIcon,
  HelpIcon,
  HousingIcon,
  InfoIcon,
  SearchIcon,
  ShieldCheckIcon,
  StoreIcon,
  UploadIcon,
  type IconProps
} from '@/components/swoop/icons';
import { MarketArt, PrinterArt } from '@/components/swoop/illustrations';
import { OrderCard } from '@/components/orders/OrderCard';
import { orderStatusMeta, toDate } from '@/components/orders/orderStatus';
import { ShopCard } from '@/components/shops/ShopCard';

/** A ready order older than this is treated as stale and doesn't take over the dock. */
const PICKUP_SLOT_MAX_AGE_MS = 48 * 60 * 60 * 1000;
const HOME_SHOP_LIMIT = 4;

type Tile = { label: string; href: string; icon: ComponentType<IconProps>; tone: 'ink' | 'royal' | 'market' | 'girls' };

/** First word of a name, or null when there is none. */
function firstName(name: string | null | undefined): string | null {
  const word = name?.trim().split(/\s+/)[0];
  return word ? word : null;
}

export default function HomePage() {
  const { session, loading } = useCampusSession();
  const campus = useCurrentCampus();
  const { user } = useAuthStore();
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();
  const { orders, subscribeByUser } = useOrdersStore();
  const { shops: liveShops, subscribe: subscribeShops, loading: liveShopsLoading } = useShopsStore();
  const [openOnly, setOpenOnly] = useState(false);

  // Fixture mode has no client Firestore: skip the live subscriptions.
  // The demo's Firestore stand-in serves the visitor's sample orders, so the
  // demo reads orders like production (shops stay on FIXTURE_SHOPS).
  const fixtures = isFixtureMode();
  const readOrders = !fixtures || isDemoMode();
  const shops = useMemo(() => (fixtures ? [...FIXTURE_SHOPS] : liveShops), [fixtures, liveShops]);
  const shopsLoading = fixtures ? false : liveShopsLoading;

  const userId = (isClerkLoaded && clerkUser?.id) || user?.uid || '';

  useEffect(() => {
    if (fixtures) return;
    const unsub = subscribeShops();
    return () => unsub();
  }, [fixtures, subscribeShops]);

  useEffect(() => {
    if (!readOrders || !userId) return;
    const unsub = subscribeByUser(userId);
    return () => unsub();
  }, [readOrders, userId, subscribeByUser]);

  const myOrders = useMemo(() => (userId && readOrders ? orders : []), [userId, readOrders, orders]);
  const lastOrder = myOrders[0];

  // Newest order that's ready to collect (orders are sorted newest first).
  const readyOrder = useMemo(() => {
    const now = Date.now();
    return myOrders.find((o) => {
      if (!o.id || !orderStatusMeta(o.status).ready) return false;
      const placed = toDate(o.timestamp)?.getTime();
      return placed === undefined || now - placed < PICKUP_SLOT_MAX_AGE_MS;
    });
  }, [myOrders]);

  useDockSlot(
    readyOrder
      ? {
          id: 'pickup',
          title: 'Print ready for pickup',
          subtitle: `Collect it at ${readyOrder.shopName}`,
          tone: 'go',
          icon: 'check',
          action: { label: 'View', href: `/orders/${readyOrder.id}/pickup` }
        }
      : null
  );

  // The season's card leads the carousel (exams, moving out, room set-up, next sem).
  // Real now, or the demo date in demo mode.
  const seasonNow = useSeasonNow();
  const seasonal = useMemo(() => homeSeasonalSlot(seasonNow), [seasonNow]);

  // Shops on the student's campus (all shops when the campus isn't known), open first.
  // shop.collegeId holds a catalog campus id.
  const campusId = campus?.campusId ?? null;
  const campusShops = useMemo(() => {
    const list = campusId ? shops.filter((s) => s.collegeId === campusId) : shops;
    return [...list].sort((a, b) => Number(Boolean(b.isOpen)) - Number(Boolean(a.isOpen)));
  }, [shops, campusId]);
  const visibleShops = (openOnly ? campusShops.filter((s) => s.isOpen) : campusShops).slice(0, HOME_SHOP_LIMIT);

  const name =
    firstName(session.membership?.displayName) ??
    (isClerkLoaded ? firstName(clerkUser?.firstName) ?? firstName(clerkUser?.fullName) : null);
  const greetingPending = !name && (loading || !isClerkLoaded);

  const code = campus?.code ?? session.membership?.collegeCode ?? null;
  const showVerify = !loading && session.signedIn && !session.verifiedStudent;
  const hasRecent = showVerify || Boolean(lastOrder);

  const smallTiles: Tile[] = [
    { label: 'Housing', href: '/housing', icon: HousingIcon, tone: 'royal' },
    !loading && session.girlsSpaceApproved
      ? { label: 'Girls’ space', href: '/girls-space', icon: GirlsSpaceIcon, tone: 'girls' }
      : { label: 'Shops', href: '/shops', icon: StoreIcon, tone: 'ink' },
    !loading && session.girlsSpaceApproved
      ? { label: 'Shops', href: '/shops', icon: StoreIcon, tone: 'ink' }
      : { label: 'About', href: '/about', icon: InfoIcon, tone: 'ink' },
    { label: 'Help', href: '/contact', icon: HelpIcon, tone: 'ink' }
  ];

  return (
    <div className="flex flex-1 flex-col bg-white pb-3">
      {/* Greeting */}
      <h1
        className={`font-heading truncate px-3 pt-2 text-[20px] leading-[1.15] text-ink ${greetingPending ? 'invisible' : ''}`}
        aria-hidden={greetingPending || undefined}
      >
        {name ? `Hey ${name}` : 'Hey there'}
      </h1>

      {/* Search → marketplace (there is no global search yet) + Upload */}
      <div className="px-3 pt-1.5">
        <div className="flex h-[42px] items-center gap-2 rounded-full bg-surface pl-[13px] pr-[5px]">
          <Link href="/marketplace" className="flex min-w-0 flex-1 items-center gap-2 self-stretch">
            <SearchIcon size={16} className="shrink-0 text-ink" />
            <span className="font-heading truncate text-[15.5px] text-ink">What do you need?</span>
            <span className="sr-only">Browse the marketplace</span>
          </Link>
          <Link href="/upload" className={swButton({ variant: 'white', size: 'pill', className: 'shrink-0' })}>
            <UploadIcon size={15} />
            Upload
          </Link>
        </div>
      </div>

      {/* Recent */}
      {hasRecent && (
        <section className="flex flex-col px-3 pt-1" aria-label="Recent">
          {showVerify && (
            <ListRow
              href="/campus/verify"
              divider={Boolean(lastOrder)}
              leading={<IconTile icon={ShieldCheckIcon} tone="royal" size={32} />}
              title={code ? `Verify you're a ${code} student` : "Verify you're a student"}
              subtitle="Unlock deals, housing and more"
            />
          )}
          {lastOrder && <OrderCard order={lastOrder} divider={false} />}
        </section>
      )}

      {/* Suggestions */}
      <section className="flex flex-col gap-2 px-3 pt-3.5">
        <SectionHeader title="Suggestions" />
        <div className="grid grid-cols-2 gap-1.5">
          <ServiceTile
            title="Print"
            subtitle="Upload, pick up nearby"
            href="/upload"
            tone="royal"
            art={<PrinterArt width={62} height={57} className="block translate-x-[10px] translate-y-[14px]" />}
          />
          <ServiceTile
            title="Marketplace"
            subtitle="Buy and sell on campus"
            href="/marketplace"
            art={<MarketArt width={62} height={57} className="block translate-x-[8px] translate-y-[10px]" />}
          />
        </div>
        <UtilityRow className="pt-0.5" />
        <div className="grid grid-cols-4 gap-1.5 pt-0.5">
          {smallTiles.map((t) => (
            <SmallTile key={t.href} label={t.label} href={t.href} icon={t.icon} tone={t.tone} />
          ))}
        </div>
      </section>

      {/* Seasonal card, then promos */}
      <section className="flex flex-col pt-3.5" aria-label="What's on">
        <AnnouncementCarousel seasonal={seasonal} />
      </section>

      {/* Print shops near you */}
      {(shopsLoading || campusShops.length > 0) && (
        <section className="flex flex-col gap-2 pt-3.5">
          <SectionHeader title="Print shops near you" action={{ label: 'See all', href: '/shops' }} className="px-3" />
          {campusShops.length > 0 && (
            <div className="flex gap-1.5 px-3">
              <Chip selected={!openOnly} onClick={() => setOpenOnly(false)}>
                All
              </Chip>
              <Chip selected={openOnly} onClick={() => setOpenOnly(true)}>
                Open now
              </Chip>
            </div>
          )}
          <div className="flex flex-col px-3">
            {shopsLoading && campusShops.length === 0 &&
              [0, 1].map((i) => (
                <div key={i} className="flex items-center gap-2.5 py-1.5" aria-hidden>
                  <span className="h-11 w-11 shrink-0 animate-pulse rounded-[10px] bg-surface" />
                  <span className="h-8 flex-1 animate-pulse rounded-[8px] bg-surface" />
                </div>
              ))}
            {visibleShops.map((shop, i) => (
              // Home shows no photos: the shop thumb falls back to its icon tile.
              <ShopCard
                key={shop.id}
                shop={{ ...shop, logoUrl: undefined }}
                href={`/shops/${shop.id}`}
                divider={i < visibleShops.length - 1}
              />
            ))}
            {openOnly && visibleShops.length === 0 && campusShops.length > 0 && (
              <p className="py-3 text-[11.5px] text-slate">No shops are open right now.</p>
            )}
          </div>
        </section>
      )}

      {/* Trust line and quiet footer links */}
      <p className="flex items-center justify-center gap-1 px-3 pt-5 text-[11.5px] font-semibold text-slate">
        <ShieldCheckIcon size={13} className="shrink-0 text-royal" />
        {code ? `Only verified ${code} students` : 'Only verified students'}
      </p>
      <nav aria-label="About Swoop" className="flex items-center justify-center gap-3 px-3 pt-1 text-[11.5px] font-semibold text-slate">
        <Link href="/about" className="flex min-h-6 items-center hover:text-ink">
          About us
        </Link>
        <span aria-hidden className="text-text-muted">
          •
        </span>
        <Link href="/contact" className="flex min-h-6 items-center hover:text-ink">
          Contact us
        </Link>
      </nav>
    </div>
  );
}
