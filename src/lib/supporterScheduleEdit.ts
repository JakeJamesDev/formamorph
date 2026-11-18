import { SUPPORTER_TIERS } from '@/lib/supporterFlair';
import { MAX_SUPPORTER_DAYS, parseSupporterDays } from '@/lib/supporterEndDate';
import { parseSupporterSchedule } from '@/lib/supporterSchedule';
import type { ScheduledListing } from '@/lib/supporterSchedule';
import type { SupporterTier } from '@/types';

const DAY_MS = 86_400_000;

/** The stages in the order they run: highest tier first. */
export const SCHEDULE_STAGES: readonly SupporterTier[] = [...SUPPORTER_TIERS].reverse();

/** The tiers whose opening date the server stores: every tier below the top, highest first. */
export const SCHEDULE_ROW_TIERS: readonly SupporterTier[] = SCHEDULE_STAGES.slice(1);

/** The days form of `supporterSchedule`, counted from the request. */
export interface SupporterDaysSchedule {
  days: Partial<Record<SupporterTier, number>>;
  goPublic: boolean;
}

/** The dates form of `supporterSchedule`: every lower tier named, null meaning "with the public date". */
export interface SupporterDatesSchedule {
  opensAt: Partial<Record<SupporterTier, string | null>>;
  publicAt: string | null;
}

/** One row of the dates the admin sees under the days fields. */
export interface PlannedStage {
  tier: SupporterTier;
  /** When the tier opens; null when it opens with a public date that never comes. */
  opensAt: Date | null;
}

/** What the days fields produce. */
export interface PlannedSchedule {
  /** The request body, or null when every field is blank. */
  payload: SupporterDaysSchedule | null;
  stages: PlannedStage[];
  /** When the listing goes public; null when it stays Supporter-only. */
  publicAt: Date | null;
  /** The tiers whose field holds something the server would refuse. */
  invalid: SupporterTier[];
}

export type DaysText = Partial<Record<SupporterTier, string>>;

/**
 * Plan a schedule from the days fields, as the server converts them. Blank fields are skipped stages; a
 * skipped stage opens with the next one down.
 */
export function planSchedule(text: DaysText, goPublic: boolean, now = Date.now()): PlannedSchedule {
  const days: SupporterDaysSchedule['days'] = {};
  const invalid: SupporterTier[] = [];
  for (const tier of SCHEDULE_STAGES) {
    const raw = (text[tier] ?? '').trim();
    if (raw === '') continue;
    const parsed = parseSupporterDays(raw);
    if (parsed === null) invalid.push(tier);
    else days[tier] = parsed;
  }

  const last = SCHEDULE_STAGES.reduce((found, tier, index) => (days[tier] === undefined ? found : index), -1);
  const stages: PlannedStage[] = [];
  let at = now;
  SCHEDULE_STAGES.forEach((tier, index) => {
    stages.push({ tier, opensAt: last >= 0 && index > last ? null : new Date(at) });
    const own = days[tier];
    if (own !== undefined) at += own * DAY_MS;
  });
  const publicAt = last >= 0 && goPublic ? new Date(at) : null;
  // A stage below the last one opens with the public date, or never without one.
  const resolved = stages.map((stage) => (stage.opensAt === null ? { ...stage, opensAt: publicAt } : stage));

  return {
    payload: last >= 0 && invalid.length === 0 ? { days, goPublic } : null,
    stages: resolved,
    publicAt,
    invalid,
  };
}

/** The range hint for a days field. */
export const SCHEDULE_DAYS_RANGE = `Enter a whole number from 1 to ${MAX_SUPPORTER_DAYS}`;

const pad = (value: number): string => String(value).padStart(2, '0');

/** A date as a `datetime-local` input writes it, in the reader's time zone. Blank for none. */
export function toInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The form of a stored schedule: one input value per lower tier, and the public date. */
export interface ScheduleForm {
  opensAt: Partial<Record<SupporterTier, string>>;
  publicAt: string;
}

/** The values a stored listing prefills the edit dialog with. A listing with no stages has every tier open already, so its tiers prefill as now. */
export function formFromListing(listing: ScheduledListing, now = Date.now()): ScheduleForm {
  const entries = parseSupporterSchedule(listing.supporterSchedule);
  const openNow = entries.length === 0 ? new Date(now).toISOString() : null;
  const opensAt: ScheduleForm['opensAt'] = {};
  for (const tier of SCHEDULE_ROW_TIERS) {
    const stored = openNow ?? entries.find((entry) => entry.tier === tier)?.opensAt;
    opensAt[tier] = toInputValue(stored);
  }

  return { opensAt, publicAt: toInputValue(typeof listing.supporter_until === 'string' ? listing.supporter_until : null) };
}

/** The ISO form of an input value, or null when it is blank or not a date. A value that matches its prefill keeps the stored instant. */
function isoOf(value: string, original: string | null): string | null | undefined {
  if (value.trim() === '') return null;
  if (original && toInputValue(original) === value) return original;
  const time = new Date(value).getTime();

  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
}

/**
 * The dates form for the edit dialog's values, or null when a field holds something that is not a date.
 * An untouched field sends the stored instant, so a stage the admin did not change does not move.
 */
export function datesFromForm(form: ScheduleForm, listing: ScheduledListing): SupporterDatesSchedule | null {
  const entries = parseSupporterSchedule(listing.supporterSchedule);
  const opensAt: SupporterDatesSchedule['opensAt'] = {};
  for (const tier of SCHEDULE_ROW_TIERS) {
    const iso = isoOf(form.opensAt[tier] ?? '', entries.find((entry) => entry.tier === tier)?.opensAt ?? null);
    if (iso === undefined) return null;
    opensAt[tier] = iso;
  }
  const publicAt = isoOf(form.publicAt, typeof listing.supporter_until === 'string' ? listing.supporter_until : null);
  if (publicAt === undefined) return null;

  return { opensAt, publicAt };
}
