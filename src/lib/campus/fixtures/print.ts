// Print orders (orders/{id}) and user profiles (users/{uid}) for the demo (KADA-19).
// Same shapes as the live app: OrderDoc in src/types/models.ts, read by
// src/lib/stores/ordersStore.ts, and the users doc /api/users/upsert writes.
// Server only: it builds Firestore Timestamps. Dates are relative to seed time.
// Node tests import it directly, so '@/...' is type-only and runtime imports are relative.
import type { DocTime } from '@/types/campus';
import type { OrderDoc, PrintSettings } from '@/types/models';
import { FIXTURE_EMAIL_DOMAIN, displayNameOf, fixtureTime, type FixtureDoc } from './core.ts';
import { FIXTURE_SHOPS } from './shops.ts';

/** Stored order. The live create route also writes currency, payment status and updatedAt. */
export type OrderFixtureDoc = Omit<OrderDoc, 'id' | 'timestamp'> & {
  timestamp: DocTime;
  updatedAt: DocTime;
  currency: 'INR';
  paymentStatus: 'paid';
};

/** users/{uid}, as /api/users/upsert writes it. */
export interface UserFixtureDoc {
  username: string;
  email: string | null;
  phoneNumber: string | null;
  createdAt: DocTime;
  updatedAt: DocTime;
}

const COMMISSION = 2;
const HOUR_DAYS = 1 / 24;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Days back to a time `hours` ago that is still today in IST.
 * Near midnight it moves closer to now so a 'today' order never lands yesterday.
 */
function earlierToday(now: Date, hours: number): number {
  const sinceMidnightMs = (now.getTime() + IST_OFFSET_MS) % (24 * 60 * 60 * 1000);
  const sinceMidnightHours = sinceMidnightMs / (60 * 60 * 1000);
  return -Math.min(hours, sinceMidnightHours / 2) * HOUR_DAYS;
}

interface OrderSpec {
  id: string;
  userId: string;
  shopId: string;
  fileName: string;
  pages: number;
  settings: Partial<PrintSettings>;
  status: OrderDoc['status'];
  /** Days since the order was placed (negative number of days from now). */
  placed: number;
  /** Days since the last status change. */
  touched: number;
}

function shopOf(id: string) {
  const shop = FIXTURE_SHOPS.find((item) => item.id === id);
  if (!shop) throw new Error(`Unknown fixture shop: ${id}`);
  return shop;
}

function order(now: Date, spec: OrderSpec): FixtureDoc<OrderFixtureDoc> {
  const shop = shopOf(spec.shopId);
  const printSettings: PrintSettings = {
    paperSize: 'A4',
    printFormat: 'Single-Sided',
    printColor: 'Black & White',
    orientation: 'Vertical',
    binding: '',
    copies: 1,
    emergency: false,
    afterDark: false,
    ...spec.settings,
  };
  const a4 = shop.pricing?.a4;
  const services = shop.pricing?.services;
  const double = printSettings.printFormat === 'Double-Sided';
  const colour = printSettings.printColor === 'Color';
  const basePricePerPage = colour ? (double ? a4?.doubleColor : a4?.singleColor) ?? 10 : (double ? a4?.doubleBW : a4?.singleBW) ?? 2;
  const bindingCost =
    printSettings.binding === 'Spiral Binding'
      ? services?.spiralBinding ?? 0
      : printSettings.binding === 'Soft Binding'
        ? services?.softBinding ?? 0
        : printSettings.binding === 'Hard Binding'
          ? services?.hardBinding ?? 0
          : 0;
  const totalCost = Math.round(basePricePerPage * spec.pages * printSettings.copies + bindingCost + COMMISSION);
  return {
    id: spec.id,
    data: {
      jobType: 'PDF',
      userId: spec.userId,
      shopId: shop.id,
      shopName: shop.name,
      userName: displayNameOf(spec.userId),
      fileName: spec.fileName,
      fileUrl: `/api/orders/${spec.id}/file?variant=original`,
      totalPages: spec.pages,
      totalCost,
      currency: 'INR',
      paymentStatus: 'paid',
      status: spec.status,
      timestamp: fixtureTime(now, spec.placed),
      updatedAt: fixtureTime(now, spec.touched),
      emergency: false,
      afterDark: false,
      printSettings,
      pricingDetails: { basePricePerPage, bindingCost, emergencyCost: 0, afterDarkCost: 0, commission: COMMISSION },
    },
  };
}

/** Sana: one ready today, one printing, two collected. Kabir: one collected. */
export function buildOrders(now: Date): FixtureDoc<OrderFixtureDoc>[] {
  const sana = 'verified-kju-main';
  const kabir = 'verified-kju-airport';
  const readyPlaced = earlierToday(now, 3);
  return [
    order(now, {
      id: 'order-sana-ready',
      userId: sana,
      shopId: 'shop-main-block',
      fileName: 'Cost accounting assignment.pdf',
      pages: 12,
      settings: { binding: 'Spiral Binding' },
      status: 'printed',
      placed: readyPlaced,
      touched: readyPlaced / 3,
    }),
    order(now, {
      id: 'order-sana-printing',
      userId: sana,
      shopId: 'shop-gulabi-road',
      fileName: 'Marketing project slides.pdf',
      pages: 8,
      settings: { printColor: 'Color' },
      status: 'printing',
      placed: -0.75 * HOUR_DAYS,
      touched: -0.25 * HOUR_DAYS,
    }),
    order(now, {
      id: 'order-sana-collected-notes',
      userId: sana,
      shopId: 'shop-main-block',
      fileName: 'Business law notes.pdf',
      pages: 40,
      settings: { printFormat: 'Double-Sided' },
      status: 'collected',
      placed: -3.2,
      touched: -3,
    }),
    order(now, {
      id: 'order-sana-collected-resume',
      userId: sana,
      shopId: 'shop-gulabi-road',
      fileName: 'Resume.pdf',
      pages: 2,
      settings: { copies: 3 },
      status: 'collected',
      placed: -9.1,
      touched: -9,
    }),
    order(now, {
      id: 'order-kabir-collected',
      userId: kabir,
      shopId: 'shop-airport-gate',
      fileName: 'Lab record, sem 5.pdf',
      pages: 24,
      settings: { binding: 'Soft Binding' },
      status: 'collected',
      placed: -5.2,
      touched: -5,
    }),
  ];
}

/* User profiles. The four personas, plus Riya (new-user) who has signed up but not joined a campus. */

function user(now: Date, uid: string, email: string | null, joinedDaysAgo: number): FixtureDoc<UserFixtureDoc> {
  return {
    id: uid,
    data: {
      username: displayNameOf(uid),
      email,
      phoneNumber: null,
      createdAt: fixtureTime(now, -joinedDaysAgo),
      updatedAt: fixtureTime(now, -Math.min(joinedDaysAgo, 1)),
    },
  };
}

export function buildUsers(now: Date): FixtureDoc<UserFixtureDoc>[] {
  const college = (name: string) => `${name}@${FIXTURE_EMAIL_DOMAIN}`;
  return [
    user(now, 'verified-kju-main', college('sana'), 60),
    user(now, 'verified-kju-airport', college('kabir'), 120),
    user(now, 'girls-approved', college('ananya'), 45),
    user(now, 'pending-id-card', 'meera.k@gmail.test', 1),
    user(now, 'new-user', null, 0),
  ];
}
