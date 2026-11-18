import { SUPPORTER_TIERS } from '@/lib/supporterFlair';
import { formatSupporterDate } from '@/lib/supporterEndDate';
import { tierName } from '@/lib/tierNames';
import type { SupporterTier } from '@/types';

/** One stage of a listing's schedule. `opensAt` null means the tier opens at the public date, or never without one. */
export interface SupporterScheduleEntry {
  tier: SupporterTier;
  opensAt: string | null;
}

/** One line of the schedule mark. */
export interface SupporterScheduleStage {
  /** The tier key, or "public". */
  key: string;
  /** The tier's display name, or "Everyone" for the public date. */
  name: string;
  /** A formatted date, or "Not scheduled". */
  when: string;
}

/** The listing fields the schedule reads. */
export type ScheduledListing ={ supporter_only?: unknown; supporter_until?: unknown; supporterSchedule?: unknown };

/** Whether `value` is a tier key this build knows. */
export const isSupporterTier = (value: unknown): value is SupporterTier =>
  typeof value === 'string' && (SUPPORTER_TIERS as readonly string[]).includes(value);

const TOP_TIER = SUPPORTER_TIERS[SUPPORTER_TIERS.length - 1];

/** Tiers rank in `SUPPORTER_TIERS` order, lowest first. */
const rankOf = (tier: SupporterTier): number => SUPPORTER_TIERS.indexOf(tier);

/** The entries of a payload's `supporterSchedule`, highest tier first. Unknown tiers and malformed entries drop out. */
export function parseSupporterSchedule(value: unknown): SupporterScheduleEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: SupporterScheduleEntry[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const { tier, opensAt } = raw as { tier?: unknown; opensAt?: unknown };
    if (!isSupporterTier(tier)) continue;
    if (opensAt !== null && typeof opensAt !== 'string') continue;
    entries.push({ tier, opensAt });
  }

  return entries.sort((a, b) => rankOf(b.tier) - rankOf(a.tier));
}

/** The time a date string names, or null when it names none. */
const timeOf = (value: unknown): number | null => {
  if (typeof value !== 'string') return null;
  const time = Date.parse(value);

  return Number.isNaN(time) ? null : time;
};

/**
 * The lowest tier that may download a Supporter-only listing now. A listing with no tier rows is open to
 * every tier. The top tier has no row and is always open.
 */
export function openTierNow(listing: ScheduledListing, now = Date.now()): SupporterTier {
  const entries = parseSupporterSchedule(listing.supporterSchedule);
  if (entries.length === 0) return SUPPORTER_TIERS[0];
  const publicAt = timeOf(listing.supporter_until) ?? Infinity;
  const opens = (tier: SupporterTier): number => {
    const own = entries.find((entry) => entry.tier === tier);

    return timeOf(own?.opensAt) ?? publicAt;
  };

  // The top tier has no row and is always open, so the scan ends there at the latest.
  return SUPPORTER_TIERS.find((tier) => tier === TOP_TIER || opens(tier) <= now) ?? TOP_TIER;
}

/** Whether an account on `tier` is below the tier the listing is open to now. */
export const belowOpenTier = (tier: SupporterTier | null, listing: ScheduledListing, now = Date.now()): boolean =>
  !!tier && rankOf(tier) < rankOf(openTierNow(listing, now));

/**
 * The lines of the schedule mark: each tier row, then the public date. Empty for a listing with no tier
 * rows, which keeps today's end-date mark.
 */
export function scheduleStages(listing: ScheduledListing): SupporterScheduleStage[] {
  if (listing.supporter_only !== true) return [];
  const entries = parseSupporterSchedule(listing.supporterSchedule);
  if (entries.length === 0) return [];
  const publicAt = timeOf(listing.supporter_until);
  const notScheduled = 'Not scheduled';
  // The top tier has no row: it is open for as long as the listing is Supporter-only.
  const stages: SupporterScheduleStage[] = [{ key: TOP_TIER, name: tierName(TOP_TIER), when: 'Open now' }];
  for (const entry of entries) {
    const time = timeOf(entry.opensAt) ?? publicAt;
    stages.push({ key: entry.tier, name: tierName(entry.tier), when: time === null ? notScheduled : formatSupporterDate(new Date(time)) });
  }
  stages.push({ key: 'public', name: 'Everyone', when: publicAt === null ? notScheduled : formatSupporterDate(new Date(publicAt)) });

  return stages;
}

/** What a refusal for a tier that isn't open yet says, from the server's `requiredTier` and `opensAt`. */
export function tierNotOpenMessage(requiredTier: SupporterTier, opensAt: string | null): string {
  const time = timeOf(opensAt);
  const open = `This listing is open to the ${tierName(requiredTier)} tier now.`;

  return time === null ? `${open} Your tier isn't scheduled yet.` : `${open} It opens to your tier on ${formatSupporterDate(new Date(time))}.`;
}
