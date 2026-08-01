import { describe, it, expect } from 'vitest';
import {
  isQuarantined, quarantineDaysLeft, quarantineDeadline, quarantineTargetFor, quarantineTemplate,
} from './quarantine';

/**
 * The quarantine notice and its dates.
 *
 * The dates matter more than they look: the author is being told when their work dies, so an off-by-one
 * or a silent null is the difference between a warning and a surprise.
 */

const listing = (over: Record<string, unknown> = {}) => ({
  kind: 'world',
  name: 'Sedge Landing',
  author: { id: 'u1', username: 'wren_hallow' },
  quarantined_at: '2026-08-01T00:00:00.000Z',
  quarantine_expires_at: '2026-08-08T00:00:00.000Z',
  ...over,
});

describe('reading the state', () => {
  it('knows a quarantined listing from an ordinary one', () => {
    expect(isQuarantined(listing())).toBe(true);
    expect(isQuarantined(listing({ quarantined_at: null }))).toBe(false);
    expect(isQuarantined({})).toBe(false);
  });

  it('gives the deadline as a date', () => {
    expect(quarantineDeadline(listing())).toBeTruthy();
  });

  it('gives no deadline when there is none to give', () => {
    // Better absent than invented — the card leaves the line out rather than printing a wrong date.
    expect(quarantineDeadline(listing({ quarantine_expires_at: null }))).toBeNull();
    expect(quarantineDeadline(listing({ quarantine_expires_at: 'not a date' }))).toBeNull();
  });

  it('counts the days left', () => {
    const now = new Date('2026-08-01T00:00:00.000Z');

    expect(quarantineDaysLeft(listing(), now)).toBe(7);
  });

  it('rounds a part-day up, so the last day still counts as one', () => {
    // "0 days left" on something with hours to go would read as already gone.
    const now = new Date('2026-08-07T12:00:00.000Z');

    expect(quarantineDaysLeft(listing(), now)).toBe(1);
  });

  it('floors an overdue listing at zero rather than going negative', () => {
    // Past its deadline means the sweeper has not run yet, not that it owes negative time.
    const now = new Date('2026-08-20T00:00:00.000Z');

    expect(quarantineDaysLeft(listing(), now)).toBe(0);
  });
});

describe('who gets the notice', () => {
  it('names the author of somebody else’s work', () => {
    expect(quarantineTargetFor(listing(), 'admin-1')).toMatchObject({
      author: { id: 'u1', username: 'wren_hallow' },
      kind: 'world',
      name: 'Sedge Landing',
    });
  });

  it('offers none for an admin quarantining their own', () => {
    // There is nobody to explain it to.
    expect(quarantineTargetFor(listing(), 'u1')).toBeNull();
  });

  it('offers none when the record has no author to write to', () => {
    expect(quarantineTargetFor(listing({ author: null }), 'admin-1')).toBeNull();
    expect(quarantineTargetFor(listing({ author: { id: 'u1' } }), 'admin-1')).toBeNull();
  });

  it('carries the deadline, since that is what the message is about', () => {
    expect(quarantineTargetFor(listing(), 'admin-1')?.deadline).toBeTruthy();
  });

  it('falls back to the kind’s noun when the listing has no name', () => {
    expect(quarantineTargetFor(listing({ name: null }), 'admin-1')?.name).toBe('World');
  });
});

describe('what the notice says', () => {
  const target = quarantineTargetFor(listing(), 'admin-1')!;

  it('names the thing and says when it dies', () => {
    const { subject, body } = quarantineTemplate(target);

    expect(subject).toContain('Sedge Landing');
    expect(body).toContain('Sedge Landing');
    expect(body).toContain(target.deadline!);
  });

  it('says the update buys more time, which is the actionable part', () => {
    expect(quarantineTemplate(target).body).toMatch(/another week/i);
  });

  it('leaves the reasons for the admin to write', () => {
    // Only they know what needs fixing; a prefilled reason would be a guess in the author's inbox.
    expect(quarantineTemplate(target).body.trimEnd()).toMatch(/\*\*What needs to change:\*\*$/);
  });

  it('says nothing about a date it does not have', () => {
    const dateless = quarantineTargetFor(listing({ quarantine_expires_at: null }), 'admin-1')!;

    expect(quarantineTemplate(dateless).body).not.toMatch(/deleted on/i);
  });

  it('uses the kind’s own noun, the same one the takedown notice uses', () => {
    // `KIND_LABELS` is the single source for this, so the two notices cannot drift apart.
    const character = quarantineTargetFor(listing({ kind: 'entity', name: 'Ilsa' }), 'admin-1')!;

    expect(quarantineTemplate(character).subject).toContain('entity');
  });
});
