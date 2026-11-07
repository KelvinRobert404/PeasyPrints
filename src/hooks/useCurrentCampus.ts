'use client';

import { useSyncExternalStore } from 'react';
import { useCampusSession } from '@/hooks/useCampusSession';
import { useCollegeStore } from '@/lib/stores/collegeStore';
import { getCampus, getCollege } from '@/lib/campus/catalog';

export type CurrentCampus = {
  campusId: string;
  collegeId: string;
  /** College code, e.g. 'KJU'. */
  code: string;
  /** Header label, e.g. 'KJU Main'. */
  label: string;
};

const noopSubscribe = () => () => {};

/** False on the server and during hydration, true after. */
function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/**
 * The student's campus: the session's campus, else the pre-sign-in pick,
 * else null. Never asks the student; read only.
 */
export function useCurrentCampus(): CurrentCampus | null {
  const { session } = useCampusSession();
  const pick = useCollegeStore((state) => state.pick);
  const hydrated = useHydrated();

  const ref = session.campus;
  if (ref) return { campusId: ref.id, collegeId: ref.collegeId, code: ref.code, label: ref.label };

  // The pick lives in localStorage; ignore it until hydration so server and client agree.
  if (!hydrated || !pick) return null;
  const campus = getCampus(pick.campusId);
  if (!campus || campus.collegeId !== pick.collegeId) return null;
  const college = getCollege(campus.collegeId);
  if (!college) return null;
  return { campusId: campus.id, collegeId: college.id, code: college.code, label: campus.label };
}
