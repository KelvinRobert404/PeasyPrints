import { getAdminDb } from '@/lib/firebase/admin';
import { CampusHttpError } from './auth';
import type { CampusAudience } from '@/types/campus';

export async function assertOwnedCampusMedia(urls: string[], ownerId: string, audience: CampusAudience) {
  const ids = urls.map((url) => url.match(/^\/api\/campus\/media\/([^/?]+)$/)?.[1]).filter((id): id is string => Boolean(id));
  if (ids.length !== urls.length) throw new CampusHttpError(400, 'One or more images are invalid');
  const snapshots = await Promise.all(ids.map((id) => getAdminDb().collection('campus_media').doc(id).get()));
  const invalid = snapshots.some((snapshot) => !snapshot.exists || snapshot.data()!.ownerId !== ownerId || snapshot.data()!.audience !== audience);
  if (invalid) throw new CampusHttpError(403, 'Images must belong to you and match the selected audience');
}
