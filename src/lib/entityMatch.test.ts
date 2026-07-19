import { describe, it, expect } from 'vitest';
import { matchNames, findEntityNames, matchNamesLoose, sameCharacterName } from './entityMatch';
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

  it('matches irregular plurals, not just a trailing s', () => {
    expect(matchNames('The Wolves close in.', ['Wolf'])).toEqual(['Wolf']);
    expect(matchNames('Cities burn on the horizon.', ['City'])).toEqual(['City']);
    expect(matchNames('The Children scatter.', ['Child'])).toEqual(['Child']);
    expect(matchNames('The People gather.', ['Person'])).toEqual(['Person']);
  });

  it('keeps the capital guard for an irregular plural (lowercase common-word use skipped)', () => {
    expect(matchNames('a pack of wolves roams', ['Wolf'])).toEqual([]);
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

  it('matches on a capitalized first name alone (partial proper-noun reference)', () => {
    expect(matchNames('Emily waves from the porch.', ['Emily Foster'])).toEqual(['Emily Foster']);
  });

  it('matches on a capitalized last name alone', () => {
    expect(matchNames('Foster nodded.', ['Emily Foster'])).toEqual(['Emily Foster']);
  });

  it('does not match a lowercase partial (capital guard holds)', () => {
    expect(matchNames('someone fosters false hope', ['Emily Foster'])).toEqual([]);
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

  it('with requireCapital:false, matches a lowercase single-word name (player actions)', () => {
    const entities = [ent('Mira')];
    expect(findEntityNames('talk to mira', entities)).toEqual([]); // default guard
    expect(findEntityNames('talk to mira', entities, { requireCapital: false })).toEqual(['Mira']);
  });

  it('populates a multi-word entity from a first-name-only reference', () => {
    expect(findEntityNames('Emily smiles.', [ent('Emily Foster')])).toEqual(['Emily Foster']);
  });
});

describe('findEntityNames — aliases', () => {
  const withAliases = (name: string, aliases: string[]): Entity => ({ id: name, name, aliases });

  it('resolves an alias hit to the canonical entity name', () => {
    const entities = [withAliases('Synthia', ['Matron', 'Matron of Teldoril'])];
    expect(findEntityNames('The Matron watches in silence.', entities)).toEqual(['Synthia']);
  });

  it('matches aliases case-sensitively (exact) unlike the fuzzy name rule', () => {
    const entities = [withAliases('Synthia', ['Em'])];
    expect(findEntityNames('Em waves.', entities)).toEqual(['Synthia']);
    expect(findEntityNames('the system reboots', entities)).toEqual([]); // no substring/lowercase hit
  });

  it('matches an alias plural, irregulars included', () => {
    const entities = [withAliases('Wolf', ['Grey One'])];
    expect(findEntityNames('The Grey Ones circle.', entities)).toEqual(['Wolf']);
    const wives = [withAliases('Beast', ['Wife'])];
    expect(findEntityNames('The Wives whisper.', wives)).toEqual(['Beast']);
  });

  it('does not duplicate when both name and an alias appear', () => {
    const entities = [withAliases('Synthia', ['Matron'])];
    expect(findEntityNames('Synthia, the Matron, nods.', entities)).toEqual(['Synthia']);
  });

  it('lists name hits in text order, then alias-only hits', () => {
    const entities = [withAliases('Synthia', ['Matron']), ent('Reyes')];
    expect(findEntityNames('Reyes bows before the Matron.', entities)).toEqual(['Reyes', 'Synthia']);
  });
});

describe('sameCharacterName (conservative de-dupe)', () => {
  it('is true for equal names (case/space-insensitive)', () => {
    expect(sameCharacterName('Mira', ' mira ')).toBe(true);
  });

  it('merges a name that is a subset of another (title/prefix variants)', () => {
    expect(sameCharacterName('Aldric', 'Sergeant Aldric')).toBe(true);
    expect(sameCharacterName('Sergeant Aldric', 'Aldric')).toBe(true);
    expect(sameCharacterName('Skitter-Demon', 'Lead Skitter-Demon')).toBe(true);
  });

  it('does not merge names with differing head words or no overlap', () => {
    expect(sameCharacterName('Man with Knife', 'Woman with Knife')).toBe(false);
    expect(sameCharacterName('Town Guard', 'Sergeant Aldric')).toBe(false);
    expect(sameCharacterName('Woman with Knife', 'Merchant with Rusty Blade')).toBe(false);
  });

  it('does not merge a pure rename with no shared token (known limitation)', () => {
    expect(sameCharacterName('Woman with Knife', 'Mira')).toBe(false);
  });

  it('is false when a name has no significant words to compare', () => {
    expect(sameCharacterName('', 'Mira')).toBe(false);
  });
});
