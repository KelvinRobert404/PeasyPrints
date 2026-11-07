import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminDb } from '@/lib/firebase/admin';
import { CampusHttpError, campusErrorResponse, getCampusPrincipal } from '@/lib/campus/auth';
import { CAMPUS_COLLECTIONS } from '@/lib/campus/constants';
import {
  FAILURE_STATUS,
  cancelGame,
  cancelledTitle,
  joinGame,
  leaveGame,
  reminderPlan,
  reminderSlot,
  reminderTitle,
  toGameView,
  type GameRecord,
} from '@/lib/campus/games';
import { PICK_COLLEGE_FIRST_MESSAGE } from '@/lib/campus/membership';
import { enqueue } from '@/lib/campus/notify';
import { dedupeKey } from '@/lib/campus/notifySlots';
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rateLimit';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };
const PAGE_HREF = '/campus/games';
const KIND = 'game_update' as const;

const patchSchema = z.object({
  action: z.enum(['join', 'leave', 'cancel'], { errorMap: () => ({ message: 'Invalid request' }) }),
});

function notFound(): never {
  throw new CampusHttpError(404, 'Game not found');
}

/** Drops queued reminders for players who are no longer in the game. Best effort. */
async function dropReminders(userIds: readonly string[], gameId: string, game: GameRecord, now: Date): Promise<void> {
  const slot = reminderSlot(game.startsAt);
  if (slot.getTime() <= now.getTime() || userIds.length === 0) return;
  const collection = getAdminDb().collection(CAMPUS_COLLECTIONS.notifications);
  await Promise.all(
    userIds.map((userId) => collection.doc(dedupeKey({ userId, type: KIND, targetId: `game/${gameId}`, slot })).delete()),
  );
}

/** Join, leave, or (host only) cancel. Slots are checked and written in one transaction. */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!id || id.includes('/') || id.length > 200) notFound();
    const principal = await getCampusPrincipal({ requireVerified: true, product: 'games' });
    if (principal.blocked) throw new CampusHttpError(403, 'Your account is paused');
    const campus = principal.campus;
    if (!campus) throw new CampusHttpError(409, PICK_COLLEGE_FIRST_MESSAGE);
    const { action } = patchSchema.parse(await request.json());

    if (action === 'join') {
      const rate = await checkRateLimit('games-join', principal.userId, 30, 3600);
      if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
    }

    const db = getAdminDb();
    const ref = db.collection(CAMPUS_COLLECTIONS.games).doc(id);
    const now = new Date();
    const { before, next } = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) notFound();
      const game = snapshot.data() as GameRecord;
      // Games on other campuses do not exist for this viewer.
      if (game.campusId !== campus.id || game.status === 'removed') notFound();
      const result =
        action === 'join'
          ? joinGame(game, { userId: principal.userId, verified: true, now })
          : action === 'leave'
            ? leaveGame(game, principal.userId, now)
            : cancelGame(game, principal.userId, now);
      if (!result.ok) throw new CampusHttpError(FAILURE_STATUS[result.reason], result.message);
      const updatedAt = Timestamp.fromDate(now);
      transaction.update(ref, { playerIds: result.playerIds, status: result.status, updatedAt });
      return { before: game, next: { ...game, playerIds: result.playerIds, status: result.status, updatedAt } as GameRecord };
    });

    try {
      if (action === 'join') {
        const plan = reminderPlan(next.startsAt, now);
        if (plan) {
          await enqueue(
            [principal.userId],
            {
              kind: KIND,
              title: reminderTitle(next.sport, next.startsAt),
              body: next.place?.label ?? null,
              href: PAGE_HREF,
              ref: { type: 'game', id },
              urgent: plan.urgent,
              campusId: campus.id,
            },
            plan.urgent ? { now } : { now: plan.at },
          );
        }
      } else if (action === 'leave') {
        await dropReminders([principal.userId], id, next, now);
      } else {
        const others = before.playerIds.filter((userId) => userId !== principal.userId);
        await dropReminders(before.playerIds, id, next, now);
        await enqueue(others, {
          kind: KIND,
          title: cancelledTitle(next.sport),
          href: PAGE_HREF,
          ref: { type: 'game', id },
          urgent: true,
          campusId: campus.id,
          actorDisplayName: principal.displayName,
        });
      }
    } catch (error) {
      console.error('[games] notify failed', error);
    }

    return NextResponse.json({ game: toGameView(id, next, principal.userId, now) }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid request' }, { status: 400, headers: NO_STORE });
    }
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
    return campusErrorResponse(error);
  }
}
