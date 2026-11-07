// Loads a college's runtime config: the static catalog merged with college_configs/{id}.
import { getAdminDb } from '@/lib/firebase/admin';
import { CAMPUS_COLLECTIONS } from './constants';
import { collegeConfigFromDoc, type LoadedCollegeConfig } from './membership';

export type { CampusFlags, CampusProduct, LoadedCollegeConfig } from './membership';

/** The catalog college with its stored overrides and product flags, or null for an unknown college. */
export async function loadCollegeConfig(collegeId: string | null | undefined): Promise<LoadedCollegeConfig | null> {
  if (!collegeId) return null;
  const fromCatalog = collegeConfigFromDoc(collegeId, null);
  if (!fromCatalog) return null;
  const snapshot = await getAdminDb().collection(CAMPUS_COLLECTIONS.colleges).doc(fromCatalog.college.id).get();
  return collegeConfigFromDoc(fromCatalog.college.id, snapshot.exists ? snapshot.data() : null);
}
