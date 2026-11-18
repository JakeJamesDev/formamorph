import { beforeEach, describe, expect, it } from 'vitest';
import { formatSupporterDate } from '@/lib/supporterEndDate';
import { supporterListingAction } from '@/lib/supporterListingAction';
import { belowOpenTier, openTierNow, parseSupporterSchedule, scheduleStages } from '@/lib/supporterSchedule';
import { seedTierNamesForTest } from '@/lib/tierNames';
import type { SupporterTier } from '@/types';

const NOW = Date.UTC(2026, 10, 18);
const DAY = 86_400_000;
const at = (days: number) => new Date(NOW + days * DAY).toISOString();

/** A three-stage listing: Flame opens in 5 days, Spark in 10, everyone in 15. The top tier is open now. */
const staged = () => ({
  supporter_only: true,
  supporter_until: at(15),
  supporterSchedule: [
    { tier: 'supporter_plus', opensAt: at(5) },
    { tier: 'supporter', opensAt: at(10) },
  ],
});

const ITEM = { id: 'w1', kind: 'world', revision: 1 };
const snapshot = (tier: SupporterTier | null, qualifies = true) => ({
  status: 'ready' as const, qualifies, tier, entitled: qualifies ? [ITEM] : [], installed: [],
});
const action = (tier: SupporterTier | null, listing: object, at_ = NOW, qualifies = true) =>
  supporterListingAction({ signedIn: true, kind: 'world', id: 'w1', snapshot: snapshot(tier, qualifies), listing, now: at_ });

beforeEach(() => {
  seedTierNamesForTest({ supporter: 'Spark', supporter_plus: 'Flame', supporter_top: 'Beacon' });
});

describe('the open tier', () => {
  it('is the top tier before any lower stage opens, then steps down as each date passes', () => {
    expect(openTierNow(staged(), NOW)).toBe('supporter_top');
    expect(openTierNow(staged(), NOW + 5 * DAY)).toBe('supporter_plus');
    expect(openTierNow(staged(), NOW + 10 * DAY)).toBe('supporter');
  });

  it('reads a null date as the public date, and as never without one', () => {
    const toPublic = { ...staged(), supporterSchedule: [{ tier: 'supporter_plus', opensAt: at(5) }, { tier: 'supporter', opensAt: null }] };
    expect(openTierNow(toPublic, NOW + 14 * DAY)).toBe('supporter_plus');
    expect(openTierNow(toPublic, NOW + 15 * DAY)).toBe('supporter');

    const noEnd = { ...toPublic, supporter_until: null };
    expect(openTierNow(noEnd, NOW + 3650 * DAY)).toBe('supporter_plus');
  });

  it('opens every tier on a listing with no tier rows', () => {
    expect(openTierNow({ supporter_only: true, supporter_until: at(15) }, NOW)).toBe('supporter');
  });
});

describe('the listing action', () => {
  it('is Upgrade for a qualifying account below the open tier', () => {
    expect(action('supporter', staged())).toBe('upgrade');
    expect(action('supporter_plus', staged())).toBe('upgrade');
  });

  it('is Patreon for an account that does not qualify, whatever the schedule', () => {
    expect(action(null, staged(), NOW, false)).toBe('patreon');
  });

  it('is Download once the account\'s tier opens', () => {
    expect(action('supporter_top', staged())).toBe('download');
    expect(action('supporter_plus', staged(), NOW + 5 * DAY)).toBe('download');
    expect(action('supporter', staged(), NOW + 10 * DAY)).toBe('download');
  });

  it('is Download for a listing with no schedule, as before', () => {
    expect(action('supporter', { supporter_only: true, supporter_until: at(15) })).toBe('download');
  });

  it('is Download when the reply named no tier, so an older server never blocks a download', () => {
    expect(action(null, staged())).toBe('download');
  });

  it('keeps Re-download on a world whose current copy the account holds after a downgrade', () => {
    const result = supporterListingAction({
      signedIn: true, kind: 'world', id: 'w1', listing: staged(), now: NOW, downloadState: 'refresh', snapshot: snapshot('supporter'),
    });

    expect(result).toBe('redownload');
  });

  it('keeps Installed on a Mascot the account already installed after a downgrade', () => {
    const result = supporterListingAction({
      signedIn: true, kind: 'mascot', id: 'w1', listing: staged(), now: NOW,
      snapshot: { ...snapshot('supporter'), entitled: [{ ...ITEM, kind: 'mascot' }], installed: [{ ...ITEM, kind: 'mascot' }] },
    });

    expect(result).toBe('installed');
  });

  it('is Upgrade on an uninstalled Mascot below the open tier', () => {
    const result = supporterListingAction({
      signedIn: true, kind: 'mascot', id: 'w1', listing: staged(), now: NOW,
      snapshot: { ...snapshot('supporter'), entitled: [{ ...ITEM, kind: 'mascot' }] },
    });

    expect(result).toBe('upgrade');
  });
});

describe('belowOpenTier', () => {
  it('is false for an unknown tier', () => {
    expect(belowOpenTier(null, staged(), NOW)).toBe(false);
  });
});

describe('the schedule payload', () => {
  it('drops unknown tiers and malformed entries and sorts highest first', () => {
    const parsed = parseSupporterSchedule([
      { tier: 'supporter', opensAt: at(10) },
      { tier: 'supporter_mega', opensAt: at(1) },
      { tier: 'supporter_plus', opensAt: 5 },
      null,
      { tier: 'supporter_plus', opensAt: null },
    ]);

    expect(parsed).toEqual([{ tier: 'supporter_plus', opensAt: null }, { tier: 'supporter', opensAt: at(10) }]);
    expect(parseSupporterSchedule('nope')).toEqual([]);
  });
});

describe('the schedule stages', () => {
  const date = (days: number) => formatSupporterDate(new Date(NOW + days * DAY));

  it('lists each tier\'s date by display name, then the public date', () => {
    expect(scheduleStages(staged())).toEqual([
      { key: 'supporter_top', name: 'Beacon', when: 'Open now' },
      { key: 'supporter_plus', name: 'Flame', when: date(5) },
      { key: 'supporter', name: 'Spark', when: date(10) },
      { key: 'public', name: 'Everyone', when: date(15) },
    ]);
  });

  it('shows a null date as the public date when there is one', () => {
    const listing = { ...staged(), supporterSchedule: [{ tier: 'supporter', opensAt: null }] };

    expect(scheduleStages(listing)).toEqual([{ key: 'supporter_top', name: 'Beacon', when: 'Open now' }, { key: 'supporter', name: 'Spark', when: date(15) }, { key: 'public', name: 'Everyone', when: date(15) }]);
  });

  it('shows "Not scheduled" for a null date with no public date', () => {
    const listing = { supporter_only: true, supporter_until: null, supporterSchedule: [{ tier: 'supporter', opensAt: null }] };

    expect(scheduleStages(listing)).toEqual([
      { key: 'supporter_top', name: 'Beacon', when: 'Open now' },
      { key: 'supporter', name: 'Spark', when: 'Not scheduled' },
      { key: 'public', name: 'Everyone', when: 'Not scheduled' },
    ]);
  });

  it('is empty for a listing with only a public date, so today\'s mark shows', () => {
    expect(scheduleStages({ supporter_only: true, supporter_until: at(15) })).toEqual([]);
  });
});
