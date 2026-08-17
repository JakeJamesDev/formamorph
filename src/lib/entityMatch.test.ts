import { describe, it, expect } from 'vitest';
import { matchNames, findNameMatches, findEntityNames, findEntityMatches, matchNamesLoose, sameCharacterName, stripQuotedSpeech, resolveEntityByName } from './entityMatch';
import type { Entity } from '@/types';

const ent = (name: string): Entity => ({ id: name, name });
const withAliases = (name: string, aliases: string[]): Entity => ({ id: name, name, aliases });

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

  it('tolerates a short gap between the words of a name', () => {
    expect(matchNames('Emily J. Foster signs the ledger.', ['Emily Foster'])).toEqual(['Emily Foster']);
  });

  it('does not match words scattered across unrelated clauses', () => {
    expect(matchNames('iron bars rust beside the gate', ['Iron Gate'])).toEqual([]);
    expect(matchNames('The old woman is gone; a young man tends the mill.', ['Old Man'])).toEqual([]);
  });

  it('excludes a candidate when a word is missing', () => {
    expect(matchNames('the officer flees', ['a fleeing officer'])).toEqual([]);
  });

  it('ignores an everyday word as a partial reference when a distinctive one exists', () => {
    // "Guard" is everyday, "Vashti" is not — so only the distinctive word can carry a lone match.
    expect(matchNames('Guards shout from the wall.', ['Vashti Guard'])).toEqual([]);
    expect(matchNames('Vashti shouts from the wall.', ['Vashti Guard'])).toEqual(['Vashti Guard']);
  });

  it('keeps every word usable when a name is entirely everyday words', () => {
    // Dropping all of them would guarantee a miss, so "Rose Wolf" still matches on "Rose" alone.
    expect(matchNames('Rose draws her blade.', ['Rose Wolf'])).toEqual(['Rose Wolf']);
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

describe('matchNames — partial: false (the visitor-pull parse)', () => {
  it('drops the lone-word partial that the default parse allows', () => {
    expect(matchNames('Emily waves from the porch.', ['Emily Foster'], { partial: false })).toEqual([]);
  });

  it('still matches the full name', () => {
    expect(matchNames('Emily Foster waves.', ['Emily Foster'], { partial: false })).toEqual([
      'Emily Foster',
    ]);
  });

  it('leaves single-word names on the capital guard alone', () => {
    expect(matchNames('Mira waves.', ['Mira'], { partial: false })).toEqual(['Mira']);
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
  it('resolves an alias hit to the canonical entity name', () => {
    const entities = [withAliases('Synthia', ['Matron', 'Matron of Teldoril'])];
    expect(findEntityNames('The Matron watches in silence.', entities)).toEqual(['Synthia']);
  });

  it('matches aliases case-sensitively (exact) unlike the fuzzy name rule', () => {
    const entities = [withAliases('Synthia', ['Em'])];
    expect(findEntityNames('Em waves.', entities)).toEqual(['Synthia']);
    expect(findEntityNames('the system reboots', entities)).toEqual([]); // no substring/lowercase hit
  });

  it('misses an alias the sentence capitalizes differently (why leading-article aliases are a defect)', () => {
    const entities = [withAliases('Synthia', ['Matron'])];
    expect(findEntityNames('the matron watches in silence.', entities)).toEqual([]);
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

describe('findNameMatches — the evidence behind a hit', () => {
  const spanOf = (text: string, name: string) => findNameMatches(text, [name])[0];

  it('reports the matched form and its span for a single-word name', () => {
    expect(spanOf('Then Hope steps forward.', 'Hope')).toEqual({
      name: 'Hope',
      matched: 'Hope',
      via: 'name',
      spans: [{ start: 5, end: 9, text: 'Hope' }],
    });
  });

  it('quotes the plural as written while naming the authored singular', () => {
    const match = spanOf('Goblins swarm the gate.', 'Goblin');
    expect(match.matched).toBe('Goblin');
    expect(match.spans).toEqual([{ start: 0, end: 7, text: 'Goblins' }]);
  });

  it('reports only the capitalized occurrences under the capital guard', () => {
    const match = spanOf('you feel hope rising, then Hope steps forward', 'Hope');
    expect(match.spans).toEqual([{ start: 27, end: 31, text: 'Hope' }]);
  });

  it('reports every occurrence, in text order', () => {
    const match = spanOf('Mira meets Reyes; Mira waves.', 'Mira');
    expect(match.spans.map((s) => s.start)).toEqual([0, 18]);
  });

  it('quotes the whole phrase, gap included, for an in-order multi-word hit', () => {
    const match = spanOf('Emily J. Foster signs the ledger.', 'Emily Foster');
    expect(match.via).toBe('name');
    expect(match.spans).toEqual([{ start: 0, end: 15, text: 'Emily J. Foster' }]);
  });

  it('names the distinctive word that carried a partial hit, in the author’s casing', () => {
    expect(spanOf('Foster nodded.', 'Emily Foster')).toEqual({
      name: 'Emily Foster',
      matched: 'Foster',
      via: 'partial',
      spans: [{ start: 0, end: 6, text: 'Foster' }],
    });
  });

  it('prefers whole-name evidence when the partial pass would also hit', () => {
    // "Emily" alone would satisfy the partial pass; the full name is the better answer to "why?".
    const match = spanOf('Emily Foster waves.', 'Emily Foster');
    expect(match).toMatchObject({ matched: 'Emily Foster', via: 'name' });
  });

  it('reports nothing for a name the text does not contain', () => {
    expect(findNameMatches('nobody here', ['Mira'])).toEqual([]);
  });

  it('offsets index the searched text exactly', () => {
    const text = 'The Wolves close in; Emily J. Foster does not flinch.';
    for (const match of findNameMatches(text, ['Wolf', 'Emily Foster'])) {
      for (const span of match.spans) {
        expect(text.slice(span.start, span.end)).toBe(span.text);
      }
    }
  });
});

describe('findEntityMatches — per-entity evidence', () => {
  it('carries the entity id alongside the canonical name', () => {
    expect(findEntityMatches('Mira nods.', [{ id: 'e1', name: 'Mira' }])).toEqual([
      { entityId: 'e1', name: 'Mira', matched: 'Mira', via: 'name', spans: [{ start: 0, end: 4, text: 'Mira' }] },
    ]);
  });

  it('reports an alias hit as the alias, resolved to the canonical name', () => {
    const entities = [withAliases('Synthia', ['Matron', 'Matron of Teldoril'])];
    expect(findEntityMatches('The Matron watches in silence.', entities)).toEqual([
      { entityId: 'Synthia', name: 'Synthia', matched: 'Matron', via: 'alias', spans: [{ start: 4, end: 10, text: 'Matron' }] },
    ]);
  });

  it('picks the alias covering the most text when two of them nest', () => {
    // Highlighting "Matron" inside "Matron of Teldoril" would point at a fragment of its own evidence.
    const entities = [withAliases('Synthia', ['Matron', 'Matron of Teldoril'])];
    const [match] = findEntityMatches('The Matron of Teldoril nods.', entities);
    expect(match.matched).toBe('Matron of Teldoril');
    expect(match.spans).toEqual([{ start: 4, end: 22, text: 'Matron of Teldoril' }]);
  });

  it('quotes an alias plural as written, multi-word aliases included', () => {
    const entities = [withAliases('Wolf', ['Grey One'])];
    const [match] = findEntityMatches('The Grey Ones circle.', entities);
    expect(match).toMatchObject({ name: 'Wolf', matched: 'Grey One', via: 'alias' });
    expect(match.spans).toEqual([{ start: 4, end: 13, text: 'Grey Ones' }]);
  });

  it('reports both entities that claim the same span (collision evidence)', () => {
    const entities: Entity[] = [ent('Matron'), withAliases('Synthia', ['Matron'])];
    const matches = findEntityMatches('The Matron nods.', entities);
    expect(matches.map((m) => m.name)).toEqual(['Matron', 'Synthia']);
    expect(matches.map((m) => m.via)).toEqual(['name', 'alias']);
    expect(matches.map((m) => m.spans)).toEqual([
      [{ start: 4, end: 10, text: 'Matron' }],
      [{ start: 4, end: 10, text: 'Matron' }],
    ]);
  });

  it('reports both entities when a name and a partial reference overlap', () => {
    const matches = findEntityMatches('Foster nodded.', [ent('Emily Foster'), ent('Foster')]);
    expect(matches.map((m) => [m.name, m.via])).toEqual([
      ['Emily Foster', 'partial'],
      ['Foster', 'name'],
    ]);
    expect(matches[0].spans).toEqual(matches[1].spans);
  });

  it('lists name hits first, then alias-only hits', () => {
    const entities: Entity[] = [withAliases('Synthia', ['Matron']), ent('Reyes')];
    expect(findEntityMatches('Reyes bows before the Matron.', entities).map((m) => m.name)).toEqual([
      'Reyes',
      'Synthia',
    ]);
  });

  it('reports two same-named entities separately while the name list still collapses them', () => {
    // The duplicate-name collision an author most wants to see: one word, two entities behind it.
    const entities: Entity[] = [{ id: 'e1', name: 'Guard' }, { id: 'e2', name: 'Guard' }];
    const text = 'A Guard blocks the door.';
    expect(findEntityMatches(text, entities).map((m) => m.entityId)).toEqual(['e1', 'e2']);
    expect(findEntityNames(text, entities)).toEqual(['Guard']);
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

describe('stripQuotedSpeech (presence reads prose, not dialogue)', () => {
  it('removes straight-quoted speech', () => {
    expect(stripQuotedSpeech('"Serana will be pleased," she said.')).toBe('  she said.');
  });

  it('removes curly-quoted speech', () => {
    expect(stripQuotedSpeech('\u201CSerana will be pleased,\u201D she said.')).toBe('  she said.');
  });

  it('swallows a trailing unterminated opener (mid-stream partial narration)', () => {
    expect(stripQuotedSpeech('Wolfram leans in. "Serana told me')).toBe('Wolfram leans in.  ');
  });

  it('returns quote-free text untouched', () => {
    const text = 'Wolfram leans across the desk.';
    expect(stripQuotedSpeech(text)).toBe(text);
  });

  it('leaves apostrophes alone', () => {
    expect(stripQuotedSpeech("Wolfram's desk is bare.")).toBe("Wolfram's desk is bare.");
  });

  it('handles empty input', () => {
    expect(stripQuotedSpeech('')).toBe('');
  });

  it('strips each paragraph of a continuing speech (re-opened quote, closed only at the end)', () => {
    // Fiction convention: paragraph 1 leaves its quote open, paragraph 2 re-opens and closes.
    const text = '"We should go now.\n\n"Professor Serana must die," he finished.';
    const stripped = stripQuotedSpeech(text);
    expect(stripped).not.toContain('Serana');
    expect(stripped).toContain('he finished.');
  });

  it('keeps attribution after a curly multi-paragraph speech instead of swallowing it', () => {
    const text = '“First part.\n\n“Second part,” she said, glancing at Mira.';
    expect(stripQuotedSpeech(text)).toContain('she said, glancing at Mira.');
  });

  it('drops a character only ever named inside dialogue, keeping the one acting on the page', () => {
    const narration = '"Professor Serana will be pleased," she said. Wolfram leaned in.';
    const entities = [ent('Professor Serana'), ent('Wolfram')];
    // The bug this guards: the unstripped parse marks Serana present in a scene she is not in.
    expect(findEntityNames(narration, entities)).toEqual(['Professor Serana', 'Wolfram']);
    expect(findEntityNames(stripQuotedSpeech(narration), entities)).toEqual(['Wolfram']);
  });
});

describe('stripQuotedSpeech + partial:false (the visitor-pull parse)', () => {
  it('a full name spoken in dialogue does not survive the strict parse either', () => {
    const narration = '"Professor Serana will review this," Wolfram said.';
    const entities = [ent('Professor Serana'), ent('Wolfram')];
    // `partial: false` bounds how loosely a name may match, not whether it was merely spoken about —
    // the full name still hits the in-order pass, which would walk her into the scene as a visitor.
    expect(findEntityNames(narration, entities, { partial: false })).toContain('Professor Serana');
    expect(findEntityNames(stripQuotedSpeech(narration), entities, { partial: false })).toEqual(['Wolfram']);
  });
});

describe('resolveEntityByName — scene name to defined entity', () => {
  const cast = [ent('Wolf'), ent('Direwolf'), ent('Emily Foster')];

  it('resolves each of two entities sharing a word fragment to itself', () => {
    // The bug this guards: a bidirectional substring lookup made "Wolf" and "Direwolf" equivalent, so
    // both scene rows resolved to whichever was authored first — the tab listed one name twice.
    expect(resolveEntityByName('Wolf', cast)?.name).toBe('Wolf');
    expect(resolveEntityByName('Direwolf', cast)?.name).toBe('Direwolf');
  });

  it('resolves the fragment-sharing name even when the shorter entity is authored first', () => {
    expect(resolveEntityByName('Direwolf', [ent('Wolf'), ent('Direwolf')])?.name).toBe('Direwolf');
    expect(resolveEntityByName('Direwolf', [ent('Direwolf'), ent('Wolf')])?.name).toBe('Direwolf');
  });

  it('still resolves a partial reference to its full-named entity', () => {
    expect(resolveEntityByName('Emily', cast)?.name).toBe('Emily Foster');
    expect(resolveEntityByName('Emily Foster', cast)?.name).toBe('Emily Foster');
  });

  it('prefers an exact match over a whole-word containment', () => {
    const packs = [ent('Wolf Pack'), ent('Wolf')];
    expect(resolveEntityByName('Wolf', packs)?.name).toBe('Wolf');
    expect(resolveEntityByName('Wolf Pack', packs)?.name).toBe('Wolf Pack');
  });

  it('matches case-insensitively and tolerates plurals', () => {
    expect(resolveEntityByName('wolf', cast)?.name).toBe('Wolf');
    expect(resolveEntityByName('Wolves', cast)?.name).toBe('Wolf');
  });

  it('returns undefined for an ad-hoc participant and for a blank name', () => {
    expect(resolveEntityByName('Nameless Drifter', cast)).toBeUndefined();
    expect(resolveEntityByName('  ', cast)).toBeUndefined();
  });
});
