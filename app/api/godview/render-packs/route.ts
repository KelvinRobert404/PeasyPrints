import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminDb } from '@/lib/firebase/admin';
import { CampusHttpError, campusErrorResponse, requireAdminPrincipal } from '@/lib/campus/auth';
import { CAMPUS_COLLECTIONS, MARKET_CATEGORY_LABELS, MARKET_KIND_LABELS } from '@/lib/campus/constants';
import { toIso } from '@/lib/campus/serialize';
import { serializeMarketListing, type MarketDocSnapshot, type SerializedMarketListing } from '@/lib/campus/marketSerialize';
import { serializeHousingListing, type SerializedHousingListing } from '@/lib/campus/housing/serialize';
import { HOUSING_KIND_LABELS } from '@/lib/campus/housing/model';
import { formatPrice } from '@/lib/format/price';

const createSchema = z.object({
  type: z.enum(['marketplace', 'housing']),
  contentIds: z.array(z.string().min(1).max(100)).max(8),
  templateId: z.string().min(1).max(80),
});

/** Admin reads: no viewer, so no distance or owner flags. */
const ADMIN_VIEWER = '__admin__';
const LIVE_STATUSES: ReadonlySet<string> = new Set(['active', 'reserved']);

/** 'Rs 1.5k', 'Rs 400 pp', 'Free' or 'Swap'. Never the rupee sign. */
function marketPriceLabel(item: SerializedMarketListing): string {
  if (item.priceTerms === 'free' || item.price === 0) return 'Free';
  if (item.price === null) return item.priceTerms === 'swap' ? 'Swap' : 'Ask for details';
  return item.priceTerms === 'per_person' ? formatPrice(item.price, 'pp') : formatPrice(item.price);
}

/** Housing rent is per person: 'Rs 8.5k pp'. */
function housingPriceLabel(item: SerializedHousingListing): string {
  return item.rentPp > 0 ? formatPrice(item.rentPp, 'pp') : 'Ask for details';
}

/** What it is (the category for a plain item), then where. */
function marketMetadata(item: SerializedMarketListing): string[] {
  const what = item.kind === 'item' ? MARKET_CATEGORY_LABELS[item.category] : MARKET_KIND_LABELS[item.kind];
  return [what, item.place?.label || item.place?.area].filter((value): value is string => Boolean(value));
}

function housingMetadata(item: SerializedHousingListing): string[] {
  return [item.place.label || item.place.area, HOUSING_KIND_LABELS[item.kind]].filter((value): value is string => Boolean(value));
}

type PackListing = SerializedMarketListing | SerializedHousingListing;

/** One reel card. Only live campus posts open for promotion qualify. */
function packItem(type: 'marketplace' | 'housing', snapshot: MarketDocSnapshot, origin: string) {
  let listing: PackListing;
  let priceLabel: string;
  let metadata: string[];
  if (type === 'marketplace') {
    const market = serializeMarketListing(snapshot, ADMIN_VIEWER);
    [listing, priceLabel, metadata] = [market, marketPriceLabel(market), marketMetadata(market)];
  } else {
    const housing = serializeHousingListing(snapshot, ADMIN_VIEWER);
    [listing, priceLabel, metadata] = [housing, housingPriceLabel(housing), housingMetadata(housing)];
  }
  if (listing.audience !== 'campus' || !listing.promotionEligible || !LIVE_STATUSES.has(listing.status)) {
    throw new CampusHttpError(409, `${listing.serial || snapshot.id} is not eligible for public promotion`);
  }
  const imagePath = listing.images[0] || '';
  const mediaId = imagePath.match(/\/api\/campus\/media\/([^/?]+)/)?.[1] || null;
  return {
    id: snapshot.id,
    serial: listing.serial,
    title: listing.title,
    mediaId,
    collegeCode: listing.collegeCode,
    priceLabel,
    metadata,
    deepLink: `${origin}/${type}/${snapshot.id}`,
  };
}

export async function GET() {
  try {
    await requireAdminPrincipal();
    const snapshot = await getAdminDb().collection('campus_render_packs').limit(100).get();
    const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data(), createdAt: toIso(doc.data().createdAt), updatedAt: toIso(doc.data().updatedAt), propsSnapshot: undefined }));
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return NextResponse.json({ items });
  } catch (error) {
    return campusErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminPrincipal();
    const body = createSchema.parse(await request.json());
    if (new Set(body.contentIds).size !== body.contentIds.length) return NextResponse.json({ error: 'A post can only appear once in a reel' }, { status: 400 });
    const minimum = body.type === 'marketplace' ? 4 : 3;
    const maximum = body.type === 'marketplace' ? 8 : 5;
    if (body.contentIds.length < minimum || body.contentIds.length > maximum) {
      return NextResponse.json({ error: `${body.type === 'marketplace' ? 'Marketplace' : 'Housing'} packs require ${minimum}–${maximum} posts` }, { status: 400 });
    }
    const collection = body.type === 'marketplace' ? CAMPUS_COLLECTIONS.market : CAMPUS_COLLECTIONS.housing;
    const snapshots = await Promise.all(body.contentIds.map((id) => getAdminDb().collection(collection).doc(id).get()));
    if (snapshots.some((snapshot) => !snapshot.exists)) throw new CampusHttpError(404, 'One or more selected posts no longer exist');
    const origin = request.nextUrl.origin;
    const items = snapshots.map((snapshot) => packItem(body.type, snapshot, origin));
    const ref = getAdminDb().collection('campus_render_packs').doc();
    const now = Timestamp.now();
    await ref.set({
      type: body.type,
      templateId: body.templateId,
      compositionId: body.type === 'marketplace' ? 'PeasyMarketplaceReel' : 'PeasyHousingReel',
      status: 'queued',
      requestedBy: admin.email,
      propsSnapshot: {
        packId: ref.id,
        brand: 'Swoop',
        college: { code: 'KJU', name: 'Kristu Jayanti University' },
        items,
      },
      assets: [],
      createdAt: now,
      updatedAt: now,
      lockedAt: null,
      lockedBy: null,
    });
    return NextResponse.json({ id: ref.id, status: 'queued' }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid render pack' }, { status: 400 });
    return campusErrorResponse(error);
  }
}
