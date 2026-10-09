/** Display-only helpers for customer order states. No business logic lives here. */

export type OrderStatusMeta = {
  label: string;
  /** Ready to collect: green dot / go tone. */
  ready: boolean;
  /** Still with the shop (pending → printing → ready). */
  active: boolean;
};

const META: Record<string, OrderStatusMeta> = {
  pending: { label: 'Sent to shop', ready: false, active: true },
  processing: { label: 'Processing', ready: false, active: true },
  printing: { label: 'Printing', ready: false, active: true },
  printed: { label: 'Ready to collect', ready: true, active: true },
  printed_ready: { label: 'Ready to collect', ready: true, active: true },
  ready: { label: 'Ready to collect', ready: true, active: true },
  collected: { label: 'Collected', ready: false, active: false },
  completed: { label: 'Completed', ready: false, active: false },
  cancelled: { label: 'Cancelled', ready: false, active: false }
};

export function orderStatusMeta(status?: string): OrderStatusMeta {
  const key = String(status ?? '').toLowerCase();
  if (META[key]) return META[key];
  const label = key.replace(/_/g, ' ');
  return { label: label ? label.charAt(0).toUpperCase() + label.slice(1) : 'Unknown', ready: false, active: false };
}

export function toDate(ts: unknown): Date | null {
  try {
    const t = ts as { toDate?: () => Date } | string | number | Date | null | undefined;
    if (t == null || t === '') return null;
    const d = typeof t === 'object' && 'toDate' in t && typeof t.toDate === 'function' ? t.toDate() : new Date(t as string | number | Date);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function formatOrderDate(ts: unknown): string {
  const d = toDate(ts);
  return d ? d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }) : '';
}

export function formatOrderTime(ts: unknown): string {
  const d = toDate(ts);
  return d ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
}
