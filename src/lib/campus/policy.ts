import type { CampusAudience } from '@/types/campus';

export function formatCampusSerial(collegeCode: string, product: 'M' | 'H', value: number) {
  if (!/^[A-Z]{2,8}$/.test(collegeCode) || !Number.isInteger(value) || value < 0 || value > 9999) throw new Error('Invalid campus serial input');
  return `${collegeCode}-${product}${value.toString().padStart(4, '0')}`;
}

export function canReadAudience(recordAudience: CampusAudience, requestedAudience: CampusAudience, girlsApproved: boolean) {
  return recordAudience === requestedAudience && (recordAudience === 'campus' || girlsApproved);
}

export function canPromote(record: { audience: CampusAudience; promotionEligible: boolean; status: string; availabilityExpiresAt: string }, now = Date.now()) {
  return record.audience === 'campus' && record.promotionEligible && record.status === 'active' && new Date(record.availabilityExpiresAt).getTime() > now;
}

export function canExposeApprovedContact(request: { status: string; buyerId: string; expiresAt: string }, viewerId: string, contentAvailable: boolean, now = Date.now()) {
  return request.status === 'approved' && request.buyerId === viewerId && new Date(request.expiresAt).getTime() > now && contentAvailable;
}

export function orderCampusItems<T extends { id: string; serial: string; collegeId: string; createdAt: string }>(items: T[], selectedCollegeId: string) {
  return [...items].sort((left, right) => {
    const college = Number(right.collegeId === selectedCollegeId) - Number(left.collegeId === selectedCollegeId);
    if (college) return college;
    const created = right.createdAt.localeCompare(left.createdAt);
    return created || left.serial.localeCompare(right.serial) || left.id.localeCompare(right.id);
  });
}
