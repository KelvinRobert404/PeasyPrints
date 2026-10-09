'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { AnnouncementCarousel } from '@/components/AnnouncementCarousel';
import { useCampusSession } from '@/hooks/useCampusSession';
import { useAuthStore } from '@/lib/stores/authStore';
import { useOrdersStore } from '@/lib/stores/ordersStore';
import { useShopsStore } from '@/lib/stores/shopsStore';
import { useCollegeStore } from '@/lib/stores/collegeStore';
import { useDockSlot } from '@/lib/stores/dockStore';
import { Chip, IconTile, ListRow, SectionHeader, ServiceTile, SmallTile, swButton } from '@/components/swoop/primitives';
import {
  GirlsSpaceIcon,
  HelpIcon,
  HousingIcon,
  InfoIcon,
  MarketIcon,
  SearchIcon,
  ShieldCheckIcon,
  StoreIcon,
  UploadIcon,
  type IconProps
} from '@/components/swoop/icons';
import { OrderCard } from '@/components/orders/OrderCard';
import { orderStatusMeta, toDate } from '@/components/orders/orderStatus';
import { ShopCard } from '@/components/shops/ShopCard';

/** A ready order older than this is treated as stale and doesn't take over the dock. */
const PICKUP_SLOT_MAX_AGE_MS = 48 * 60 * 60 * 1000;
const HOME_SHOP_LIMIT = 4;

/** Printer illustration for the Print tile (from the approved Home mockup). */
function PrinterArt() {
  return (
    <svg viewBox="0 0 120 110" width="62" height="57" aria-hidden="true" className="block translate-x-[10px] translate-y-[14px]">
      <rect x="30" y="6" width="60" height="36" rx="4" fill="#FFFFFF" />
      <rect x="40" y="16" width="34" height="4" rx="2" fill="var(--royal-tint)" />
      <rect x="40" y="25" width="24" height="4" rx="2" fill="var(--royal-tint)" />
      <rect x="8" y="36" width="104" height="46" rx="14" fill="var(--cream)" />
      <circle cx="96" cy="50" r="4.5" fill="var(--go)" />
      <rect x="22" y="62" width="76" height="8" rx="4" fill="var(--ink)" />
      <rect x="32" y="66" width="56" height="42" rx="3" fill="#FFFFFF" />
      <rect x="40" y="78" width="40" height="4" rx="2" fill="var(--royal)" />
      <rect x="40" y="87" width="28" height="4" rx="2" fill="var(--royal)" />
    </svg>
  );
}

type Tile = { label: string; href: string; icon: ComponentType<IconProps>; tone: 'ink' | 'royal' | 'market' | 'girls' };

export default function HomePage() {
  const { session, loading } = useCampusSession();
  const { user } = useAuthStore();
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();
  const { orders, subscribeByUser } = useOrdersStore();
  const { shops, subscribe: subscribeShops, loading: shopsLoading } = useShopsStore();
  const { selectedCollege, colleges } = useCollegeStore();
  const [openOnly, setOpenOnly] = useState(false);

  const userId = (isClerkLoaded && clerkUser?.id) || user?.uid || '';

  useEffect(() => {
    const unsub = subscribeShops();
    return () => unsub();
  }, [subscribeShops]);

  useEffect(() => {
    if (!userId) return;
    const unsub = subscribeByUser(userId);
    return () => unsub();
  }, [userId, subscribeByUser]);

  const myOrders = useMemo(() => (userId ? orders : []), [userId, orders]);
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

  // Shops on the selected campus (all shops when the campus isn't known), open first.
  const campusShops = useMemo(() => {
    const college = colleges.find((c) => c.name === selectedCollege);
    const list = college ? shops.filter((s) => s.collegeId === college.id) : shops;
    return [...list].sort((a, b) => Number(Boolean(b.isOpen)) - Number(Boolean(a.isOpen)));
  }, [shops, colleges, selectedCollege]);
  const visibleShops = (openOnly ? campusShops.filter((s) => s.isOpen) : campusShops).slice(0, HOME_SHOP_LIMIT);

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
              title="Unlock campus products"
              subtitle="Verify your KJU student account"
            />
          )}
          {lastOrder && <OrderCard order={lastOrder} divider={false} />}
        </section>
      )}

      {/* Suggestions */}
      <section className="flex flex-col gap-2 px-3 pt-3.5">
        <SectionHeader title="Suggestions" />
        <div className="grid grid-cols-2 gap-1.5">
          <ServiceTile title="Print" subtitle="by PeasyPrints" href="/upload" tone="royal" art={<PrinterArt />} />
          <ServiceTile
            title="Marketplace"
            subtitle="Buy & sell on campus"
            href="/marketplace"
            art={<MarketIcon size={34} className="text-market" />}
          />
        </div>
        <div className="grid grid-cols-4 gap-1.5 pt-0.5">
          {smallTiles.map((t) => (
            <SmallTile key={t.href} label={t.label} href={t.href} icon={t.icon} tone={t.tone} />
          ))}
        </div>
      </section>

      {/* Announcements */}
      <section className="flex flex-col gap-2 pt-3.5">
        <SectionHeader title="Announcements" className="px-3" />
        <AnnouncementCarousel />
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
              <ShopCard key={shop.id} shop={shop} href={`/shops/${shop.id}`} divider={i < visibleShops.length - 1} />
            ))}
            {openOnly && visibleShops.length === 0 && campusShops.length > 0 && (
              <p className="py-3 text-[11.5px] text-slate">No shops are open right now.</p>
            )}
          </div>
        </section>
      )}

      {/* Quiet footer links */}
      <nav aria-label="About Swoop" className="flex items-center justify-center gap-3 px-3 pt-5 text-[11.5px] font-semibold text-slate">
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
