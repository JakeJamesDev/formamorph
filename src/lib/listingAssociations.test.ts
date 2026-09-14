import { describe, it, expect } from 'vitest';
import { associationGroups, hasAssociations } from './listingAssociations';

describe('associationGroups', () => {
  it('splits the offers into approved, community, and declined for a reader owed all three', () => {
    const groups = associationGroups([
      { id: 'w1', name: 'Sedge Landing', reviewState: 'approved' },
      { id: 'w2', name: 'The Long Dark', reviewState: 'unreviewed' },
      { id: 'w3', name: 'Ashfall', reviewState: 'declined' },
    ], true);

    expect(groups).toEqual({
      approved: [{ id: 'w1', name: 'Sedge Landing', reviewState: 'approved' }],
      community: [{ id: 'w2', name: 'The Long Dark', reviewState: 'unreviewed' }],
      declined: [{ id: 'w3', name: 'Ashfall', reviewState: 'declined' }],
    });
  });

  it('drops a declined offer for a player, whatever the server sent', () => {
    // The server withholds one from everybody but the component's author and staff. Dropping it again
    // means an over-sending server still cannot show a player a world its author turned away.
    const groups = associationGroups([
      { id: 'w1', name: 'Sedge Landing', reviewState: 'approved' },
      { id: 'w3', name: 'Ashfall', reviewState: 'declined' },
    ]);

    expect(groups.declined).toEqual([]);
    expect(groups.community).toEqual([]);
    expect(groups.approved.map((row) => row.id)).toEqual(['w1']);
  });

  it('reads an offer with no answer yet as a community one', () => {
    const groups = associationGroups([{ id: 'w2', name: 'The Long Dark' }]);

    expect(groups.community).toEqual([{ id: 'w2', name: 'The Long Dark', reviewState: 'unreviewed' }]);
    expect(groups.approved).toEqual([]);
  });

  it('keeps the order the server gave within each group', () => {
    const groups = associationGroups([
      { id: 'w2', name: 'Second', reviewState: 'unreviewed' },
      { id: 'w1', name: 'First', reviewState: 'approved' },
      { id: 'w3', name: 'Third', reviewState: 'unreviewed' },
    ]);

    expect(groups.community.map((row) => row.id)).toEqual(['w2', 'w3']);
  });

  it('drops an offer with no world behind it', () => {
    const groups = associationGroups([{ id: '', name: 'Nowhere' }]);

    expect(groups.community).toEqual([]);
  });

  it('names an offer whose world carries no name', () => {
    const groups = associationGroups([{ id: 'w4', name: '' }]);

    expect(groups.community[0].name).toBe('Untitled');
  });

  it('answers empty for a listing the server said nothing about', () => {
    expect(associationGroups(undefined)).toEqual({ approved: [], community: [], declined: [] });
  });
});

describe('hasAssociations', () => {
  it('is false for a component offered for nothing', () => {
    expect(hasAssociations(associationGroups([]))).toBe(false);
  });

  it('is true when only a declined offer stands, for the reader owed it', () => {
    expect(hasAssociations(associationGroups([{ id: 'w3', name: 'Ashfall', reviewState: 'declined' }], true))).toBe(true);
  });

  it('is false when a player’s only offer is a declined one', () => {
    expect(hasAssociations(associationGroups([{ id: 'w3', name: 'Ashfall', reviewState: 'declined' }]))).toBe(false);
  });

  it('is true for an approved offer', () => {
    expect(hasAssociations(associationGroups([{ id: 'w1', name: 'Sedge Landing', reviewState: 'approved' }]))).toBe(true);
  });
});
