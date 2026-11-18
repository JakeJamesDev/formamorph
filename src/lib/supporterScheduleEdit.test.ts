import { describe, expect, it } from 'vitest';
import { datesFromForm, formFromListing, planSchedule, toInputValue } from '@/lib/supporterScheduleEdit';

const NOW = Date.UTC(2026, 10, 18, 12, 30, 15, 250);
const DAY = 86_400_000;
const iso = (days: number) => new Date(NOW + days * DAY).toISOString();

describe('planSchedule', () => {
  it('opens each stage when the one above it ends, and the public date after the last (the server\'s own numbers)', () => {
    const plan = planSchedule({ supporter_top: '5', supporter_plus: '5', supporter: '5' }, true, NOW);

    expect(plan.stages.map((s) => [s.tier, s.opensAt?.toISOString()])).toEqual([
      ['supporter_top', iso(0)],
      ['supporter_plus', iso(5)],
      ['supporter', iso(10)],
    ]);
    expect(plan.publicAt?.toISOString()).toBe(iso(15));
    expect(plan.payload).toEqual({ days: { supporter_top: 5, supporter_plus: 5, supporter: 5 }, goPublic: true });
  });

  it('opens a skipped stage with the next one down', () => {
    const plan = planSchedule({ supporter: '7' }, true, NOW);

    expect(plan.stages.map((s) => s.opensAt?.toISOString())).toEqual([iso(0), iso(0), iso(0)]);
    expect(plan.publicAt?.toISOString()).toBe(iso(7));
  });

  it('puts the tiers below the last stage at the public date', () => {
    const plan = planSchedule({ supporter_top: '5' }, true, NOW);

    expect(plan.stages.map((s) => s.opensAt?.toISOString())).toEqual([iso(0), iso(5), iso(5)]);
  });

  it('leaves the lower tiers and the public date unscheduled when the listing stays Supporter-only', () => {
    const plan = planSchedule({ supporter_top: '5' }, false, NOW);

    expect(plan.stages.map((s) => s.opensAt)).toEqual([new Date(NOW), null, null]);
    expect(plan.publicAt).toBeNull();
    expect(plan.payload).toEqual({ days: { supporter_top: 5 }, goPublic: false });
  });

  it('sends nothing with every field blank, and nothing with a field the server would refuse', () => {
    expect(planSchedule({}, true, NOW).payload).toBeNull();
    expect(planSchedule({ supporter_top: '  ' }, true, NOW).payload).toBeNull();
    const bad = planSchedule({ supporter_top: '5', supporter_plus: '0' }, true, NOW);
    expect(bad.payload).toBeNull();
    expect(bad.invalid).toEqual(['supporter_plus']);
  });
});

describe('the edit form', () => {
  const listing = {
    supporter_only: true,
    supporter_until: iso(15),
    supporterSchedule: [{ tier: 'supporter_plus', opensAt: iso(5) }, { tier: 'supporter', opensAt: null }],
  };

  it('prefills from the stored schedule', () => {
    const form = formFromListing(listing);

    expect(form.opensAt).toEqual({ supporter_plus: toInputValue(iso(5)), supporter: '' });
    expect(form.publicAt).toBe(toInputValue(iso(15)));
  });

  it('sends an untouched stage as the stored instant, seconds included', () => {
    expect(datesFromForm(formFromListing(listing), listing)).toEqual({
      opensAt: { supporter_plus: iso(5), supporter: null },
      publicAt: iso(15),
    });
  });

  it('sends a changed stage as the new instant, and an emptied field as null', () => {
    const form = formFromListing(listing);
    form.opensAt.supporter_plus = '';
    form.opensAt.supporter = '2026-12-01T09:00';
    form.publicAt = '';

    expect(datesFromForm(form, listing)).toEqual({
      opensAt: { supporter_plus: null, supporter: new Date('2026-12-01T09:00').toISOString() },
      publicAt: null,
    });
  });

  it('keeps every tier of a listing with no stages open when it is saved unchanged', () => {
    const legacy = { supporter_only: true, supporter_until: iso(15) };
    const sent = datesFromForm(formFromListing(legacy, NOW), legacy);

    expect(sent?.publicAt).toBe(iso(15));
    for (const tier of ['supporter_plus', 'supporter'] as const) {
      const opens = sent?.opensAt[tier];
      expect(opens).toEqual(expect.any(String));
      expect(new Date(opens as string).getTime()).toBeLessThanOrEqual(NOW);
    }
  });

  it('refuses a value that is not a date', () => {
    const form = formFromListing(listing);
    form.publicAt = 'soon';

    expect(datesFromForm(form, listing)).toBeNull();
  });
});
