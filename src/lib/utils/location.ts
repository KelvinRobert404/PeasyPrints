import type { ListingLocation } from '@/types/models';

// Kristu Jayanti College approximate coordinates (can be refined)
const KJC_LAT = 13.0507;
const KJC_LNG = 77.6400;

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

export function distanceKmFromCollege(loc: ListingLocation): number {
  const R = 6371; // Radius of the earth in km
  const dLat = toRad(loc.lat - KJC_LAT);
  const dLng = toRad(loc.lng - KJC_LNG);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(KJC_LAT)) *
      Math.cos(toRad(loc.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatLocationForCard(loc: ListingLocation): string {
  const d = distanceKmFromCollege(loc);

  // Within ~1.5km we just say "Nearby College"
  if (!Number.isNaN(d) && d <= 1.5) {
    return 'Nearby College';
  }

  if (Number.isNaN(d)) {
    return loc.area;
  }

  const rounded = d < 10 ? d.toFixed(1) : Math.round(d).toString();
  return `${rounded} km from college • ${loc.area}`;
}















