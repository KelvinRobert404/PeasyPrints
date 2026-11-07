// Static college, campus and course catalog types (KADA-18).
// Data lives in src/lib/campus/catalog.ts and src/lib/campus/courses.ts.

export type CollegeId = 'christ' | 'jain' | 'kju' | 'pes' | 'presidency' | 'reva' | 'sju';

export type CollegeCode = 'CHRIST' | 'JAIN' | 'KJU' | 'PES' | 'PU' | 'REVA' | 'SJU';

export type LaunchState = 'live' | 'waitlist';

export type SemesterTerm = 'odd' | 'even';

/** When a semester usually starts. month is 1-12. */
export interface SemesterStart {
  term: SemesterTerm;
  month: number;
}

export interface College {
  id: CollegeId;
  code: CollegeCode;
  name: string;
  shortName: string;
  /** Lowercase search aliases, e.g. 'kjc', 'kristu'. */
  aliases: readonly string[];
  /** Student email domains used for verification. Empty until confirmed. */
  emailDomains: readonly string[];
  launchState: LaunchState;
  semesterStarts: readonly SemesterStart[];
}

export interface GeoOrigin {
  lat: number;
  lng: number;
  /** true when no source gave coordinates and the point is estimated. */
  approx: boolean;
}

/** An on-campus spot where students hand over prints or meet. */
export interface PickupPoint {
  id: string;
  label: string;
}

/**
 * A named place near a campus: a spot (hospital, mall, hostel) or an area chip
 * (Kothanur, Byrathi). Area chips use their own name as `area`.
 */
export interface Landmark {
  id: string;
  label: string;
  /** Canonical area name the landmark sits in, e.g. 'Kothanur'. */
  area: string;
  lat: number;
  lng: number;
  /** Lowercase search aliases and common misspellings. */
  aliases: readonly string[];
}

export interface Campus {
  id: string;
  collegeId: CollegeId;
  /** Official campus name. */
  name: string;
  /** Short header label, e.g. 'KJU Main'. */
  label: string;
  origin: GeoOrigin;
  pickupPoints: readonly PickupPoint[];
  landmarks: readonly Landmark[];
}

/** A college with its campuses, after any runtime overrides are merged. */
export interface CollegeConfig {
  college: College;
  campuses: readonly Campus[];
}

export interface CampusOverride {
  label?: string;
  pickupPoints?: readonly PickupPoint[];
  landmarks?: readonly Landmark[];
}

/** Runtime overrides for a college. Arrays replace the static value. */
export interface CollegeConfigOverride {
  launchState?: LaunchState;
  emailDomains?: readonly string[];
  semesterStarts?: readonly SemesterStart[];
  campuses?: Readonly<Record<string, CampusOverride>>;
}

export type ProgrammeLevel = 'ug' | 'pg';

export interface Programme {
  id: string;
  level: ProgrammeLevel;
  /** Short display name, e.g. 'BCom'. */
  name: string;
  fullName: string;
  /** Highest semester a student can be in. */
  semesters: number;
  specialisations: readonly string[];
}

export interface CourseInput {
  programmeId: string;
  semester: number;
  specialisation?: string | null;
}

export interface Course {
  programmeId: string;
  level: ProgrammeLevel;
  programmeName: string;
  semester: number;
  year: number;
  specialisation: string | null;
}

export type CourseError = 'unknown_programme' | 'bad_semester' | 'bad_specialisation';

export type CourseValidation =
  | { ok: true; course: Course }
  | { ok: false; error: CourseError; message: string };
