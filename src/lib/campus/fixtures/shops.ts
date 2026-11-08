// Print shops for fixture mode (KADA-18). Client safe: no firebase-admin, so client
// pages (app/page.tsx, app/upload/page.tsx) and the server fixtures share one list.
// Node tests import it directly, so '@/...' is type-only.
import type { Shop, ShopPricing } from '@/types/models';

/* Print shops (shops/{id}). collegeId holds a catalog campus id. */

const STANDARD_PRICING: ShopPricing = {
  a4: { singleBW: 2, doubleBW: 3, singleColor: 10, doubleColor: 18 },
  a3: { singleBW: 5, doubleBW: 8, singleColor: 25, doubleColor: 45 },
  services: { softBinding: 30, spiralBinding: 40, hardBinding: 120, emergency: 20, afterDark: 15 },
};

export const FIXTURE_SHOPS: readonly Shop[] = [
  {
    id: 'shop-main-block',
    name: 'Main Block Prints',
    address: 'Ground floor, Main Block',
    timing: '8:30 am to 6 pm',
    openingTime: '08:30',
    closingTime: '18:00',
    isOpen: true,
    collegeId: 'kju-main',
    pricing: STANDARD_PRICING,
  },
  {
    id: 'shop-gulabi-road',
    name: 'Gulabi Road Xerox',
    address: 'Gulabi Road, near Royal Mart',
    timing: '9 am to 9 pm',
    openingTime: '09:00',
    closingTime: '21:00',
    isOpen: true,
    collegeId: 'kju-main',
    pricing: {
      ...STANDARD_PRICING,
      a4: { singleBW: 1.5, doubleBW: 2.5, singleColor: 8, doubleColor: 15 },
    },
  },
  {
    id: 'shop-airport-a1',
    name: 'A1 Print Desk',
    address: 'Next to A1 auditorium',
    timing: '9 am to 5 pm',
    openingTime: '09:00',
    closingTime: '17:00',
    isOpen: false,
    collegeId: 'kju-airport-road',
    pricing: STANDARD_PRICING,
  },
  {
    id: 'shop-airport-gate',
    name: 'Gate Two Prints',
    address: 'Opposite gate 2, Airport Road campus',
    timing: '8 am to 8 pm',
    openingTime: '08:00',
    closingTime: '20:00',
    isOpen: true,
    collegeId: 'kju-airport-road',
    pricing: STANDARD_PRICING,
  },
];
