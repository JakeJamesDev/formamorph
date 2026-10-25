import { describe, it, expect } from 'vitest';
import {
  MODERATION_LABELS, awaitsReview, changedFields, fieldLabel, moderationStatus, publishedMessage,
} from './listingModeration';

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

  it('sorts fields it does not know after the known ones', () => {
    expect(changedFields({ fields: { zeta: { approved: 1, pending: 2 }, alpha: { approved: 1, pending: 2 }, name: { approved: 'a', pending: 'b' } } }))
      .toEqual(['name', 'alpha', 'zeta']);
  });
});

describe('the publish message', () => {
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
