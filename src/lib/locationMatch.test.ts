import { describe, it, expect } from 'vitest';
import { matchLocationResponse, matchNarratedMoveResponse, matchRouterResponse } from './locationMatch';

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
  describe('with the current location', () => {
    const reach = ['Ridge Campus', 'Glass Studio'];
    const here = 'Ridge Campus Dorms';

    it('moves nobody when the reply names the current location that holds a destination name', () => {
      expect(matchNarratedMoveResponse('Ridge Campus Dorms', reach, here)).toBeNull();
      expect(matchNarratedMoveResponse('**ridge campus dorms**.', reach, here)).toBeNull();
      expect(matchNarratedMoveResponse('You stay in the Ridge Campus Dorms.', reach, here)).toBeNull();
    });

    it('still moves the player to a destination the reply names', () => {
      expect(matchNarratedMoveResponse('Ridge Campus', reach, here)).toBe('Ridge Campus');
      expect(matchNarratedMoveResponse('Glass Studio', reach, here)).toBe('Glass Studio');
    });
  });
});

describe('matchRouterResponse', () => {
  const far = ['Cave Entrance', 'Old Mill'];
  const reach = [...names, 'Old Mill'];

  it('moves nobody on a reply that holds a far name inside other words', () => {
    expect(matchRouterResponse('I walk all the way to the Old Mill.', reach, far)).toBeNull();
  });

  it('moves the player to a far place on an exact reply, case, article and markdown aside', () => {
    expect(matchRouterResponse('  old mill ', reach, far)).toBe('Old Mill');
    expect(matchRouterResponse('The Old Mill', reach, far)).toBe('Old Mill');
    expect(matchRouterResponse('**Old Mill**.', reach, far)).toBe('Old Mill');
  });

  it('still finds a one-move place inside other words', () => {
    expect(matchRouterResponse('I head into the forest clearing now', reach, far)).toBe('Forest Clearing');
  });

  it('moves nobody when the longest name in the reply is far, even with a one-move name inside it', () => {
    expect(matchRouterResponse('I go to the cave entrance', reach, far)).toBeNull();
    expect(matchRouterResponse('Cave Entrance', reach, far)).toBe('Cave Entrance');
  });

  it('moves nobody when the reply names the current location that holds a destination name', () => {
    expect(matchRouterResponse('Forest Clearing Camp', reach, far, 'Forest Clearing Camp')).toBeNull();
    expect(matchRouterResponse('I stay at the Forest Clearing Camp', reach, far, 'Forest Clearing Camp')).toBeNull();
    expect(matchRouterResponse('Forest Clearing', reach, far, 'Forest Clearing Camp')).toBe('Forest Clearing');
  });

  it('reads NONE and an empty reply as no move', () => {
    expect(matchRouterResponse('NONE', reach, far)).toBeNull();
    expect(matchRouterResponse('', reach, far)).toBeNull();
  });
});

describe('matchLocationResponse keeps the router reply rule', () => {
  it('finds a listed place after Elsewhere', () => {
    expect(matchLocationResponse('Elsewhere: past the Cave Entrance', names)).toBe('Cave Entrance');
  });
});
