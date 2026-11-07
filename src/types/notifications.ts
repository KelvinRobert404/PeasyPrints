import type { DocTime, SerializedDoc } from './campus';

export type NotificationKind =
  | 'contact_request'
  | 'contact_approved'
  | 'contact_declined'
  | 'reserve_request'
  | 'reserve_expiring'
  | 'reserve_lapsed'
  | 'price_drop'
  | 'listing_nudge'
  | 'listing_expired'
  | 'verification_approved'
  | 'verification_rejected'
  | 'blood_request'
  | 'lost_found_match'
  | 'game_update'
  | 'new_deal';

/** What a notification points at. */
export type NotificationTarget =
  | 'market_listing'
  | 'housing_listing'
  | 'contact_request'
  | 'deal'
  | 'lost_found'
  | 'blood_request'
  | 'game'
  | 'membership';

export interface NotificationRef {
  type: NotificationTarget;
  id: string;
}

export interface NotificationDoc {
  userId: string;
  campusId: string | null;
  kind: NotificationKind;
  /** One short line, under 10 words. */
  title: string;
  body: string | null;
  /** In-app path to open, e.g. '/market/abc'. */
  href: string | null;
  ref: NotificationRef | null;
  actorDisplayName: string | null;
  read: boolean;
  readAt: DocTime | null;
  createdAt: DocTime;
}

export type CampusNotification = Omit<SerializedDoc<NotificationDoc>, 'userId'> & {
  id: string;
};

export interface NotificationPrefsDoc {
  userId: string;
  push: boolean;
  /** Per-kind switch. Missing means on. */
  kinds: Partial<Record<NotificationKind, boolean>>;
  updatedAt: DocTime;
}

export type NotificationPrefs = Omit<SerializedDoc<NotificationPrefsDoc>, 'userId'>;
