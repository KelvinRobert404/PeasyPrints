"use client";

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';
import type { College } from '@/types/models';

// Legacy hardcoded colleges for fallback during migration
export const LEGACY_COLLEGES = [
	"Kristu Jayanti College",
	"St. Joseph's University",
	"Mount Carmel College",
	"Christ University",
];

type CollegeStore = {
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
			partialize: (state) => ({ selectedCollege: state.selectedCollege }),
		}
	)
);

// Helper to get college names array for dropdowns
export function useCollegeNames(): string[] {
	const { colleges, loading } = useCollegeStore();
	if (loading || colleges.length === 0) return LEGACY_COLLEGES;
	return colleges.map(c => c.name);
}
