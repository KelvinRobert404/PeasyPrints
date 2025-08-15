"use client";

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const COLLEGES = [
	"Kristu Jayanti College",
	"St. Joseph's University",
	"Mount Carmel College",
	"Christ University",
];

type CollegeStore = {
	selectedCollege: string;
	setSelectedCollege: (college: string) => void;
};

export const useCollegeStore = create<CollegeStore>()(
	persist(
		(set) => ({
			selectedCollege: COLLEGES[0],
			setSelectedCollege: (college: string) => set({ selectedCollege: college }),
		}),
		{ name: 'college-store' }
	)
);


