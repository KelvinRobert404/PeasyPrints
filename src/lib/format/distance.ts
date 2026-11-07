// Distance helpers. Pure leaf module: no imports, safe for node tests.
// Distances read '650 m from KJU, 8 min walk'.

export type LatLng = {
  lat: number;
  lng: number;
};

/** Mean Earth radius in metres. */
const EARTH_RADIUS_M = 6_371_008.8;
/** Walking pace used for walk minutes. */
const WALK_METRES_PER_MINUTE = 80;
/** Shared distances are rounded to this step so a spot cannot be pinned. */
export const PRIVACY_STEP_M = 50;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance between two points, in metres. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Rounds a distance to the nearest 50 m, never below 50 m,
 * so a shared distance cannot pinpoint a room.
 */
export function roundForPrivacy(meters: number): number {
  const m = Number.isFinite(meters) ? Math.max(0, meters) : 0;
  return Math.max(PRIVACY_STEP_M, Math.round(m / PRIVACY_STEP_M) * PRIVACY_STEP_M);
}

/** '650 m' (to the nearest 10 m) under 1 km, else '1.2 km' (no trailing '.0'). */
export function formatDistance(meters: number): string {
  const m = Number.isFinite(meters) ? Math.max(0, meters) : 0;
  let tens = Math.round(m / 10) * 10;
  if (m > 0 && tens === 0) tens = 10;
  if (tens < 1000) return `${tens} m`;
  return `${Math.round(m / 100) / 10} km`;
}

/** Walking minutes at 80 m a minute, at least 1. */
export function walkMinutes(meters: number): number {
  const m = Number.isFinite(meters) ? Math.max(0, meters) : 0;
  return Math.max(1, Math.round(m / WALK_METRES_PER_MINUTE));
}

/** formatFromCampus(650, 'KJU') -> '650 m from KJU, 8 min walk'. */
export function formatFromCampus(meters: number, campusLabel: string): string {
  return `${formatDistance(meters)} from ${campusLabel}, ${walkMinutes(meters)} min walk`;
}

export const DISTANCE_RINGS = [500, 1000, 2000] as const;
export type DistanceRing = (typeof DISTANCE_RINGS)[number];
export const DEFAULT_RING: DistanceRing = 1000;

/** ringLabel(500) -> 'Within 500 m', ringLabel(1000) -> 'Within 1 km'. */
export function ringLabel(ring: number): string {
  return `Within ${formatDistance(ring)}`;
}

/** True when the distance is inside the ring (edge included). */
export function withinRing(meters: number, ring: number): boolean {
  return Number.isFinite(meters) && meters >= 0 && meters <= ring;
}
