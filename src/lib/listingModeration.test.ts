import { describe, it, expect } from 'vitest';
import {
  MODERATION_LABELS, awaitsReview, changedFields, fieldLabel, heldChangelogEntries, moderationStatus,
  changelogCountAfter, publishedMessage, rejectedUpdateTemplate, waitedFor, withHeldCreate,
} from './listingModeration';

describe('how long an item waited', () => {
  const now = new Date('2026-10-25T12:00:00.000Z');
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

  it('reads in the largest whole unit', () => {
    expect(waitedFor(ago(10 * 60_000), now)).toBe('under an hour');
    expect(waitedFor(ago(3_600_000), now)).toBe('1 hour');
    expect(waitedFor(ago(23 * 3_600_000), now)).toBe('23 hours');
    expect(waitedFor(ago(24 * 3_600_000), now)).toBe('1 day');
    expect(waitedFor(ago(75 * 3_600_000), now)).toBe('3 days');
  });

  it('says so when the time does not parse', () => {
    expect(waitedFor('not a date', now)).toBe('unknown');
  });
});

const QUARANTINE = { quarantined_at: '2026-10-01T00:00:00.000Z', quarantine_expires_at: '2026-10-08T00:00:00.000Z' };

describe('a listing display status', () => {
  it('is live on a server without review, and for a player', () => {
    expect(moderationStatus({})).toBe('live');
  });

  it('is live when approved with nothing waiting', () => {
    expect(moderationStatus({ moderation_state: 'approved', has_pending_update: false })).toBe('live');
  });

  it('is updatePending when an approved listing has a waiting update', () => {
    expect(moderationStatus({ moderation_state: 'approved', has_pending_update: true })).toBe('updatePending');
  });

  it('is updatePending on a single read that carries the update itself', () => {
    expect(moderationStatus({ moderation_state: 'approved', pending_update: { fields: {} } })).toBe('updatePending');
  });

  it('is pending for a new listing that waits', () => {
    expect(moderationStatus({ moderation_state: 'pending' })).toBe('pending');
  });

  it('is resubmitted for a pending listing that still carries its quarantine', () => {
    expect(moderationStatus({ moderation_state: 'pending', ...QUARANTINE })).toBe('resubmitted');
  });

  it('is rejected for a rejected listing', () => {
    expect(moderationStatus({ moderation_state: 'rejected', ...QUARANTINE })).toBe('rejected');
  });

  it('stays live for an approved listing that staff quarantined', () => {
    expect(moderationStatus({ moderation_state: 'approved', ...QUARANTINE })).toBe('live');
  });
});

describe('the labels', () => {
  it('names each status', () => {
    expect(MODERATION_LABELS).toEqual({
      live: 'Live',
      pending: 'Pending Review',
      updatePending: 'Update Pending',
      rejected: 'Quarantined',
      resubmitted: 'Resubmitted',
    });
  });

  it('labels known fields and passes an unknown one through', () => {
    expect(fieldLabel('model_license')).toBe('Model License');
    expect(fieldLabel('mystery')).toBe('mystery');
  });
});

describe('the changed fields of an update', () => {
  it('is empty without an update', () => {
    expect(changedFields(undefined)).toEqual([]);
    expect(changedFields(null)).toEqual([]);
  });

  it('lists the changed fields in display order, with content from its flag', () => {
    expect(changedFields({
      fields: {
        tags: { approved: ['a'], pending: ['b'] },
        name: { approved: 'Old', pending: 'New' },
      },
      content_changed: true,
    })).toEqual(['name', 'tags', 'content']);
  });

  it('leaves out content when it did not change', () => {
    expect(changedFields({ fields: { description: { approved: 'a', pending: 'b' } }, content_changed: false }))
      .toEqual(['description']);
  });

  it('adds the thumbnail when the update holds one, and reads the side edits by their server names', () => {
    expect(changedFields({
      fields: {
        compatible_worlds: { approved: [], pending: ['w2'] },
        required_dependencies: { approved: ['d1'], pending: [] },
        spoiler: { approved: false, pending: true },
        visibility: { approved: 'public', pending: 'unlisted' },
      },
      thumbnail_url: '/api/reviews/w1/thumbnail',
    })).toEqual(['thumbnail', 'visibility', 'spoiler', 'required_dependencies', 'compatible_worlds']);
    expect(fieldLabel('required_dependencies')).toBe('Required Dependencies');
    expect(fieldLabel('compatible_worlds')).toBe('Compatible Worlds');
  });

  it('sorts fields it does not know after the known ones', () => {
    expect(changedFields({ fields: { zeta: { approved: 1, pending: 2 }, alpha: { approved: 1, pending: 2 }, name: { approved: 'a', pending: 'b' } } }))
      .toEqual(['name', 'alpha', 'zeta']);
  });
});

describe('the held changelog entries', () => {
  const create = (id: string, title: string) => ({ op: 'create' as const, id, title, body: 'b', date: '2026-10-20' });

  it('lists held creates as their later edits leave them, without the deleted ones', () => {
    expect(heldChangelogEntries({
      changelog: [
        create('n1', 'First'),
        create('n2', 'Second'),
        { op: 'edit', id: 'n1', title: 'First, retitled', body: 'b2', date: '2026-10-21' },
        { op: 'delete', id: 'n2' },
        // An edit of a live entry is not a new entry.
        { op: 'edit', id: 'live-1', title: 'Live', body: 'b', date: '2026-09-01' },
      ],
    })).toEqual([{ id: 'n1', title: 'First, retitled', body: 'b2', date: '2026-10-21' }]);
  });

  it('is empty without an update', () => {
    expect(heldChangelogEntries(null)).toEqual([]);
  });

  it('counts the changelog as the update leaves it: held creates in, held deletes out', () => {
    expect(changelogCountAfter(['a', 'b'], {
      changelog: [create('n1', 'New'), { op: 'delete', id: 'a' }, { op: 'edit', id: 'b', title: 'B', body: '', date: '2026-10-20' }],
    })).toBe(2);
    expect(changelogCountAfter(['a'], null)).toBe(1);
  });

  it('appends a held create to the update, or starts one', () => {
    const entry = { id: 'n1', title: 'First', body: 'b', date: '2026-10-20' };
    expect(withHeldCreate(null, entry)).toEqual({ fields: {}, content_changed: false, changelog: [{ op: 'create', ...entry }] });
    expect(withHeldCreate({ fields: { name: { approved: 'a', pending: 'b' } }, changelog: [create('n0', 'Zero')] }, entry).changelog)
      .toEqual([create('n0', 'Zero'), { op: 'create', ...entry }]);
  });
});

describe('the rejected-update template', () => {
  it('names the listing and says players keep the live version', () => {
    const { subject, body } = rejectedUpdateTemplate({ kind: 'dictionary', name: 'Marsh Words' });
    expect(subject).toBe('Your update to the dictionary "Marsh Words" was not approved');
    expect(body).toBe('Your update to **"Marsh Words"** was not approved, so players still see the live version.'
      + ' You can send a new update at any time.\n\n**What needs to change:** ');
  });
});

describe('the publish message', () => {
  it('says the changelog entry went with the update when the server held it', () => {
    expect(publishedMessage('world', true, { moderation_state: 'approved', has_pending_update: true }, true))
      .toBe('World sent for review with its changelog entry');
  });

  it('says sent for review for a new listing that waits', () => {
    expect(publishedMessage('world', false, { moderation_state: 'pending' })).toBe('World sent for review');
  });

  it('says sent for review for an update that waits', () => {
    expect(publishedMessage('dictionary', true, { moderation_state: 'approved', has_pending_update: true }))
      .toBe('Dictionary sent for review');
  });

  it('says sent for review for a resubmitted listing', () => {
    expect(awaitsReview({ moderation_state: 'pending', ...QUARANTINE })).toBe(true);
    expect(publishedMessage('world', true, { moderation_state: 'pending', ...QUARANTINE })).toBe('World sent for review');
  });

  it('keeps the old message for a live result', () => {
    expect(publishedMessage('world', false, { moderation_state: 'approved' })).toBe('World published successfully!');
    expect(publishedMessage('world', true, {})).toBe('World updated successfully!');
    expect(publishedMessage('world', false, undefined)).toBe('World published successfully!');
  });
});
