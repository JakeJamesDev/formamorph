import { describe, it, expect } from 'vitest';
import { matchNames, findEntityNames, matchNamesLoose } from './entityMatch';
import type { Entity } from '@/types';

const ent = (name: string): Entity => ({ id: name, name });

describe('matchNames — single-word names (capital guard)', () => {
  it('matches a proper-noun (capitalized) occurrence', () => {
    expect(matchNames('Then Hope steps forward.', ['Hope'])).toEqual(['Hope']);
  });

  it('does not match a lowercase common-word occurrence', () => {
    expect(matchNames('you feel hope rising', ['Hope'])).toEqual([]);
  });

  it('tolerates a trailing plural s', () => {
    expect(matchNames('Goblins swarm the gate.', ['Goblin'])).toEqual(['Goblin']);
  });
});

describe('matchNames — multi-word names (no capital guard)', () => {
  it('matches an exact contiguous occurrence, case-insensitively', () => {
    expect(matchNames('the iron gate creaks', ['Iron Gate'])).toEqual(['Iron Gate']);
  });

  it('matches loosely when every word appears somewhere', () => {
    expect(matchNames('iron bars rust beside the gate', ['Iron Gate'])).toEqual(['Iron Gate']);
  });

  it('excludes a candidate when a word is missing (the AND pass)', () => {
    expect(matchNames('the officer flees', ['a fleeing officer'])).toEqual([]);
  });
});

describe('matchNames — hygiene', () => {
  it('skips blank names and dedupes, preserving first-seen order', () => {
    expect(matchNames('Mira meets Reyes; Mira waves.', ['  ', 'Mira', 'Reyes', 'Mira'])).toEqual([
      'Mira',
      'Reyes',
    ]);
  });

  it('does not throw on regex-special characters in a name', () => {
    expect(() => matchNames('a (Captain) salutes', ['Captain (ret.)'])).not.toThrow();
  });
});

describe('matchNamesLoose — any significant word, no capital guard', () => {
  it('confirms a multi-word name from a casual single-word, uncapitalized reference', () => {
    expect(matchNamesLoose('the tank rolls forward', ['Battle Tank'])).toEqual(['Battle Tank']);
  });

  it('matches a single-word name in lowercase (the director already vouched)', () => {
    expect(matchNamesLoose('a drone hovers overhead', ['Drone'])).toEqual(['Drone']);
  });

  it('is plural-tolerant', () => {
    expect(matchNamesLoose('helicopters circle the block', ['Attack Helicopter'])).toEqual([
      'Attack Helicopter',
    ]);
  });

  it('ignores stopwords so "The Wolf" does not match on "the"', () => {
    expect(matchNamesLoose('the door opens', ['The Wolf'])).toEqual([]);
  });

  it('returns nothing when no significant word appears', () => {
    expect(matchNamesLoose('nothing relevant here', ['Battle Tank'])).toEqual([]);
  });
});

describe('findEntityNames', () => {
  it('returns the names of defined entities present in the text', () => {
    const entities = [ent('Mira'), ent('Reyes'), ent('Aldous')];
    expect(findEntityNames('Mira nods as Reyes enters.', entities)).toEqual(['Mira', 'Reyes']);
  });
});
