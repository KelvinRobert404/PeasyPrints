// Utility fixtures: deals, lost and found, blood donors and requests, games.
// Dates are relative to seed time.
import type { BloodDonorDoc, BloodRequestDoc, DealDoc, GameDoc, LostFoundDoc } from '@/types/utilities';
import { KJU_AIRPORT, KJU_MAIN, displayNameOf, fixtureTime, landmarkPlace, type FixtureDoc } from './core.ts';

/** createdBy on deals Swoop seeds as examples. The UI can label these 'Sample'. */
export const SAMPLE_DEAL_CREATOR = 'swoop-sample';

const main = (slug: string) => landmarkPlace(KJU_MAIN, slug);
const airport = (slug: string) => landmarkPlace(KJU_AIRPORT, slug);

/* Deals (campus_deals): live, expired and a sample. */

export function buildDeals(now: Date): FixtureDoc<DealDoc>[] {
  const at = (days: number) => fixtureTime(now, days);
  return [
    {
      id: 'deal-prints',
      data: {
        campusId: KJU_MAIN,
        category: 'printing',
        status: 'active',
        merchantName: 'Gulabi Road Xerox',
        title: 'Cheaper black and white prints',
        offer: '10% off with student ID',
        code: null,
        howToClaim: 'Show your Swoop card at the counter.',
        place: main('area-gulabi-road'),
        images: [],
        validUntil: at(20),
        createdBy: 'admin',
        createdAt: at(-5),
        updatedAt: at(-5),
      },
    },
    {
      id: 'deal-gym',
      data: {
        campusId: KJU_MAIN,
        category: 'fitness',
        status: 'active',
        merchantName: 'Iron Den Fitness',
        title: 'Student gym plan',
        offer: '30% off the monthly plan',
        code: 'KJUFIT30',
        howToClaim: 'Use the code at the front desk.',
        place: main('area-byrathi'),
        images: [],
        validUntil: at(10),
        createdBy: 'admin',
        createdAt: at(-8),
        updatedAt: at(-8),
      },
    },
    {
      id: 'deal-stationery-expired',
      data: {
        campusId: KJU_MAIN,
        category: 'stationery',
        status: 'expired',
        merchantName: 'Campus Corner Stationery',
        title: 'Exam week stationery offer',
        offer: 'Buy two record books, get one free',
        code: null,
        howToClaim: null,
        place: main('st-marys-church'),
        images: [],
        validUntil: at(-3),
        createdBy: 'admin',
        createdAt: at(-30),
        updatedAt: at(-3),
      },
    },
    {
      id: 'deal-sample-binding',
      data: {
        campusId: KJU_MAIN,
        category: 'printing',
        status: 'active',
        merchantName: 'Sample shop',
        title: 'Sample: free spiral binding',
        offer: 'Free binding on prints over Rs 200',
        code: null,
        howToClaim: 'This is a sample deal to show the layout.',
        place: null,
        images: [],
        validUntil: null,
        createdBy: SAMPLE_DEAL_CREATOR,
        createdAt: at(-1),
        updatedAt: at(-1),
      },
    },
    {
      id: 'deal-airport-travel',
      data: {
        campusId: KJU_AIRPORT,
        category: 'travel',
        status: 'active',
        merchantName: 'Bagalur Bike Rentals',
        title: 'Weekend scooter rental',
        offer: 'Rs 100 off any weekend booking',
        code: 'SWOOP100',
        howToClaim: 'Quote the code when you book.',
        place: airport('area-bagalur'),
        images: [],
        validUntil: at(14),
        createdBy: 'admin',
        createdAt: at(-2),
        updatedAt: at(-2),
      },
    },
    {
      id: 'deal-airport-prints',
      data: {
        campusId: KJU_AIRPORT,
        category: 'printing',
        status: 'active',
        merchantName: 'Gate Two Prints',
        title: 'Colour prints at student rates',
        offer: '20% off colour prints',
        code: null,
        howToClaim: 'Show your Swoop card at the counter.',
        place: airport('a1-auditorium'),
        images: [],
        validUntil: at(12),
        createdBy: 'admin',
        createdAt: at(-3),
        updatedAt: at(-3),
      },
    },
  ];
}

/* Lost and found (lost_found), including a found ID card. */

export function buildLostFound(now: Date): FixtureDoc<LostFoundDoc>[] {
  const at = (days: number) => fixtureTime(now, days);
  const post = (id: string, author: string, data: Omit<LostFoundDoc, 'authorId' | 'posterDisplayName'>): FixtureDoc<LostFoundDoc> => ({
    id,
    data: { authorId: author, posterDisplayName: displayNameOf(author), ...data },
  });
  return [
    post('lf-id-card', 'student-farhan', {
      campusId: KJU_MAIN,
      kind: 'found',
      category: 'id_card',
      status: 'open',
      title: 'Found a KJU ID card near the library',
      description: 'Name starts with S. Second year BCom.',
      images: [],
      place: main('st-marys-church'),
      happenedAt: at(-0.2),
      keptAt: 'Security desk, Main Block',
      createdAt: at(-0.2),
      updatedAt: at(-0.2),
    }),
    post('lf-keys', 'verified-kju-main', {
      campusId: KJU_MAIN,
      kind: 'lost',
      category: 'keys',
      status: 'open',
      title: 'Lost a bunch of keys',
      description: 'Three keys on a red keychain.',
      images: [],
      place: main('area-gulabi-road'),
      happenedAt: at(-1),
      keptAt: null,
      createdAt: at(-1),
      updatedAt: at(-1),
    }),
    post('lf-bottle', 'student-sneha', {
      campusId: KJU_MAIN,
      kind: 'lost',
      category: 'bottle',
      status: 'returned',
      title: 'Blue steel bottle, got it back',
      description: 'Thanks to whoever handed it in.',
      images: [],
      place: null,
      happenedAt: at(-4),
      keptAt: null,
      createdAt: at(-4),
      updatedAt: at(-2),
    }),
    post('lf-earphones', 'verified-kju-airport', {
      campusId: KJU_AIRPORT,
      kind: 'found',
      category: 'electronics',
      status: 'open',
      title: 'Found earphones in A1 auditorium',
      description: 'White case. Left on a back row seat.',
      images: [],
      place: airport('a1-auditorium'),
      happenedAt: at(-0.5),
      keptAt: 'With me, ask to collect',
      createdAt: at(-0.5),
      updatedAt: at(-0.5),
    }),
  ];
}

/* Blood: an open request, a fulfilled one, and willing donors. */

export function buildBloodRequests(now: Date): FixtureDoc<BloodRequestDoc>[] {
  const at = (days: number) => fixtureTime(now, days);
  return [
    {
      id: 'blood-open',
      data: {
        authorId: 'student-joel',
        campusId: KJU_MAIN,
        bloodGroup: 'B+',
        units: 2,
        urgency: 'today',
        status: 'open',
        hospital: 'Falcon Hospital',
        area: 'Gulabi Road',
        forWhom: "Friend's father",
        neededBy: at(0.5),
        posterDisplayName: displayNameOf('student-joel'),
        createdAt: at(-0.1),
        updatedAt: at(-0.1),
      },
    },
    {
      id: 'blood-fulfilled',
      data: {
        authorId: 'girls-approved',
        campusId: KJU_MAIN,
        bloodGroup: 'O-',
        units: 1,
        urgency: 'now',
        status: 'fulfilled',
        hospital: 'Good Health Hospital',
        area: 'K Narayanapura',
        forWhom: 'Classmate',
        neededBy: at(-6),
        posterDisplayName: displayNameOf('girls-approved'),
        createdAt: at(-6.2),
        updatedAt: at(-6),
      },
    },
  ];
}

export function buildBloodDonors(now: Date): FixtureDoc<BloodDonorDoc>[] {
  const at = (days: number) => fixtureTime(now, days);
  const donor = (userId: string, campusId: string, bloodGroup: BloodDonorDoc['bloodGroup'], available: boolean, lastDonatedDaysAgo: number | null) => ({
    id: userId,
    data: {
      userId,
      campusId,
      bloodGroup,
      available,
      lastDonatedAt: lastDonatedDaysAgo === null ? null : at(-lastDonatedDaysAgo),
      updatedAt: at(-3),
    },
  });
  return [
    donor('verified-kju-main', KJU_MAIN, 'B+', true, null),
    donor('student-farhan', KJU_MAIN, 'B+', true, 150),
    donor('girls-approved', KJU_MAIN, 'O-', false, 6),
    donor('student-vivek', KJU_MAIN, 'A+', true, 200),
    donor('verified-kju-airport', KJU_AIRPORT, 'O+', true, null),
  ];
}

/* Games (campus_games): open, full and one already played. */

export function buildGames(now: Date): FixtureDoc<GameDoc>[] {
  const at = (days: number) => fixtureTime(now, days);
  const game = (id: string, author: string, data: Omit<GameDoc, 'authorId' | 'posterDisplayName'>): FixtureDoc<GameDoc> => ({
    id,
    data: { authorId: author, posterDisplayName: displayNameOf(author), ...data },
  });
  return [
    game('game-football-open', 'student-aditya', {
      campusId: KJU_MAIN,
      sport: 'football',
      level: 'casual',
      status: 'open',
      title: 'Five a side football tomorrow',
      note: 'Bring water. Turf is booked for an hour.',
      place: main('area-hennur'),
      startsAt: at(1),
      playersNeeded: 10,
      playerIds: ['student-aditya', 'student-farhan', 'student-joel', 'student-rahul', 'verified-kju-main', 'student-vivek'],
      createdAt: at(-1),
      updatedAt: at(-0.3),
    }),
    game('game-badminton-full', 'girls-approved', {
      campusId: KJU_MAIN,
      sport: 'badminton',
      level: 'serious',
      status: 'full',
      title: 'Badminton doubles after class',
      note: 'Sports Arena court two.',
      place: null,
      startsAt: at(0.3),
      playersNeeded: 4,
      playerIds: ['girls-approved', 'student-tanvi', 'student-priya', 'student-sneha'],
      createdAt: at(-2),
      updatedAt: at(-0.5),
    }),
    game('game-cricket-done', 'student-farhan', {
      campusId: KJU_MAIN,
      sport: 'cricket',
      level: 'casual',
      status: 'done',
      title: 'Sunday cricket on the ground',
      note: 'Tennis ball game. Good one, same time next week.',
      place: main('area-k-narayanapura'),
      startsAt: at(-2),
      playersNeeded: 12,
      playerIds: ['student-farhan', 'student-joel', 'student-rahul', 'student-vivek', 'student-aditya', 'verified-kju-main'],
      createdAt: at(-5),
      updatedAt: at(-2),
    }),
    game('game-chess-airport', 'verified-kju-airport', {
      campusId: KJU_AIRPORT,
      sport: 'chess',
      level: 'casual',
      status: 'open',
      title: 'Chess in the library lounge',
      note: 'Beginners welcome. I have two boards.',
      place: airport('a1-auditorium'),
      startsAt: at(2),
      playersNeeded: 4,
      playerIds: ['verified-kju-airport'],
      createdAt: at(-0.5),
      updatedAt: at(-0.5),
    }),
  ];
}
