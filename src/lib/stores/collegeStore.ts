"use client";

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CollegeId } from '@/types/college';
import type { MembershipStay, StayType } from '@/types/campus';
import { getCampus } from '@/lib/campus/catalog';
import { roundForPrivacy } from '@/lib/format/distance';

/** College and campus chosen before sign-in. */
export type CollegePick = {
	collegeId: CollegeId;
	campusId: string;
};

/** Where the student lives. Distance only, never coordinates. */
export type StayChoice = MembershipStay;

const STAY_TYPES: readonly StayType[] = ['pg', 'flat', 'hostel', 'home'];

/** A pick the catalog knows, rebuilt with only its two ids, else null. */
export function sanitizePick(value: unknown): CollegePick | null {
	if (!value || typeof value !== 'object') return null;
	const { collegeId, campusId } = value as { collegeId?: unknown; campusId?: unknown };
	if (typeof collegeId !== 'string' || typeof campusId !== 'string') return null;
	const campus = getCampus(campusId);
	if (!campus || campus.collegeId !== collegeId) return null;
	return { collegeId: campus.collegeId, campusId: campus.id };
}

/**
 * A stay rebuilt with only type and a privacy-rounded distance, else null.
 * Anything else on the input (coordinates included) is dropped.
 */
export function sanitizeStay(value: unknown): StayChoice | null {
	if (!value || typeof value !== 'object') return null;
	const { type, distanceM } = value as { type?: unknown; distanceM?: unknown };
	if (typeof type !== 'string' || !STAY_TYPES.includes(type as StayType)) return null;
	const distance = typeof distanceM === 'number' && Number.isFinite(distanceM) && distanceM >= 0 ? roundForPrivacy(distanceM) : null;
	return { type: type as StayType, distanceM: distance };
}

type CollegeStore = {
	// Pre-sign-in choices (persisted). Never holds lat/lng.
	pick: CollegePick | null;
	stay: StayChoice | null;
	setPick: (pick: CollegePick | null) => void;
	setStay: (stay: StayChoice | null) => void;
	/** Clears the pick and the stay (its distance is measured from the pick). */
	clearPick: () => void;
};

export const useCollegeStore = create<CollegeStore>()(
	persist(
		(set, get) => ({
			pick: null,
			stay: null,
			setPick: (next) => {
				const pick = sanitizePick(next);
				if (!pick) {
					set({ pick: null, stay: null });
					return;
				}
				const { pick: prev, stay } = get();
				// A distance is measured from one campus; drop it when the campus changes.
				const campusChanged = prev?.campusId !== pick.campusId;
				set({ pick, stay: campusChanged && stay ? { type: stay.type, distanceM: null } : stay });
			},
			setStay: (next) => {
				const stay = sanitizeStay(next);
				// Without a campus there is nothing to measure from.
				set({ stay: stay && !get().pick ? { type: stay.type, distanceM: null } : stay });
			},
			clearPick: () => set({ pick: null, stay: null }),
		}),
		{
			name: 'college-store',
			partialize: (state) => ({ pick: state.pick, stay: state.stay }),
			// Re-check stored choices against the catalog; drop anything stale or extra
			// (the legacy persisted college name included).
			merge: (persisted, current) => {
				const saved = (persisted ?? {}) as Partial<Pick<CollegeStore, 'pick' | 'stay'>>;
				const pick = sanitizePick(saved.pick);
				return {
					...current,
					pick,
					stay: pick ? sanitizeStay(saved.stay) : null,
				};
			},
		}
	)
);
