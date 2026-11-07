// Static college and campus catalog (KADA-18).
// Source: docs/implementations/kada-18-campus-facts.json. Campus origins use the
// researched coordinates where they exist; the rest are estimates marked approx.
// Landmark coordinates are estimates placed from student-stated distances and
// map knowledge. They drive distance chips, not navigation.
import type {
  Campus,
  CampusOverride,
  College,
  CollegeConfig,
  CollegeConfigOverride,
  CollegeId,
  GeoOrigin,
  Landmark,
  PickupPoint,
  SemesterStart,
} from '@/types/college';

type LandmarkRow = readonly [slug: string, label: string, area: string, lat: number, lng: number, aliases: readonly string[]];

interface CampusSeed {
  id: string;
  collegeId: CollegeId;
  name: string;
  label: string;
  origin: GeoOrigin;
  pickupPoints?: readonly (readonly [slug: string, label: string])[];
  landmarks: readonly LandmarkRow[];
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

function buildCampus(seed: CampusSeed): Campus {
  const pickupPoints: PickupPoint[] = (seed.pickupPoints ?? []).map(([slug, label]) => ({ id: `${seed.id}-${slug}`, label }));
  const landmarks: Landmark[] = seed.landmarks.map(([slug, label, area, lat, lng, aliases]) => ({
    id: `${seed.id}-${slug}`,
    label,
    area,
    lat,
    lng,
    aliases,
  }));
  return { id: seed.id, collegeId: seed.collegeId, name: seed.name, label: seed.label, origin: seed.origin, pickupPoints, landmarks };
}

/** Odd semester from June, even from November. Override per college when known. */
const DEFAULT_SEMESTER_STARTS: readonly SemesterStart[] = [
  { term: 'odd', month: 6 },
  { term: 'even', month: 11 },
];

const COLLEGES: readonly College[] = deepFreeze<College[]>([
  {
    id: 'christ',
    code: 'CHRIST',
    name: 'CHRIST (Deemed to be University)',
    shortName: 'Christ',
    aliases: ['christ', 'christ university', 'christ uni', 'christ college'],
    emailDomains: [],
    launchState: 'waitlist',
    semesterStarts: DEFAULT_SEMESTER_STARTS,
  },
  {
    id: 'jain',
    code: 'JAIN',
    name: 'JAIN (Deemed-to-be University)',
    shortName: 'Jain',
    aliases: ['jain', 'jain university', 'jain uni', 'jain college', 'cms', 'cms jain'],
    emailDomains: [],
    launchState: 'waitlist',
    semesterStarts: DEFAULT_SEMESTER_STARTS,
  },
  {
    id: 'kju',
    code: 'KJU',
    name: 'Kristu Jayanti (Deemed to be University)',
    shortName: 'KJU',
    aliases: [
      'kju',
      'kjc',
      'kristu',
      'kristu jayanti',
      'kristujayanti',
      'kristu jayanthi',
      'kj college',
      'kristu jayanti university',
      'kristu jayanti college',
      'clg',
      'cllg',
      'colg',
    ],
    emailDomains: [],
    launchState: 'live',
    semesterStarts: DEFAULT_SEMESTER_STARTS,
  },
  {
    id: 'pes',
    code: 'PES',
    name: 'PES University',
    shortName: 'PES',
    aliases: ['pes', 'pesu', 'pes university', 'pes college'],
    emailDomains: [],
    launchState: 'waitlist',
    semesterStarts: DEFAULT_SEMESTER_STARTS,
  },
  {
    id: 'presidency',
    code: 'PU',
    name: 'Presidency University',
    shortName: 'Presidency',
    aliases: ['presidency', 'presidency university', 'presidency uni'],
    emailDomains: [],
    launchState: 'waitlist',
    semesterStarts: DEFAULT_SEMESTER_STARTS,
  },
  {
    id: 'reva',
    code: 'REVA',
    name: 'REVA University',
    shortName: 'REVA',
    aliases: ['reva', 'reva university', 'reva uni'],
    emailDomains: [],
    launchState: 'waitlist',
    semesterStarts: DEFAULT_SEMESTER_STARTS,
  },
  {
    id: 'sju',
    code: 'SJU',
    name: "St Joseph's University",
    shortName: "St Joseph's",
    aliases: ['sju', 'sjc', 'st josephs', 'st joseph', 'saint josephs', 'st josephs university', 'st josephs college', 'josephs'],
    emailDomains: [],
    launchState: 'waitlist',
    semesterStarts: DEFAULT_SEMESTER_STARTS,
  },
]);

const CAMPUS_SEEDS: readonly CampusSeed[] = [
  // CHRIST
  {
    id: 'christ-central',
    collegeId: 'christ',
    name: 'Bangalore Central Campus',
    label: 'Christ Central',
    origin: { lat: 12.9338, lng: 77.6052, approx: false },
    landmarks: [
      ['dairy-circle', 'Dairy Circle', 'Dairy Circle', 12.9375, 77.6035, ['dairy circle', 'bangalore dairy']],
      ['sg-palya', 'S.G. Palya', 'S.G. Palya', 12.936, 77.608, ['sg palya', 'suddaguntepalya']],
      ['tavarekere', 'Tavarekere', 'Tavarekere', 12.93, 77.61, ['tavarekere']],
      ['adugodi', 'Adugodi', 'Adugodi', 12.943, 77.61, ['adugodi']],
      ['koramangala', 'Koramangala', 'Koramangala', 12.928, 77.625, ['koramangala', 'kormangala']],
    ],
  },
  {
    id: 'christ-bannerghatta-road',
    collegeId: 'christ',
    name: 'Bangalore Bannerghatta Road Campus',
    label: 'Christ BG Rd',
    origin: { lat: 12.8779, lng: 77.5961, approx: false },
    landmarks: [
      ['hulimavu', 'Hulimavu', 'Hulimavu', 12.877, 77.6, ['hulimavu']],
      ['arekere', 'Arekere', 'Arekere', 12.888, 77.6, ['arekere']],
      ['kalena-agrahara', 'Kalena Agrahara', 'Kalena Agrahara', 12.87, 77.597, ['kalena agrahara']],
      ['gottigere', 'Gottigere', 'Gottigere', 12.858, 77.588, ['gottigere']],
    ],
  },
  {
    id: 'christ-kengeri',
    collegeId: 'christ',
    name: 'Bangalore Kengeri Campus',
    label: 'Christ Kengeri',
    origin: { lat: 12.863, lng: 77.4379, approx: false },
    landmarks: [
      ['kumbalgodu', 'Kumbalgodu', 'Kumbalgodu', 12.864, 77.43, ['kumbalgodu']],
      ['kambipura', 'Kambipura', 'Kambipura', 12.881, 77.457, ['kambipura']],
      ['gonipura', 'Gonipura', 'Gonipura', 12.88, 77.43, ['gonipura']],
    ],
  },
  {
    id: 'christ-yeshwanthpur',
    collegeId: 'christ',
    name: 'Bangalore Yeshwanthpur Campus',
    label: 'Christ Yeshwanthpur',
    origin: { lat: 13.0357, lng: 77.5057, approx: false },
    landmarks: [
      ['nagasandra-metro', 'Nagasandra metro', 'Nagasandra', 13.048, 77.5, ['nagasandra', 'nagasandra metro']],
      ['nelagadaranahalli', 'Nelagadaranahalli', 'Nelagadaranahalli', 13.038, 77.51, ['nelagadaranahalli']],
      ['peenya-2nd-stage', 'Peenya 2nd Stage', 'Peenya', 13.027, 77.515, ['peenya', 'peenya 2nd stage']],
      ['andrahalli', 'Andrahalli', 'Andrahalli', 13.03, 77.497, ['andrahalli']],
    ],
  },
  // JAIN (no published coordinates: origins are estimates)
  {
    id: 'jain-knowledge-campus',
    collegeId: 'jain',
    name: 'JAIN Knowledge Campus',
    label: 'Jain Jayanagar',
    origin: { lat: 12.923, lng: 77.588, approx: true },
    landmarks: [
      ['jayanagar-9th-block', 'Jayanagar 9th Block', 'Jayanagar', 12.922, 77.586, ['jayanagar', 'jayanagar 9th block']],
      ['jp-nagar-2nd-phase', 'JP Nagar 2nd Phase', 'JP Nagar', 12.912, 77.587, ['jp nagar', 'jp nagar 2nd phase']],
      ['btm-2nd-stage', 'BTM Layout 2nd Stage', 'BTM Layout', 12.916, 77.61, ['btm', 'btm layout']],
    ],
  },
  {
    id: 'jain-lalbagh-road',
    collegeId: 'jain',
    name: 'Center for Management Studies',
    label: 'Jain Lalbagh Rd',
    origin: { lat: 12.956, lng: 77.588, approx: true },
    landmarks: [
      ['wilson-garden', 'Wilson Garden', 'Wilson Garden', 12.948, 77.597, ['wilson garden']],
      ['shanthinagar', 'Shanthinagar', 'Shanthinagar', 12.957, 77.6, ['shanthinagar', 'shanti nagar']],
      ['basavanagudi', 'Basavanagudi', 'Basavanagudi', 12.942, 77.575, ['basavanagudi']],
    ],
  },
  {
    id: 'jain-jc-road',
    collegeId: 'jain',
    name: 'School of Sciences, JC Road',
    label: 'Jain JC Rd',
    origin: { lat: 12.957, lng: 77.58, approx: true },
    landmarks: [
      ['minerva-circle', 'Minerva Circle', 'JC Road', 12.956, 77.579, ['minerva', 'minerva circle']],
      ['chamarajpet', 'Chamarajpet', 'Chamarajpet', 12.96, 77.565, ['chamarajpet']],
      ['shanthinagar', 'Shanthinagar', 'Shanthinagar', 12.957, 77.6, ['shanthinagar', 'shanti nagar']],
    ],
  },
  {
    id: 'jain-sheshadri-road',
    collegeId: 'jain',
    name: 'CMS Business School, Sheshadri Road',
    label: 'Jain Sheshadri Rd',
    origin: { lat: 12.979, lng: 77.58, approx: true },
    landmarks: [
      ['freedom-park', 'Freedom Park', 'Gandhi Nagar', 12.978, 77.583, ['freedom park']],
      ['majestic', 'Majestic', 'Majestic', 12.977, 77.572, ['majestic', 'kempegowda bus stand']],
      ['seshadripuram', 'Seshadripuram', 'Seshadripuram', 12.989, 77.575, ['seshadripuram']],
      ['malleshwaram', 'Malleshwaram', 'Malleshwaram', 13.003, 77.57, ['malleshwaram', 'malleswaram']],
    ],
  },
  {
    id: 'jain-shankarapuram',
    collegeId: 'jain',
    name: 'School of Law, Shankarapuram',
    label: 'Jain Shankarapuram',
    origin: { lat: 12.948, lng: 77.571, approx: true },
    landmarks: [
      ['basavanagudi', 'Basavanagudi', 'Basavanagudi', 12.942, 77.575, ['basavanagudi']],
      ['shankarapuram', 'Shankarapuram', 'Shankarapuram', 12.949, 77.57, ['shankarapuram']],
      ['hanumanthanagar', 'Hanumanthanagar', 'Hanumanthanagar', 12.939, 77.561, ['hanumanthanagar']],
    ],
  },
  {
    id: 'jain-whitefield',
    collegeId: 'jain',
    name: 'School of Allied Healthcare & Sciences',
    label: 'Jain Whitefield',
    origin: { lat: 12.986, lng: 77.735, approx: true },
    landmarks: [
      ['itpl', 'ITPL', 'Whitefield', 12.986, 77.737, ['itpl', 'whitefield']],
      ['pattandur-agrahara', 'Pattandur Agrahara', 'Pattandur Agrahara', 12.989, 77.729, ['pattandur agrahara']],
      ['hoodi', 'Hoodi', 'Hoodi', 12.992, 77.715, ['hoodi']],
      ['brookefield', 'Brookefield', 'Brookefield', 12.967, 77.718, ['brookefield']],
    ],
  },
  {
    id: 'jain-sugatta',
    collegeId: 'jain',
    name: 'School of Design, Media & Creative Arts',
    label: 'Jain Sugatta',
    origin: { lat: 13.165, lng: 77.615, approx: true },
    landmarks: [
      ['hunasamaranahalli', 'Hunasamaranahalli', 'Hunasamaranahalli', 13.162, 77.623, ['hunasamaranahalli']],
      ['bettahalasur', 'Bettahalasur', 'Bettahalasur', 13.168, 77.633, ['bettahalasur']],
      ['chikkajala', 'Chikkajala', 'Chikkajala', 13.172, 77.635, ['chikkajala']],
    ],
  },
  {
    id: 'jain-jp-nagar',
    collegeId: 'jain',
    name: 'JP Nagar 6th Phase campus',
    label: 'Jain JP Nagar',
    origin: { lat: 12.899, lng: 77.588, approx: true },
    landmarks: [
      ['puttenahalli', 'Puttenahalli', 'Puttenahalli', 12.897, 77.585, ['puttenahalli']],
      ['jp-nagar-6th-phase', 'JP Nagar 6th Phase', 'JP Nagar', 12.905, 77.58, ['jp nagar', 'jp nagar 6th phase']],
      ['arekere', 'Arekere', 'Arekere', 12.888, 77.6, ['arekere']],
    ],
  },
  {
    id: 'jain-global',
    collegeId: 'jain',
    name: 'JAIN Global Campus',
    label: 'Jain Global',
    origin: { lat: 12.643, lng: 77.44, approx: true },
    landmarks: [
      ['jakkasandra', 'Jakkasandra', 'Jakkasandra', 12.645, 77.438, ['jakkasandra']],
      ['campus-hostels', 'Campus hostels', 'Jakkasandra', 12.6435, 77.4405, ['hostel', 'hostels']],
    ],
  },
  // Kristu Jayanti
  {
    id: 'kju-main',
    collegeId: 'kju',
    name: 'Central Campus',
    label: 'KJU Main',
    origin: { lat: 13.059, lng: 77.6428, approx: false },
    pickupPoints: [
      ['humanities-block', 'Humanities Block'],
      ['main-block', 'Main Block'],
      ['utility-block', 'Utility Block'],
      ['quadrangle', 'Quadrangle'],
      ['first-gate', 'First gate'],
      ['sports-arena', 'Sports Arena'],
      ['jubilee-auditorium', 'Jubilee Auditorium'],
    ],
    landmarks: [
      // Spots, ranked by how many students name them.
      ['falcon-hospital', 'Falcon Hospital', 'Gulabi Road', 13.0615, 77.644, ['falcon', 'falcon hospital', 'falcon healthcare', 'falcon road', 'falcon side', 'falcon 2nd cross']],
      ['bhartiya-city', 'Bhartiya City', 'Thanisandra', 13.069, 77.633, ['bhartiya', 'bharthiya', 'bharatiya', 'bharitya', 'bharathiya', 'barthiya', 'leela bhartiya city', 'bhartiya mall', 'bhartiya mall of bengaluru', 'pvr']],
      ['livesta', 'Livesta hostel', 'Kothanur', 13.0625, 77.646, ['livesta', 'levista']],
      ['navajyothi', 'Navajyothi hostel', 'Kothanur', 13.063, 77.642, ['navajyothi', 'navajyoti', 'nava jyoti', 'nava jyothi']],
      ['amber-mega-store', 'Amber Mega Store', 'Byrathi', 13.064, 77.653, ['amber', 'amber mega store', 'amber mart', 'opposite amber']],
      ['hanuman-arch', 'Hanuman arch', 'Murthy Layout', 13.0545, 77.647, ['hanuman arch', 'hanuman arc', 'hanuman gate', 'hanuman temple', 'hanuman mandir']],
      ['manyata-tech-park', 'Manyata Tech Park', 'Manyata', 13.0475, 77.621, ['manyata', 'manyatha', 'mtp']],
      ['empire', 'Empire restaurant', 'Kothanur', 13.049, 77.64, ['empire', 'empire hotel', 'empire byrathi', 'empire hennur', 'empire kothanur']],
      ['shelter-apartments', 'Shelter apartments', 'Defence Enclave', 13.056, 77.648, ['shelter']],
      ['udupi-vaibhav', 'Udupi Vaibhav', 'K Narayanapura', 13.0585, 77.645, ['udupi', 'udupi vaibhav']],
      ['teayos', 'Teayos', 'Kothanur', 13.048, 77.642, ['teayos', 'teayose', 'teaos']],
      ['st-marys-church', "St Mary's Church", 'K Narayanapura', 13.0595, 77.6445, ['st marys', 'st mary', 'st marys church']],
      ['hanumanta-gowda-circle', 'Hanumanta Gowda Circle', 'K Narayanapura', 13.062, 77.638, ['hanumanta circle', 'hanumanta gowda circle']],
      ['good-health-hospital', 'Good Health Hospital', 'K Narayanapura', 13.065, 77.64, ['good health', 'good health hospital']],
      ['royal-mart', 'Royal Mart', 'Gulabi Road', 13.062, 77.645, ['royal mart', 'royal fresh mart']],
      // Area chips.
      ['area-kothanur', 'Kothanur', 'Kothanur', 13.064, 77.644, ['kothanur', 'kothnur', 'mla layout']],
      ['area-k-narayanapura', 'K Narayanapura', 'K Narayanapura', 13.0575, 77.642, ['knp', 'k narayanapura', 'narayanapura', 'narayanpura', 'arkavathy layout', 'nanjappa layout']],
      ['area-byrathi', 'Byrathi', 'Byrathi', 13.064, 77.656, ['byrathi', 'byrthi', 'byrtahi', 'byrathy', 'byrathicross', 'byrathi cross']],
      ['area-bds-nagar', 'BDS Nagar', 'BDS Nagar', 13.062, 77.65, ['bds', 'bds nagar', 'bds garden', 'bds gardens']],
      ['area-hennur', 'Hennur', 'Hennur', 13.045, 77.638, ['hennur', 'hennur cross']],
      ['area-murthy-layout', 'Murthy Layout', 'Murthy Layout', 13.055, 77.647, ['murthy', 'murthi', 'murty layout', 'murthylayout', 'murthy layout']],
      ['area-sainikpuri', 'Sainikpuri', 'Sainikpuri', 13.052, 77.65, ['sainikpuri', 'sanik puri', 'sainik puri', 'senikpuri']],
      ['area-gulabi-road', 'Gulabi Road', 'Gulabi Road', 13.061, 77.645, ['gulabi', 'gulabi road', 'gulabi gali']],
      ['area-defence-enclave', 'Defence Enclave', 'Defence Enclave', 13.0545, 77.649, ['defence enclave', 'defense enclave']],
      ['area-kalyan-nagar', 'Kalyan Nagar', 'Kalyan Nagar', 13.028, 77.64, ['kalyan nagar', 'kaliyan nagar']],
      ['area-horamavu', 'Horamavu', 'Horamavu', 13.03, 77.66, ['horamavu', 'hormavu']],
    ],
  },
  {
    id: 'kju-airport-road',
    collegeId: 'kju',
    name: 'Airport Road Campus',
    label: 'KJU Airport Rd',
    origin: { lat: 13.111, lng: 77.673, approx: true },
    pickupPoints: [['a1-auditorium', 'A1 auditorium']],
    landmarks: [
      ['a1-auditorium', 'A1 auditorium', 'Airport Road campus', 13.1112, 77.6732, ['a1', 'a1 auditorium']],
      ['cmr-university', 'CMR University', 'Chagalahatti', 13.115, 77.679, ['cmr', 'cmr university']],
      ['hennur-bagalur-road', 'Hennur-Bagalur Main Rd', 'Dasanayakanahalli', 13.106, 77.67, ['hennur bagalur road', 'bagalur main road', 'new airport road']],
      ['area-chagalahatti', 'Chagalahatti', 'Chagalahatti', 13.117, 77.676, ['chagalahatti']],
      ['area-dasanayakanahalli', 'Dasanayakanahalli', 'Dasanayakanahalli', 13.108, 77.67, ['dasanayakanahalli']],
      ['area-bagalur', 'Bagalur', 'Bagalur', 13.133, 77.669, ['bagalur', 'bagaluru', 'baglur']],
      ['area-kannur', 'Kannur', 'Kannur', 13.095, 77.66, ['kannur']],
      ['area-gubbi-cross', 'Gubbi Cross', 'Gubbi Cross', 13.079, 77.656, ['gubbi cross', 'gubbi']],
    ],
  },
  // PES
  {
    id: 'pes-ring-road',
    collegeId: 'pes',
    name: 'Ring Road',
    label: 'PES Ring Rd',
    origin: { lat: 12.9342, lng: 77.5343, approx: false },
    landmarks: [
      ['hosakerehalli', 'Hosakerehalli', 'Hosakerehalli', 12.93, 77.54, ['hosakerehalli']],
      ['banashankari-3rd-stage', 'Banashankari 3rd Stage', 'Banashankari', 12.928, 77.545, ['banashankari', 'bsk', 'bsk 3rd stage']],
      ['girinagar', 'Girinagar', 'Girinagar', 12.942, 77.538, ['girinagar']],
      ['kathriguppe', 'Kathriguppe', 'Kathriguppe', 12.927, 77.555, ['kathriguppe']],
    ],
  },
  {
    id: 'pes-electronic-city',
    collegeId: 'pes',
    name: 'Electronic City',
    label: 'PES E-City',
    origin: { lat: 12.8616, lng: 77.6645, approx: false },
    landmarks: [
      ['konappana-agrahara', 'Konappana Agrahara', 'Konappana Agrahara', 12.859, 77.664, ['konappana agrahara']],
      ['electronic-city-phase-1', 'Electronic City Phase 1', 'Electronic City', 12.845, 77.66, ['electronic city', 'ecity', 'e city']],
      ['neeladri-nagar', 'Neeladri Nagar', 'Doddathoguru', 12.851, 77.656, ['neeladri nagar', 'doddathoguru']],
    ],
  },
  // Presidency
  {
    id: 'presidency-main',
    collegeId: 'presidency',
    name: 'Main campus, Itgalpura',
    label: 'Presidency Main',
    origin: { lat: 13.1693192, lng: 77.5347979, approx: false },
    landmarks: [
      ['rajanukunte', 'Rajanukunte', 'Rajanukunte', 13.171, 77.56, ['rajanukunte', 'rajanakunte']],
      ['ittagalapura', 'Ittagalapura', 'Ittagalapura', 13.172, 77.53, ['ittagalapura', 'itgalpura', 'itgalpur']],
    ],
  },
  // REVA
  {
    id: 'reva-main',
    collegeId: 'reva',
    name: 'REVA University main campus, Rukmini Knowledge Park',
    label: 'REVA Main',
    origin: { lat: 13.1168745, lng: 77.6346118, approx: false },
    landmarks: [
      ['kattigenahalli', 'Kattigenahalli', 'Kattigenahalli', 13.118, 77.63, ['kattigenahalli']],
      ['bellahalli-circle', 'Bellahalli Circle', 'Bellahalli', 13.11, 77.638, ['bellahalli', 'bellahalli circle']],
      ['kogilu-cross', 'Kogilu Cross', 'Kogilu', 13.1, 77.62, ['kogilu', 'kogilu cross']],
    ],
  },
  // St Joseph's (no published coordinates: origins are estimates)
  {
    id: 'sju-main',
    collegeId: 'sju',
    name: 'Main Campus',
    label: 'SJU Main',
    origin: { lat: 12.96, lng: 77.596, approx: true },
    landmarks: [
      ['richmond-circle', 'Richmond Circle', 'Richmond Town', 12.962, 77.596, ['richmond circle', 'richmond town']],
      ['shanthinagar', 'Shanthinagar', 'Shanthinagar', 12.957, 77.6, ['shanthinagar', 'shanti nagar']],
      ['wilson-garden', 'Wilson Garden', 'Wilson Garden', 12.948, 77.597, ['wilson garden']],
      ['langford-town', 'Langford Town', 'Langford Town', 12.956, 77.605, ['langford', 'langford town']],
    ],
  },
  {
    id: 'sju-b-block',
    collegeId: 'sju',
    name: 'SJU B-Block',
    label: 'SJU B-Block',
    origin: { lat: 12.87, lng: 77.597, approx: true },
    landmarks: [
      ['kalena-agrahara', 'Kalena Agrahara', 'Kalena Agrahara', 12.87, 77.599, ['kalena agrahara']],
      ['meenakshi-temple', 'Meenakshi Temple', 'Kalena Agrahara', 12.872, 77.596, ['meenakshi temple']],
      ['gottigere', 'Gottigere', 'Gottigere', 12.858, 77.588, ['gottigere']],
      ['hulimavu', 'Hulimavu', 'Hulimavu', 12.877, 77.6, ['hulimavu']],
    ],
  },
];

const CAMPUSES: readonly Campus[] = deepFreeze(CAMPUS_SEEDS.map(buildCampus));

/** Extra campus-level search terms (sub-campus nicknames). */
const CAMPUS_ALIASES: Readonly<Record<string, readonly string[]>> = deepFreeze({
  'kju-main': ['main campus', 'kju main', 'kothanur campus', 'k narayanapura campus', 'central campus'],
  'kju-airport-road': [
    'airport campus',
    'airport road campus',
    'new campus',
    'new kju',
    'new kju campus',
    'airport kju campus',
    'kju bagaluru branch',
    'new airport road campus',
    'arc',
  ],
});

const COLLEGE_BY_ID = new Map<string, College>(COLLEGES.map((college) => [college.id, college]));
const CAMPUS_BY_ID = new Map<string, Campus>(CAMPUSES.map((campus) => [campus.id, campus]));

/** Lowercase, drop apostrophes and accents, turn other punctuation into spaces. */
export function normalizeSearch(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['‘’`.]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** 3 = exact term, 2 = a word starts with the query, 1 = substring (3+ chars), 0 = no match. */
function matchScore(query: string, terms: readonly string[]): number {
  let best = 0;
  for (const raw of terms) {
    const term = normalizeSearch(raw);
    if (!term) continue;
    if (term === query) return 3;
    if (term.startsWith(query) || term.includes(` ${query}`)) best = Math.max(best, 2);
    else if (query.length >= 3 && term.includes(query)) best = Math.max(best, 1);
  }
  return best;
}

export function listColleges(): readonly College[] {
  return COLLEGES;
}

export function listCampuses(): readonly Campus[] {
  return CAMPUSES;
}

export function getCollege(id: string | null | undefined): College | null {
  return id ? COLLEGE_BY_ID.get(id) ?? null : null;
}

export function getCampus(id: string | null | undefined): Campus | null {
  return id ? CAMPUS_BY_ID.get(id) ?? null : null;
}

export function campusesOf(collegeId: string | null | undefined): readonly Campus[] {
  return collegeId ? CAMPUSES.filter((campus) => campus.collegeId === collegeId) : [];
}

/** Header label such as 'KJU Main'. Falls back to 'Campus' for unknown ids. */
export function campusLabel(campusId: string | null | undefined): string {
  return getCampus(campusId)?.label ?? 'Campus';
}

/** Colleges matching a name, code, alias or campus name, best match first. */
export function searchColleges(query: string): College[] {
  const q = normalizeSearch(query);
  if (!q) return [];
  const scored: { college: College; score: number; index: number }[] = [];
  COLLEGES.forEach((college, index) => {
    const campusTerms = campusesOf(college.id).flatMap((campus) => [campus.name, campus.label, ...(CAMPUS_ALIASES[campus.id] ?? [])]);
    const direct = matchScore(q, [college.code, college.shortName, college.name, ...college.aliases]);
    const viaCampus = matchScore(q, campusTerms);
    const score = Math.max(direct, viaCampus - 0.5);
    if (score > 0) scored.push({ college, score, index });
  });
  return scored.sort((a, b) => b.score - a.score || a.index - b.index).map((entry) => entry.college);
}

/** Campuses matching a name, label or nickname ('new campus'), best match first. */
export function searchCampuses(query: string, collegeId?: string | null): Campus[] {
  const q = normalizeSearch(query);
  if (!q) return [];
  const pool = collegeId ? campusesOf(collegeId) : CAMPUSES;
  const scored: { campus: Campus; score: number; index: number }[] = [];
  pool.forEach((campus, index) => {
    const score = matchScore(q, [campus.name, campus.label, ...(CAMPUS_ALIASES[campus.id] ?? [])]);
    if (score > 0) scored.push({ campus, score, index });
  });
  return scored.sort((a, b) => b.score - a.score || a.index - b.index).map((entry) => entry.campus);
}

/** Landmarks near a campus matching a label, alias or area, best match first. */
export function searchLandmarks(campusId: string | null | undefined, query: string): Landmark[] {
  const campus = getCampus(campusId);
  const q = normalizeSearch(query);
  if (!campus || !q) return [];
  const scored: { landmark: Landmark; score: number; index: number }[] = [];
  campus.landmarks.forEach((landmark, index) => {
    const own = matchScore(q, [landmark.label, ...landmark.aliases]);
    const viaArea = matchScore(q, [landmark.area]);
    const score = Math.max(own, viaArea - 0.5);
    if (score > 0) scored.push({ landmark, score, index });
  });
  return scored.sort((a, b) => b.score - a.score || a.index - b.index).map((entry) => entry.landmark);
}

export function findLandmark(campusId: string | null | undefined, query: string): Landmark | null {
  return searchLandmarks(campusId, query)[0] ?? null;
}

function mergeCampus(campus: Campus, override: CampusOverride | undefined): Campus {
  if (!override) return campus;
  return {
    ...campus,
    label: override.label?.trim() ? override.label.trim() : campus.label,
    pickupPoints: override.pickupPoints ? [...override.pickupPoints] : campus.pickupPoints,
    landmarks: override.landmarks ? [...override.landmarks] : campus.landmarks,
  };
}

/**
 * The static college and its campuses with runtime overrides applied.
 * Arrays replace the static value. Unknown campus ids in the override are ignored.
 * The catalog itself is never mutated.
 */
export function mergeCollegeConfig(collegeId: string, override?: CollegeConfigOverride | null): CollegeConfig | null {
  const college = getCollege(collegeId);
  if (!college) return null;
  const campuses = campusesOf(college.id);
  if (!override) return { college, campuses };
  return {
    college: {
      ...college,
      launchState: override.launchState ?? college.launchState,
      emailDomains: override.emailDomains ? override.emailDomains.map((domain) => domain.trim().toLowerCase()).filter(Boolean) : college.emailDomains,
      semesterStarts: override.semesterStarts ? [...override.semesterStarts] : college.semesterStarts,
    },
    campuses: campuses.map((campus) => mergeCampus(campus, override.campuses?.[campus.id])),
  };
}
