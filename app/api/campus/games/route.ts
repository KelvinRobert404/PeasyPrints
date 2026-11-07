import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminDb } from '@/lib/firebase/admin';
import { CampusHttpError, campusErrorResponse, getCampusPrincipal, type CampusPrincipal } from '@/lib/campus/auth';
import { CAMPUS_COLLECTIONS } from '@/lib/campus/constants';
import {
  GAME_LENGTH_MS,
  MAX_CAPACITY,
  MIN_CAPACITY,
  SPORTS,
  checkStartsAt,
  gameTitle,
  isOver,
  reminderPlan,
  reminderTitle,
  toGameView,
  type GameRecord,
  type PickupSport,
} from '@/lib/campus/games';
import { PICK_COLLEGE_FIRST_MESSAGE } from '@/lib/campus/membership';
import { enqueue } from '@/lib/campus/notify';
import { haversineMeters, roundForPrivacy } from '@/lib/format/distance';
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rateLimit';
import type { CampusRef, ListingPlace } from '@/types/campus';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };
const FEED_LIMIT = 100;
const PAGE_HREF = '/campus/games';

const createSchema = z.object({
  sport: z.enum(SPORTS as unknown as [PickupSport, ...PickupSport[]], { errorMap: () => ({ message: 'Pick a sport' }) }),
  landmarkId: z.string({ required_error: 'Pick a place' }).trim().min(1, 'Pick a place').max(80),
  startsAt: z.string({ required_error: 'Pick a start time' }).datetime({ offset: true, message: 'Pick a start time' }),
  capacity: z
    .number({ invalid_type_error: 'Pick how many players' })
    .int('Pick how many players')
    .min(MIN_CAPACITY, `At least ${MIN_CAPACITY} players`)
    .max(MAX_CAPACITY, `Up to ${MAX_CAPACITY} players`),
});

type GamesPrincipal = CampusPrincipal & { campus: CampusRef };

async function gamesPrincipal(): Promise<GamesPrincipal> {
  const principal = await getCampusPrincipal({ requireVerified: true, product: 'games' });
  if (principal.blocked) throw new CampusHttpError(403, 'Your account is paused');
  if (!principal.campus) throw new CampusHttpError(409, PICK_COLLEGE_FIRST_MESSAGE);
  return principal as GamesPrincipal;
}

/** The venue: a landmark of the host's own campus, never a typed place. */
function resolveVenue(principal: GamesPrincipal, landmarkId: string): ListingPlace {
  const campus = principal.config?.campuses.find((item) => item.id === principal.campus.id);
  if (!campus) throw new CampusHttpError(409, PICK_COLLEGE_FIRST_MESSAGE);
  const landmark = campus.landmarks.find((item) => item.id === landmarkId);
  if (!landmark) throw new CampusHttpError(400, 'Pick a place from the list');
  return {
    landmarkId: landmark.id,
    label: landmark.label,
    area: landmark.area,
    lat: landmark.lat,
    lng: landmark.lng,
    campusId: campus.id,
    roughDistanceM: roundForPrivacy(haversineMeters(campus.origin, landmark)),
  };
}

/** Games on the viewer's campus that are not over, soonest first. */
export async function GET() {
  try {
    const principal = await gamesPrincipal();
    const now = new Date();
    // Index: campusId asc, startsAt asc. Games that started under two hours ago still show.
    const snapshot = await getAdminDb()
      .collection(CAMPUS_COLLECTIONS.games)
      .where('campusId', '==', principal.campus.id)
      .where('startsAt', '>=', Timestamp.fromMillis(now.getTime() - GAME_LENGTH_MS))
      .orderBy('startsAt', 'asc')
      .limit(FEED_LIMIT)
      .get();
    const games = snapshot.docs
      .map((doc) => ({ id: doc.id, game: doc.data() as GameRecord }))
      .filter(({ game }) => !isOver(game, now))
      .map(({ id, game }) => toGameView(id, game, principal.userId, now));
    return NextResponse.json({ games, campus: principal.campus }, { headers: NO_STORE });
  } catch (error) {
    return campusErrorResponse(error);
  }
}

/** Hosts a game. The host takes the first slot. */
export async function POST(request: NextRequest) {
  try {
    const principal = await gamesPrincipal();
    const input = createSchema.parse(await request.json());
    const now = new Date();
    const start = checkStartsAt(input.startsAt, now);
    if (!start.ok) throw new CampusHttpError(400, start.message);
    const place = resolveVenue(principal, input.landmarkId);

    const rate = await checkRateLimit('games-host', principal.userId, 5, 24 * 3600);
    if (!rate.allowed) return rateLimitResponse(rate.retryAfter);

    const stamp = Timestamp.fromDate(now);
    const startsAt = Timestamp.fromDate(new Date(input.startsAt));
    const record: GameRecord = {
      authorId: principal.userId,
      campusId: principal.campus.id,
      sport: input.sport,
      level: 'casual',
      status: 'open',
      title: gameTitle(input.sport, place.label),
      note: null,
      place,
      startsAt,
      playersNeeded: input.capacity,
      playerIds: [principal.userId],
      posterDisplayName: principal.displayName,
      createdAt: stamp,
      updatedAt: stamp,
    };
    const ref = getAdminDb().collection(CAMPUS_COLLECTIONS.games).doc();
    await ref.set(record);

    const plan = reminderPlan(startsAt, now);
    if (plan) {
      try {
        await enqueue(
          [principal.userId],
          {
            kind: 'game_update',
            title: reminderTitle(input.sport, startsAt),
            body: place.label,
            href: PAGE_HREF,
            ref: { type: 'game', id: ref.id },
            urgent: plan.urgent,
            campusId: principal.campus.id,
          },
          plan.urgent ? { now } : { now: plan.at },
        );
      } catch (error) {
        console.error('[games] reminder failed', error);
      }
    }

    return NextResponse.json({ game: toGameView(ref.id, record, principal.userId, now) }, { status: 201, headers: NO_STORE });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid game' }, { status: 400, headers: NO_STORE });
    }
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'Invalid game' }, { status: 400, headers: NO_STORE });
    return campusErrorResponse(error);
  }
}
