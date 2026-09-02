import { describe, it, expect } from 'vitest';
import type { Placeholder } from '@/types';
import { phValues } from '@/test/placeholderValues';
import { encodePlaceholderToken, decodePlaceholderToken, type PlaceholderMode } from './placeholders';
import {
  placementLetter, placementLetters, worldPlacementTexts, entityPlacementTexts, dictionaryPlacementTexts,
  worldPlacementLetters, entityPlacementLetters, dictionaryPlacementLetters, chipPathName, chipPlaceholderNames,
  placementDisplayName, labelPlaceholders, sameLetters, EMPTY_LETTERS,
} from './placementLetters';

// Through the real codec, never a hand-written token: a test that spells the wire format itself keeps
// passing after that format moves.
const chip = (id: string, placementId: string, mode: PlaceholderMode = 'unique', label?: string) =>
  encodePlaceholderToken({ id, mode, placementId, ...(label ? { label } : {}) });

const P = (id: string, name: string, values: string[] = []): Placeholder => ({ id, name, values: phValues(values) });

const TOWN = P('town', 'Town Name', ['Sedge Landing', 'Harrow', 'Bellmoor']);
const EYE = P('eye', 'Eye', ['blue', 'green']);

describe('placementLetter', () => {
  it('runs A to Z, then AA', () => {
    expect(placementLetter(0)).toBe('A');
    expect(placementLetter(25)).toBe('Z');
    expect(placementLetter(26)).toBe('AA');
    expect(placementLetter(27)).toBe('AB');
    expect(placementLetter(52)).toBe('BA');
  });
});

describe('placementLetters', () => {
  it('letters Unique placements in text order, one sequence per placeholder', () => {
    const letters = placementLetters([
      `${chip('town', 't1')} and ${chip('eye', 'e1')}`,
      chip('town', 't2'),
    ]);
    expect(letters.get('t1')).toBe('A');
    expect(letters.get('t2')).toBe('B');
    expect(letters.get('e1')).toBe('A');
  });

  it('gives a World chip no letter and skips it in the count', () => {
    const letters = placementLetters([chip('town', 'w1', 'world'), chip('town', 't1')]);
    expect(letters.has('w1')).toBe(false);
    expect(letters.get('t1')).toBe('A');
  });

  it('closes the gap when a placement goes', () => {
    const before = placementLetters([chip('town', 't1'), chip('town', 't2')]);
    expect(before.get('t2')).toBe('B');
    const after = placementLetters([chip('town', 't2')]);
    expect(after.get('t2')).toBe('A');
  });

  it('keeps one letter for a placement that appears twice', () => {
    const letters = placementLetters([chip('town', 't1'), chip('town', 't1'), chip('town', 't2')]);
    expect(letters.get('t1')).toBe('A');
    expect(letters.get('t2')).toBe('B');
  });

  it('reaches AA on the twenty-seventh placement', () => {
    const texts = Array.from({ length: 27 }, (_, i) => chip('town', `t${i}`));
    expect(placementLetters(texts).get('t26')).toBe('AA');
  });
});

describe('sameLetters', () => {
  it('is true for equal maps and false for any difference', () => {
    const a = placementLetters([chip('town', 't1'), chip('town', 't2')]);
    const b = placementLetters([chip('town', 't1'), chip('town', 't2')]);
    expect(sameLetters(a, b)).toBe(true);
    expect(sameLetters(a, placementLetters([chip('town', 't2')]))).toBe(false);
    expect(sameLetters(a, placementLetters([chip('town', 't2'), chip('town', 't1')]))).toBe(false);
    expect(sameLetters(EMPTY_LETTERS, placementLetters([]))).toBe(true);
  });
});

describe('the document walk', () => {
  it('runs entities, locations, traits, stats, dictionaries, then placeholder values', () => {
    const texts = worldPlacementTexts({
      entities: [{ id: 'e', name: 'ent', aliases: ['ent-alias'], playerDescription: 'ent-pd' }],
      locations: [{ id: 'l', name: 'loc', aiSummary: 'loc-ais' }],
      traits: [{ id: 't', name: 'trait', statChanges: [] }],
      traitGroups: [{ id: 'g', name: 'group', parentId: null }],
      stats: [{
        id: 's', name: 'stat', type: 'number', description: 'stat-desc', min: 0, max: 1, regen: 0,
        // Listed high band first: the walk runs bands by threshold, the order the player meets them in.
        descriptors: [{ id: 'hi', threshold: 1, description: 'band-hi' }, { id: 'lo', threshold: 0, description: 'band-lo' }],
      }],
      dictionaries: [{ id: 'd', name: 'book', entries: [{ id: 'en', name: 'entry', key: ['k1'], value: 'val' }] }],
      worldOverview: { systemPrompt: 'sys' } as never,
      placeholders: [P('p', 'ph', ['value'])],
    });
    expect(texts).toEqual([
      'ent', 'ent-alias', 'ent-pd', 'loc', 'loc-ais', 'trait', 'group', 'stat', 'stat-desc', 'band-lo', 'band-hi',
      'entry', 'k1', 'val', 'sys', 'value',
    ]);
  });

  it('letters a Unique chip in a descriptor after the one in the stat name', () => {
    const letters = worldPlacementLetters({
      stats: [{
        id: 's', name: chip('town', 's-name'), type: 'number', description: '', min: 0, max: 1, regen: 0,
        descriptors: [{ id: 'b', threshold: 1, description: `Far from ${chip('town', 's-band')}` }],
      }],
      placeholders: [TOWN],
    });
    expect(letters.get('s-name')).toBe('A');
    expect(letters.get('s-band')).toBe('B');
  });

  it('reads a world whose collections are absent without throwing', () => {
    expect(worldPlacementTexts({})).toEqual([]);
  });

  it('walks entities and traits as their trees list them, not as their arrays are stored', () => {
    // The array holds `later` first; the tree puts it under a group after `first`, and `(A)` has to sit
    // above `(B)` in the list the author reads.
    const texts = worldPlacementTexts({
      entityGroups: [{ id: 'g', name: 'Kin', parentId: null, order: 1 }],
      entities: [
        { id: 'later', name: 'later', groupId: 'g', order: 0 },
        { id: 'first', name: 'first', groupId: null, order: 0 },
      ],
      traitGroups: [{ id: 'tg', name: 'Origins', parentId: null, order: 1 }],
      traits: [
        { id: 't-later', name: 't-later', groupId: 'tg', statChanges: [], order: 0 },
        { id: 't-first', name: 't-first', groupId: null, statChanges: [], order: 0 },
      ],
    });
    expect(texts).toEqual(['first', 'later', 't-first', 't-later', 'Origins']);
  });

  it('bundles the walk and the lettering for a world and for a library item', () => {
    const a = chip('town', 'e1');
    const b = chip('town', 'e2');
    expect(worldPlacementLetters({ entities: [{ id: 'e', name: a }], locations: [{ id: 'l', name: b }] }).get('e2')).toBe('B');
    expect(entityPlacementLetters({ id: 'e', name: b }).get('e2')).toBe('A');
    expect(dictionaryPlacementLetters({ id: 'd', name: 'b', entries: [{ id: 'en', name: b, key: [], value: '' }] }).get('e2')).toBe('A');
  });
});

describe('chipPathName and chipPlaceholderNames', () => {
  const molly = P('molly', 'Molly', [chip('hair', 'inner', 'world')]);
  const hair = P('hair', 'Hair', ['chestnut']);
  const drilled = encodePlaceholderToken({ id: 'molly', mode: 'world', placementId: 'p', path: [{ kind: 'val', ref: 'hair' }] });

  it('joins the qualified root and each step, marking a gone step', () => {
    expect(chipPathName(decodePlaceholderToken(drilled)!, [molly, hair])).toBe('Molly › Hair');
    expect(chipPathName(decodePlaceholderToken(drilled)!, [molly], { missing: '(missing)' })).toBe('Molly › (missing)');
    expect(chipPathName(decodePlaceholderToken(chip('gone', 'g'))!, [molly])).toBeNull();
  });

  it('lists the placeholder names behind a text’s chips, so a labeled chip still answers to its placeholder', () => {
    const labeled = chip('town', 't1', 'unique', 'Hometown');
    expect(chipPlaceholderNames(`${labeled} by ${drilled}`, [TOWN, molly, hair])).toEqual(['Town Name', 'Molly › Hair']);
    expect(chipPlaceholderNames(chip('gone', 'g'), [TOWN])).toEqual([]);
    expect(chipPlaceholderNames('plain', [TOWN])).toEqual([]);
  });

  it('walks a library character and a library book over their own fields and carried values', () => {
    expect(entityPlacementTexts({ id: 'e', name: 'n', aiSummary: 's', placeholders: [P('p', 'ph', ['v'])] }))
      .toEqual(['n', 's', 'v']);
    expect(dictionaryPlacementTexts({
      id: 'd', name: 'b', entries: [{ id: 'en', name: 'entry', key: [], value: 'val' }], placeholders: [P('p', 'ph', ['v'])],
    })).toEqual(['entry', 'val', 'v']);
  });
});

describe('placementDisplayName', () => {
  const letters = placementLetters([chip('town', 't1'), chip('town', 't2')]);
  const token = (t: string) => decodePlaceholderToken(t)!;

  it('reads Name (A) for a lettered Unique chip and Name for a World chip', () => {
    expect(placementDisplayName(token(chip('town', 't2')), 'Town Name', letters)).toBe('Town Name (B)');
    expect(placementDisplayName(token(chip('town', 'w1', 'world')), 'Town Name', letters)).toBe('Town Name');
  });

  it('prefers the author label over the default', () => {
    expect(placementDisplayName(token(chip('town', 't1', 'unique', 'Hometown')), 'Town Name', letters)).toBe('Hometown');
  });

  it('falls back to Name (Unique) where no index covers the placement', () => {
    expect(placementDisplayName(token(chip('town', 'elsewhere')), 'Town Name', letters)).toBe('Town Name (Unique)');
    expect(placementDisplayName(token(chip('town', 't1')), 'Town Name')).toBe('Town Name (Unique)');
  });
});

describe('labelPlaceholders', () => {
  const placeholders = [TOWN, EYE];
  const letters = placementLetters([chip('town', 't1'), chip('town', 't2'), chip('eye', 'e1', 'unique', 'Left')]);

  it('reads a lone chip bare and an embedded one braced', () => {
    expect(labelPlaceholders(chip('town', 't2'), placeholders, { letters })).toBe('Town Name (B)');
    expect(labelPlaceholders(`The ${chip('town', 't1')} Inn`, placeholders, { letters })).toBe('The {Town Name (A)} Inn');
  });

  it('shows a World chip by name, with no letter', () => {
    expect(labelPlaceholders(chip('town', 'w1', 'world'), placeholders, { letters })).toBe('Town Name');
  });

  it('shows the author label where one is set', () => {
    expect(labelPlaceholders(chip('eye', 'e1', 'unique', 'Left'), placeholders, { letters })).toBe('Left');
  });

  it('marks a chip whose placeholder is gone with ?, carrying its label', () => {
    expect(labelPlaceholders(chip('gone', 'g1'), placeholders, { letters })).toBe('?');
    expect(labelPlaceholders(chip('gone', 'g1', 'unique', 'Rival'), placeholders, { letters })).toBe('? Rival');
  });

  it('reads a drilled chip as its whole path', () => {
    const molly = P('molly', 'Molly', [chip('hair', 'inner', 'world')]);
    const hair = P('hair', 'Hair', ['chestnut']);
    const drilled = encodePlaceholderToken({ id: 'molly', mode: 'world', placementId: 'p', path: [{ kind: 'val', ref: 'hair' }] });
    expect(labelPlaceholders(drilled, [molly, hair])).toBe('Molly › Hair');
  });

  it('leaves text with no chips alone', () => {
    expect(labelPlaceholders('plain', placeholders, { letters })).toBe('plain');
    expect(labelPlaceholders('', placeholders, { letters })).toBe('');
  });
});

describe('the walk over placeholders an entity or a book carries', () => {
  // A Unique chip inside a scoped placeholder's value counts like any other: after the world's own values,
  // entities before books, so its letter sits where the combined list puts the row.
  it('letters scoped values after the world list, entities first, then books', () => {
    const letters = worldPlacementLetters({
      placeholders: [P('own', 'Own', [chip('eye', 'w1')])],
      dictionaries: [{ id: 'b', name: 'B', entries: [], placeholders: [P('lore', 'Lore', [chip('eye', 'b1')])] }],
      entities: [{ id: 'e', name: 'Molly', placeholders: [P('eyes', 'Eyes', [chip('eye', 'e1')])] }],
    });
    expect(letters.get('w1')).toBe('A');
    expect(letters.get('e1')).toBe('B');
    expect(letters.get('b1')).toBe('C');
  });
});

describe('owner-qualified names', () => {
  // Eyes and Iris belong to Molly, Mane to Tam; Town is shared. Molly's own name is a chip.
  const owners = new Map([
    ['eye', { kind: 'entity' as const, id: 'molly', name: `Molly of ${chip('town', 'm1', 'world')}` }],
    ['iris', { kind: 'entity' as const, id: 'molly', name: 'Molly' }],
    ['mane', { kind: 'entity' as const, id: 'tam', name: 'Tam' }],
  ]);
  const placeholders = [TOWN, EYE, P('iris', 'Iris', ['dark']), P('mane', 'Mane', ['red'])];
  const eye = decodePlaceholderToken(chip('eye', 'e1', 'world'))!;

  it('prefixes a scoped placeholder with its owner away from the owner, and reads its owner’s own chips by name', () => {
    expect(chipPathName(eye, placeholders, { owners })).toBe('Molly of {Town Name} › Eye');
    expect(chipPathName(decodePlaceholderToken(chip('town', 't', 'world'))!, placeholders, { owners })).toBe('Town Name');
  });

  it('reads bare inside the owner’s own fields, and inside a placeholder of the same owner', () => {
    expect(chipPathName(eye, placeholders, { owners, relativeTo: 'molly' })).toBe('Eye');
    expect(chipPathName(eye, placeholders, { owners, relativeTo: 'iris' })).toBe('Eye');
    expect(chipPathName(eye, placeholders, { owners, relativeTo: 'tam' })).toBe('Molly of {Town Name} › Eye');
  });

  it('carries the prefix through the plain-text label and the search names', () => {
    const letters = placementLetters([chip('eye', 'e1')]);
    expect(labelPlaceholders(`${chip('eye', 'e1')} and ${chip('mane', 'x', 'world')}`, placeholders, { letters, owners }))
      .toBe('{Molly of {Town Name} › Eye (A)} and {Tam › Mane}');
    expect(chipPlaceholderNames(chip('mane', 'x', 'world'), placeholders, { owners })).toEqual(['Tam › Mane']);
    // Without an owner index, nothing is prefixed.
    expect(labelPlaceholders(chip('mane', 'x', 'world'), placeholders)).toBe('Mane');
  });
});
