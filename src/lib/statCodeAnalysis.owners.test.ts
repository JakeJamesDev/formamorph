import { describe, it, expect } from 'vitest';
import { statCodeCompletions, statCodeDiagnostics, type AnalysisOptions } from './statCodeAnalysis';
import { DICTIONARY_FIELDS, placeholderEntryFields } from './statCodeSurface';
import type { PlaceholderOwners } from './placeholderHomes';
import type { Placeholder } from '@/types';

/** Completions for a caret written as `|` in the doc. */
function labels(doc: string, options: AnalysisOptions = world) {
  const pos = doc.indexOf('|');
  expect(pos, 'every completion case marks its caret with |').toBeGreaterThanOrEqual(0);
  return (statCodeCompletions(doc.replace('|', ''), pos, options)?.options ?? []).map((option) => option.label);
}

const messages = (code: string, options: AnalysisOptions = world) =>
  statCodeDiagnostics(code, options).map((diagnostic) => diagnostic.message);

const ph = (id: string, name: string): Placeholder => ({ id, name, values: [] });

// Molly can be played and owns Hair and Eye Color; Ash can't be played and owns Scar; Rook owns nothing. Two
// books are both called Weather.
const list = [ph('world-hair', 'Hair'), ph('molly-hair', 'Hair'), ph('molly-eyes', 'Eye Color'), ph('first-sky', 'Sky'), ph('later-wind', 'Wind'), ph('ash-scar', 'Scar')];
const owners: PlaceholderOwners = new Map([
  ['molly-hair', { kind: 'entity', id: 'molly', name: 'Molly' }],
  ['molly-eyes', { kind: 'entity', id: 'molly', name: 'Molly' }],
  ['first-sky', { kind: 'dictionary', id: 'first-weather', name: 'Weather' }],
  ['later-wind', { kind: 'dictionary', id: 'later-weather', name: 'Weather' }],
  ['ash-scar', { kind: 'entity', id: 'ash', name: 'Ash' }],
]);
const world: AnalysisOptions = {
  placeholders: {
    list, owners,
    dictionaries: [{ id: 'first-weather', name: 'Weather' }, { id: 'later-weather', name: 'Weather' }, { id: 'lore', name: 'Lore' }],
  },
  entities: [
    { id: 'molly', name: 'Molly', persona: true, traits: [] },
    { id: 'rook', name: 'Rook', persona: false, traits: [] },
    { id: 'ash', name: 'Ash', persona: false, traits: [] },
  ],
};

describe('owner placeholders in stat code', () => {
  it('completes each owner’s placeholders after .placeholders, and an entry’s members after them', () => {
    expect(labels('return entities.Molly.placeholders.|')).toEqual(['Hair']);
    expect(labels('return entities.Molly.placeholders["|"];')).toEqual(['Hair', 'Eye Color']);
    expect(labels('return entities.Rook.placeholders.|')).toEqual([]);
    expect(labels('return persona.placeholders.|')).toEqual(['Hair']);
    expect(labels('return dictionaries.Weather.placeholders.|')).toEqual(['Wind']);
    expect(labels("return dictionaries['Weather'].placeholders[\"|\"];")).toEqual(['Wind']);
    expect(labels('return entities.Molly.placeholders.Hair.|')).toEqual(placeholderEntryFields('Wildcard').map((f) => f.name));
  });

  it('completes dictionary names and a dictionary’s members', () => {
    expect(labels('return dictionaries.|')).toEqual(['Weather', 'Lore']);
    expect(labels('return dictionaries["|"];')).toEqual(['Weather', 'Lore']);
    expect(labels('return dictionaries.Lore.|')).toEqual(DICTIONARY_FIELDS.map((f) => f.name));
  });

  it('reads a known path through each owner as clean', () => {
    const code = 'entities.Molly.placeholders["Eye Color"].pin("green"); persona.placeholders.Hair.unpin();'
      + ' dictionaries.Weather.placeholders.Wind.value = "gale"; return dictionaries.Lore.id ? 1 : 0;';
    expect(messages(code)).toEqual(['2 dictionaries are named “Weather”. This reads the last one authored.']);
  });

  it('flags a placeholder an owner does not have as a warning, since a library owner can have it', () => {
    expect(messages('return entities.Molly.placeholders.Hiar.value;')).toEqual(['“Molly” has no placeholder named “Hiar”. Did you mean “Hair”?']);
    expect(messages('return persona.placeholders.Hiar.value;'))
      .toEqual(['Unknown persona placeholder name “Hiar”. A library persona can have it. Did you mean “Hair”?']);
    const [inBook] = statCodeDiagnostics('return dictionaries.Lore.placeholders.Sky.value;', world);
    expect(inBook).toMatchObject({ severity: 'warning', message: '“Lore” has no placeholder named “Sky”.' });
    const [onEntity] = statCodeDiagnostics('return entities.Molly.placeholders.Hiar.value;', world);
    expect(onEntity).toMatchObject({ severity: 'warning' });
  });

  it('flags an unknown dictionary name as a warning with a suggestion, since a library book can have it', () => {
    const [unknown] = statCodeDiagnostics('return dictionaries.Lord.id;', world);
    expect(unknown).toMatchObject({
      severity: 'warning', message: 'Unknown dictionary name “Lord”. A library dictionary can have it. Did you mean “Lore”?',
    });
  });

  it('flags writes to a dictionary entry and to a whole owned placeholder', () => {
    expect(messages('dictionaries.Lore = null;')).toEqual(['dictionaries.Lore is read-only.']);
    expect(messages('dictionaries.Lore.placeholders = {};')).toEqual(['dictionaries.Lore.placeholders is read-only.']);
    expect(messages('entities.Molly.placeholders = {};')).toEqual(['entities.Molly.placeholders is read-only.']);
    expect(messages('entities.Molly.placeholders.Hair = "red";')).toEqual(['Write to entities.Molly.placeholders.Hair.value instead.']);
  });

  it('counts a pin through an owner as what the code does, so no missing-return warning fires', () => {
    expect(messages('entities.Molly.placeholders.Hair.pin("red");', {})).toEqual([]);
    expect(messages('persona.placeholders.Hair.unpin();', {})).toEqual([]);
    expect(messages('dictionaries.Lore.placeholders.Sky.value = "x";', {})).toEqual([]);
  });
});
