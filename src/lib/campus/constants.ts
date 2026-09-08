export const PILOT_COLLEGE = {
  id: 'kju',
  code: 'KJU',
  name: 'Kristu Jayanti University',
} as const;

export const AVAILABILITY_DAYS = 7;
export const CONTACT_REQUEST_HOURS = 72;
export const VERIFICATION_DAYS = 365;

export const MARKETPLACE_CATEGORIES = [
  'books_notes',
  'fashion',
  'electronics',
  'hostel_essentials',
  'cycles_transport',
  'miscellaneous',
] as const;

export const MARKETPLACE_CATEGORY_LABELS: Record<(typeof MARKETPLACE_CATEGORIES)[number], string> = {
  books_notes: 'Books & notes',
  fashion: 'Fashion',
  electronics: 'Electronics',
  hostel_essentials: 'Hostel essentials',
  cycles_transport: 'Cycles & transport',
  miscellaneous: 'Miscellaneous',
};

export const DEFAULT_PICKUP_POINTS = [
  { id: 'main-gate', label: 'Main gate' },
  { id: 'library', label: 'Library entrance' },
  { id: 'admin-block', label: 'Admin block' },
  { id: 'cafeteria', label: 'Cafeteria' },
] as const;

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

