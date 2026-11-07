import { describe, it, expect } from 'vitest';
import { matchLocationResponse, matchNarratedMoveResponse } from './locationMatch';

const names = ['Cave', 'Cave Entrance', 'Forest Clearing'];

describe('matchLocationResponse', () => {
  it('matches an exact name case-insensitively', () => {
    expect(matchLocationResponse('forest clearing', names)).toBe('Forest Clearing');
  });

  it('returns null for NONE / empty / whitespace', () => {
    expect(matchLocationResponse('NONE', names)).toBeNull();
    expect(matchLocationResponse('none', names)).toBeNull();
    expect(matchLocationResponse('', names)).toBeNull();
    expect(matchLocationResponse('   ', names)).toBeNull();
  });

  it('prefers the longest matching name when the response is a sentence', () => {
    expect(matchLocationResponse('You head toward the Cave Entrance now.', names)).toBe(
      'Cave Entrance',
    );
  });

  it('matches a bare name embedded in prose', () => {
    expect(matchLocationResponse('She returns to the Cave.', names)).toBe('Cave');
  });

  it('does not match a name that only appears as part of a larger word', () => {
    // "Cave" should not match "caverns"
    expect(matchLocationResponse('They explore the caverns.', names)).toBeNull();
  });

  it('returns null when no available name appears', () => {
    expect(matchLocationResponse('You wander aimlessly.', names)).toBeNull();
  });
});

describe('matchLocationResponse — article tolerance (not suffix looseness)', () => {
  const places = ['Sedge Landing', "Ferryman's Cottage", 'The Eelhouse'];

  it('matches when the model drops a leading "The"', () => {
    expect(matchLocationResponse('Eelhouse', places)).toBe('The Eelhouse');
  });

  it('matches when the model adds a leading article the name lacks', () => {
    expect(matchLocationResponse('The Sedge Landing', places)).toBe('Sedge Landing');
  });

  it('still matches a bare-article name inside prose', () => {
    expect(matchLocationResponse('You walk over to the Eelhouse.', places)).toBe('The Eelhouse');
  });

  it('does NOT match on a shared suffix — "Cottage" must not resolve to "Ferryman\'s Cottage"', () => {
    expect(matchLocationResponse('Cottage', places)).toBeNull();
  });

  it('does NOT collapse two homes with a shared suffix', () => {
    const homes = ["Emily's House", "John's House"];
    expect(matchLocationResponse('House', homes)).toBeNull();
  });
});

describe('matchNarratedMoveResponse', () => {
  it('reads Elsewhere as no move, in any case', () => {
    expect(matchNarratedMoveResponse('Elsewhere', names)).toBeNull();
    expect(matchNarratedMoveResponse('ELSEWHERE.', names)).toBeNull();
    expect(matchNarratedMoveResponse('**elsewhere**', names)).toBeNull();
  });

  it('reads Elsewhere as no move even when the rest of the reply names a listed place', () => {
    expect(matchNarratedMoveResponse('Elsewhere: past the Cave Entrance', names)).toBeNull();
  });

  it('lets a listed place named Elsewhere win', () => {
    expect(matchNarratedMoveResponse('Elsewhere', [...names, 'Elsewhere'])).toBe('Elsewhere');
  });

  it('lets a listed place that starts with Elsewhere win through markdown and punctuation', () => {
    expect(matchNarratedMoveResponse('**Elsewhere Inn**', [...names, 'Elsewhere Inn'])).toBe('Elsewhere Inn');
    expect(matchNarratedMoveResponse('Elsewhere.', [...names, 'Elsewhere'])).toBe('Elsewhere');
  });

  it('matches a listed place as the router matcher does', () => {
    expect(matchNarratedMoveResponse('You end up in the Cave Entrance.', names)).toBe('Cave Entrance');
    expect(matchNarratedMoveResponse('NONE', names)).toBeNull();
  });

  it('reads a word that only starts with Elsewhere as a reply like any other', () => {
    expect(matchNarratedMoveResponse('Elsewhereish Cave', names)).toBe('Cave');
  });
});

describe('matchLocationResponse keeps the router reply rule', () => {
  it('finds a listed place after Elsewhere', () => {
    expect(matchLocationResponse('Elsewhere: past the Cave Entrance', names)).toBe('Cave Entrance');
  });
});
