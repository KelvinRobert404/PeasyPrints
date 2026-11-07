"use client";

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';
import type { College } from '@/types/models';
import type { CollegeId } from '@/types/college';
import type { MembershipStay, StayType } from '@/types/campus';
import { getCampus } from '@/lib/campus/catalog';
import { roundForPrivacy } from '@/lib/format/distance';

// Legacy hardcoded colleges for fallback during migration
export const LEGACY_COLLEGES = [
	"Kristu Jayanti College",
	"St. Joseph's University",
	"Mount Carmel College",
	"Christ University",
];

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
	// Legacy (PRINTCAMPUS removes the rest of this store's API).
	// Dynamic colleges from Firestore
	colleges: College[];
	loading: boolean;
	error: string | null;
	// Currently selected college name
	selectedCollege: string;
	setSelectedCollege: (college: string) => void;
	// Subscribe to Firestore colleges collection
	subscribe: () => () => void;
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
			colleges: [],
			loading: false,
			error: null,
			selectedCollege: LEGACY_COLLEGES[0],
			setSelectedCollege: (college: string) => set({ selectedCollege: college }),
			subscribe: () => {
				set({ loading: true, error: null });
				const ref = collection(db, 'colleges');
				const unsub = onSnapshot(ref, (snap: QuerySnapshot<DocumentData>) => {
					const colleges: College[] = snap.docs.map((d) => ({
						id: d.id,
						name: d.data().name ?? '',
						shortName: d.data().shortName,
						createdAt: d.data().createdAt,
					}));
					// If no colleges exist yet, use legacy list as fallback
					if (colleges.length === 0) {
						set({
							colleges: LEGACY_COLLEGES.map((name, i) => ({
								id: `legacy-${i}`,
								name,
								createdAt: null,
							})),
							loading: false,
						});
					} else {
						set({ colleges, loading: false });
						// Update selectedCollege if current selection is not in new list
						const currentSelection = get().selectedCollege;
						const exists = colleges.some(c => c.name === currentSelection);
						if (!exists && colleges.length > 0) {
							set({ selectedCollege: colleges[0].name });
						}
					}
				}, (err) => {
					set({ error: err.message, loading: false });
				});
				return unsub;
			},
		}),
		{
			name: 'college-store',
			partialize: (state) => ({ selectedCollege: state.selectedCollege, pick: state.pick, stay: state.stay }),
			// Re-check stored choices against the catalog; drop anything stale or extra.
			merge: (persisted, current) => {
				const saved = (persisted ?? {}) as Partial<Pick<CollegeStore, 'selectedCollege' | 'pick' | 'stay'>>;
				const pick = sanitizePick(saved.pick);
				return {
					...current,
					selectedCollege: typeof saved.selectedCollege === 'string' ? saved.selectedCollege : current.selectedCollege,
					pick,
					stay: pick ? sanitizeStay(saved.stay) : null,
				};
			},
		}
	)
);

// Helper to get college names array for dropdowns
export function useCollegeNames(): string[] {
	const { colleges, loading } = useCollegeStore();
	const names = colleges.map(c => c.name).filter((name) => Boolean(name && name.trim()));
	if (loading || names.length === 0) return LEGACY_COLLEGES;
	return names;
}
