// UG and PG programmes students can pick (KADA-18). Shared across colleges.
// `semesters` is the highest semester allowed: NEP honours UG degrees run to 8.
import type { Course, CourseInput, CourseValidation, Programme, ProgrammeLevel } from '@/types/college';

const PROGRAMMES: readonly Programme[] = Object.freeze(
  (
    [
      // Undergraduate
      {
        id: 'ba',
        level: 'ug',
        name: 'BA',
        fullName: 'Bachelor of Arts',
        semesters: 8,
        specialisations: ['Psychology', 'English', 'Economics', 'Journalism', 'Political Science', 'Sociology', 'History'],
      },
      {
        id: 'bcom',
        level: 'ug',
        name: 'BCom',
        fullName: 'Bachelor of Commerce',
        semesters: 8,
        specialisations: ['General', 'Accounting and Finance', 'Professional', 'Banking and Finance', 'Business Analytics', 'Travel and Tourism'],
      },
      {
        id: 'bba',
        level: 'ug',
        name: 'BBA',
        fullName: 'Bachelor of Business Administration',
        semesters: 8,
        specialisations: ['General', 'Finance', 'Marketing', 'Human Resources', 'Business Analytics', 'Aviation'],
      },
      {
        id: 'bca',
        level: 'ug',
        name: 'BCA',
        fullName: 'Bachelor of Computer Applications',
        semesters: 8,
        specialisations: ['General', 'Data Science', 'Cloud Computing', 'Cyber Security', 'AI and Machine Learning'],
      },
      {
        id: 'bsc',
        level: 'ug',
        name: 'BSc',
        fullName: 'Bachelor of Science',
        semesters: 8,
        specialisations: ['Computer Science', 'Biotechnology', 'Psychology', 'Forensic Science', 'Physics', 'Chemistry', 'Mathematics', 'Microbiology'],
      },
      {
        id: 'btech',
        level: 'ug',
        name: 'BTech',
        fullName: 'Bachelor of Technology',
        semesters: 8,
        specialisations: [
          'Computer Science',
          'AI and Machine Learning',
          'Data Science',
          'Electronics and Communication',
          'Electrical and Electronics',
          'Mechanical',
          'Civil',
          'Biotechnology',
        ],
      },
      {
        id: 'bdes',
        level: 'ug',
        name: 'BDes',
        fullName: 'Bachelor of Design',
        semesters: 8,
        specialisations: ['Communication Design', 'Fashion Design', 'Interior Design', 'Product Design', 'Animation'],
      },
      { id: 'bsw', level: 'ug', name: 'BSW', fullName: 'Bachelor of Social Work', semesters: 6, specialisations: [] },
      { id: 'bpharm', level: 'ug', name: 'BPharm', fullName: 'Bachelor of Pharmacy', semesters: 8, specialisations: [] },
      { id: 'llb', level: 'ug', name: 'LLB', fullName: 'Bachelor of Laws', semesters: 6, specialisations: [] },
      { id: 'ba-llb', level: 'ug', name: 'BA LLB', fullName: 'BA LLB (Hons)', semesters: 10, specialisations: [] },
      { id: 'bba-llb', level: 'ug', name: 'BBA LLB', fullName: 'BBA LLB (Hons)', semesters: 10, specialisations: [] },
      // Postgraduate
      {
        id: 'ma',
        level: 'pg',
        name: 'MA',
        fullName: 'Master of Arts',
        semesters: 4,
        specialisations: ['English', 'Economics', 'Psychology', 'Journalism', 'Sociology'],
      },
      {
        id: 'mcom',
        level: 'pg',
        name: 'MCom',
        fullName: 'Master of Commerce',
        semesters: 4,
        specialisations: ['General', 'Finance and Taxation', 'Accounting and Finance', 'Business Analytics'],
      },
      {
        id: 'mba',
        level: 'pg',
        name: 'MBA',
        fullName: 'Master of Business Administration',
        semesters: 4,
        specialisations: ['Finance', 'Marketing', 'Human Resources', 'Business Analytics', 'Operations', 'International Business'],
      },
      {
        id: 'mca',
        level: 'pg',
        name: 'MCA',
        fullName: 'Master of Computer Applications',
        semesters: 4,
        specialisations: ['General', 'Data Science', 'Cloud Computing', 'Cyber Security'],
      },
      {
        id: 'msc',
        level: 'pg',
        name: 'MSc',
        fullName: 'Master of Science',
        semesters: 4,
        specialisations: ['Computer Science', 'Data Science', 'Biotechnology', 'Psychology', 'Chemistry', 'Mathematics', 'Physics', 'Microbiology'],
      },
      {
        id: 'mtech',
        level: 'pg',
        name: 'MTech',
        fullName: 'Master of Technology',
        semesters: 4,
        specialisations: ['Computer Science', 'Data Science', 'VLSI Design', 'Structural Engineering'],
      },
      { id: 'msw', level: 'pg', name: 'MSW', fullName: 'Master of Social Work', semesters: 4, specialisations: [] },
      { id: 'llm', level: 'pg', name: 'LLM', fullName: 'Master of Laws', semesters: 2, specialisations: [] },
    ] satisfies Programme[]
  ).map((programme) => Object.freeze({ ...programme, specialisations: Object.freeze([...programme.specialisations]) })),
);

const PROGRAMME_BY_ID = new Map<string, Programme>(PROGRAMMES.map((programme) => [programme.id, programme]));

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function listProgrammes(level?: ProgrammeLevel): readonly Programme[] {
  return level ? PROGRAMMES.filter((programme) => programme.level === level) : PROGRAMMES;
}

export function getProgramme(id: string | null | undefined): Programme | null {
  return id ? PROGRAMME_BY_ID.get(id) ?? null : null;
}

/** Checks a programme, semester and optional specialisation, and returns the canonical course. */
export function validateCourse(input: CourseInput): CourseValidation {
  const programme = getProgramme(input.programmeId);
  if (!programme) return { ok: false, error: 'unknown_programme', message: 'Pick a course from the list.' };

  const { semester } = input;
  if (typeof semester !== 'number' || !Number.isInteger(semester) || semester < 1 || semester > programme.semesters) {
    return { ok: false, error: 'bad_semester', message: `${programme.name} runs sem 1 to ${programme.semesters}.` };
  }

  let specialisation: string | null = null;
  const raw = typeof input.specialisation === 'string' ? input.specialisation.trim() : '';
  if (raw) {
    const wanted = normalize(raw);
    const match = programme.specialisations.find((option) => normalize(option) === wanted);
    if (!match) return { ok: false, error: 'bad_specialisation', message: 'Pick a specialisation from the list.' };
    specialisation = match;
  }

  const course: Course = {
    programmeId: programme.id,
    level: programme.level,
    programmeName: programme.name,
    semester,
    year: Math.ceil(semester / 2),
    specialisation,
  };
  return { ok: true, course };
}

/** Short label such as 'BBA Finance, sem 3'. */
export function courseLabel(course: Pick<Course, 'programmeName' | 'semester' | 'specialisation'>): string {
  const name = course.specialisation ? `${course.programmeName} ${course.specialisation}` : course.programmeName;
  return `${name}, sem ${course.semester}`;
}
