// Godview college config: the PUT body schema and the stored override shape (KADA-18).
// Stored at college_configs/{collegeId}. Merged over the static catalog with
// mergeCollegeConfig; campus origins are applied here because the catalog
// override type has no origin.
import { z } from 'zod';
import type { Campus, CampusOverride, CollegeConfigOverride, Landmark, LaunchState, PickupPoint } from '@/types/college';

/** College shown when Godview opens the config without ?collegeId. */
export const DEFAULT_CONFIG_COLLEGE_ID = 'kju';

export const COLLEGE_CONFIG_LIMITS = {
  emailDomains: 20,
  campuses: 12,
  pickupPoints: 30,
  landmarks: 200,
  aliases: 20,
} as const;

const DOMAIN_PATTERN = /^(?=.{3,100}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

const idSchema = z.string().trim().min(1, 'Id is required').max(80, 'Id is too long').regex(ID_PATTERN, 'Ids use a-z, 0-9 and dashes');

/** 'Kristujayanti.com ', '@kristujayanti.com' and 'kristujayanti.com' all store as 'kristujayanti.com'. */
export function normalizeEmailDomain(value: string): string {
  return value.trim().toLowerCase().replace(/^@+/, '');
}

const emailDomainSchema = z
  .string()
  .transform(normalizeEmailDomain)
  .pipe(z.string().regex(DOMAIN_PATTERN, 'Use a domain like kristujayanti.com'));

const latSchema = z.number({ invalid_type_error: 'Latitude must be a number' }).finite('Latitude must be a number').min(-90, 'Latitude is out of range').max(90, 'Latitude is out of range');
const lngSchema = z.number({ invalid_type_error: 'Longitude must be a number' }).finite('Longitude must be a number').min(-180, 'Longitude is out of range').max(180, 'Longitude is out of range');

const originSchema = z.object({ lat: latSchema, lng: lngSchema });

const pickupPointSchema = z.object({
  id: idSchema,
  label: z.string().trim().min(2, 'Pickup point needs a name').max(100, 'Pickup point name is too long'),
});

const landmarkSchema = z.object({
  id: idSchema,
  label: z.string().trim().min(2, 'Landmark needs a name').max(80, 'Landmark name is too long'),
  area: z.string().trim().min(2, 'Landmark needs an area').max(60, 'Area name is too long'),
  lat: latSchema,
  lng: lngSchema,
  aliases: z
    .array(z.string().trim().toLowerCase().max(60, 'Alias is too long'))
    .max(COLLEGE_CONFIG_LIMITS.aliases, 'Too many aliases')
    .transform((aliases) => [...new Set(aliases.filter(Boolean))]),
});

function uniqueIds(items: readonly { id: string }[]): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}

const campusSchema = z.object({
  id: idSchema,
  origin: originSchema,
  pickupPoints: z
    .array(pickupPointSchema)
    .max(COLLEGE_CONFIG_LIMITS.pickupPoints, 'Too many pickup points')
    .refine(uniqueIds, 'Pickup points need different names'),
  landmarks: z
    .array(landmarkSchema)
    .max(COLLEGE_CONFIG_LIMITS.landmarks, 'Too many landmarks')
    .refine(uniqueIds, 'Two landmarks share an id'),
});

export const collegeConfigPutSchema = z.object({
  emailDomains: z
    .array(emailDomainSchema)
    .max(COLLEGE_CONFIG_LIMITS.emailDomains, 'Too many email domains')
    .transform((domains) => [...new Set(domains)]),
  launchState: z.enum(['live', 'waitlist'], { errorMap: () => ({ message: 'Pick Live or Waitlist' }) }),
  marketplaceEnabled: z.boolean(),
  housingEnabled: z.boolean(),
  campuses: z
    .array(campusSchema)
    .max(COLLEGE_CONFIG_LIMITS.campuses, 'Too many campuses')
    .refine(uniqueIds, 'A campus is listed twice'),
});

export type CollegeConfigPut = z.infer<typeof collegeConfigPutSchema>;
export type CollegeConfigPutInput = z.input<typeof collegeConfigPutSchema>;

/** One plain line for the first problem, e.g. 'Campus 1, landmark 3, lat: Latitude is out of range'. */
export function describeConfigIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'Invalid college configuration';
  const parts: string[] = [];
  const path = issue.path;
  for (let index = 0; index < path.length; index += 1) {
    const key = path[index];
    const next = path[index + 1];
    if (typeof next === 'number') {
      const noun = key === 'campuses' ? 'Campus' : key === 'landmarks' ? 'landmark' : key === 'pickupPoints' ? 'pickup point' : key === 'emailDomains' ? 'email domain' : key === 'aliases' ? 'alias' : String(key);
      parts.push(`${noun} ${next + 1}`);
      index += 1;
    } else if (key !== 'origin') {
      parts.push(String(key));
    }
  }
  return parts.length ? `${parts.join(', ')}: ${issue.message}` : issue.message;
}

/** Per-campus override as stored. Arrays replace the catalog value. */
export interface StoredCampusOverride extends CampusOverride {
  origin?: { lat: number; lng: number };
}

/** The college_configs/{collegeId} fields this module owns. */
export interface StoredCollegeConfig extends CollegeConfigOverride {
  marketplaceEnabled?: boolean;
  housingEnabled?: boolean;
  campuses?: Readonly<Record<string, StoredCampusOverride>>;
}

/** The PUT body as the stored override. Campus ids must already be checked against the college. */
export function toStoredCollegeConfig(input: CollegeConfigPut): Required<Omit<StoredCollegeConfig, 'semesterStarts'>> {
  const campuses: Record<string, StoredCampusOverride> = {};
  for (const campus of input.campuses) {
    campuses[campus.id] = {
      origin: { lat: campus.origin.lat, lng: campus.origin.lng },
      pickupPoints: campus.pickupPoints.map((point) => ({ id: point.id, label: point.label })),
      landmarks: campus.landmarks.map((landmark) => ({ ...landmark, aliases: [...landmark.aliases] })),
    };
  }
  return {
    launchState: input.launchState,
    emailDomains: [...input.emailDomains],
    marketplaceEnabled: input.marketplaceEnabled,
    housingEnabled: input.housingEnabled,
    campuses,
  };
}

/** Campus ids in the body that do not belong to the college. */
export function unknownCampusIds(input: Pick<CollegeConfigPut, 'campuses'>, campuses: readonly Pick<Campus, 'id'>[]): string[] {
  const known = new Set(campuses.map((campus) => campus.id));
  return input.campuses.map((campus) => campus.id).filter((id) => !known.has(id));
}

/** Every pickup point across campuses, first id wins. Kept top level for older readers. */
export function flattenPickupPoints(input: Pick<CollegeConfigPut, 'campuses'>): PickupPoint[] {
  const seen = new Set<string>();
  const points: PickupPoint[] = [];
  for (const campus of input.campuses) {
    for (const point of campus.pickupPoints) {
      if (seen.has(point.id)) continue;
      seen.add(point.id);
      points.push({ id: point.id, label: point.label });
    }
  }
  return points;
}

const storedCampusSchema = z.object({
  label: z.string().optional(),
  origin: originSchema.optional(),
  pickupPoints: z.array(pickupPointSchema).optional(),
  landmarks: z.array(landmarkSchema).optional(),
});

/**
 * Reads a stored doc leniently: each field is checked on its own, so one bad
 * field falls back to the catalog instead of hiding the whole override.
 */
export function readStoredCollegeConfig(data: unknown): StoredCollegeConfig {
  const source = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const stored: { -readonly [K in keyof StoredCollegeConfig]: StoredCollegeConfig[K] } = {};
  const launch = z.enum(['live', 'waitlist']).safeParse(source.launchState);
  if (launch.success) stored.launchState = launch.data as LaunchState;
  const domains = z.array(emailDomainSchema).safeParse(source.emailDomains);
  if (domains.success) stored.emailDomains = [...new Set(domains.data)];
  if (typeof source.marketplaceEnabled === 'boolean') stored.marketplaceEnabled = source.marketplaceEnabled;
  if (typeof source.housingEnabled === 'boolean') stored.housingEnabled = source.housingEnabled;
  if (source.campuses && typeof source.campuses === 'object') {
    const campuses: Record<string, StoredCampusOverride> = {};
    for (const [id, value] of Object.entries(source.campuses as Record<string, unknown>)) {
      const parsed = storedCampusSchema.safeParse(value);
      if (!parsed.success) continue;
      const campus: StoredCampusOverride = {};
      if (parsed.data.label) campus.label = parsed.data.label;
      if (parsed.data.origin) campus.origin = parsed.data.origin;
      if (parsed.data.pickupPoints) campus.pickupPoints = parsed.data.pickupPoints;
      if (parsed.data.landmarks) campus.landmarks = parsed.data.landmarks as Landmark[];
      campuses[id] = campus;
    }
    stored.campuses = campuses;
  }
  return stored;
}

/** Applies stored origins to merged campuses. A stored origin is exact, so approx turns off. */
export function applyCampusOrigins(campuses: readonly Campus[], stored: StoredCollegeConfig): Campus[] {
  return campuses.map((campus) => {
    const origin = stored.campuses?.[campus.id]?.origin;
    return origin ? { ...campus, origin: { lat: origin.lat, lng: origin.lng, approx: false } } : campus;
  });
}

/** Serial namespaces a college owns, e.g. KJU-M and KJU-H. */
export function serialNamespacePrefixes(collegeCode: string): { product: 'marketplace' | 'housing'; prefix: string }[] {
  return [
    { product: 'marketplace', prefix: `${collegeCode}-M` },
    { product: 'housing', prefix: `${collegeCode}-H` },
  ];
}
