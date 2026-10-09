import type { Shop } from '@/types/models';

/** "10", "10:30", "18:00", "10AM", "6:30 pm" → "10 AM", "10:30 AM", "6 PM". Null when unparseable. */
function formatClock(raw?: string): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*([AaPp][Mm])?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] && m[2] !== '00' ? `:${m[2]}` : '';
  const suffix = m[3] ? m[3].toUpperCase() : h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  if (h > 12) h -= 12;
  return `${h}${min} ${suffix}`;
}

/** Display-only opening hours, e.g. "9 AM–6 PM", falling back to the raw timing string. */
export function shopHours(shop: Pick<Shop, 'openingTime' | 'closingTime' | 'timing'>): string | undefined {
  const open = formatClock(shop.openingTime);
  const close = formatClock(shop.closingTime);
  if (open && close) return `${open}–${close}`;
  if (shop.timing) {
    const [a, b] = shop.timing.split(' to ').map((t) => formatClock(t));
    if (a && b) return `${a}–${b}`;
    return shop.timing;
  }
  return undefined;
}

/** Display-only list of what a shop offers, derived from its price table (a price ≤ 0 means unavailable). */
export function shopServices(shop: Pick<Shop, 'pricing'>): string[] {
  const p = shop.pricing;
  if (!p) return [];
  const pos = (...v: (number | undefined)[]) => v.some((x) => Number(x ?? 0) > 0);
  const out: string[] = [];
  if (pos(p.a4?.singleBW, p.a4?.doubleBW, p.a3?.singleBW, p.a3?.doubleBW)) out.push('B/W');
  if (pos(p.a4?.singleColor, p.a4?.doubleColor, p.a3?.singleColor, p.a3?.doubleColor)) out.push('Colour');
  if (pos(p.services?.softBinding, p.services?.spiralBinding, p.services?.hardBinding)) out.push('Binding');
  if (pos(p.services?.emergency)) out.push('Rush');
  return out;
}
