import { describe, expect, it } from 'vitest';
import { libraryPlaceholderSet, primeLibraryRolls } from './libraryPlaceholders';
import { encodePlaceholderToken, newPlaceholder, resolvePlaceholders, type PlaceholderPick } from './placeholders';
import type { Dictionary, Entity } from '@/types';

const TOWN = newPlaceholder('Town', ['Sedge', 'Marrow']);
const EYES = newPlaceholder('Eyes', ['gray', 'green', 'amber']);
const COAT = newPlaceholder('Coat', ['wool', 'oilskin']);
const worldList = [TOWN];
const chip = (id: string, placementId: string) => encodePlaceholderToken({ id, mode: 'world', placementId });

const persona = (extra: Partial<Entity> = {}): Entity => ({
  id: 'l-wren',
  name: 'Wren',
  aiDescription: `Wren has ${chip(EYES.id, 'p-eyes')} eyes.`,
  placeholders: [EYES],
  ...extra,
});

const TIDE = newPlaceholder('Tide', ['ebb', 'flood']);
const book = (extra: Partial<Dictionary> = {}): Dictionary => ({
  id: 'run-almanac', name: 'Almanac', placeholders: [TIDE],
  entries: [{ id: 'e-sea', name: 'Sea', key: ['sea'], value: `The sea is at ${chip(TIDE.id, 'a-tide')}.` }],
  ...extra,
});

/** Picks the last value, so a roll is known without being random. */
const last: PlaceholderPick = (values) => values[values.length - 1].text;

describe('libraryPlaceholderSet', () => {
  it('is the world list itself when no persona is set', () => {
    expect(libraryPlaceholderSet(worldList, [null])).toBe(worldList);
  });

  it('is the world list itself for a persona with no placeholders', () => {
    expect(libraryPlaceholderSet(worldList, [persona({ placeholders: undefined })])).toBe(worldList);
  });

  it('joins the world list and the persona list, world first, without writing the world list', () => {
    const set = libraryPlaceholderSet(worldList, [persona({ sharedPlaceholders: [COAT] })]);
    expect(set.map((p) => p.name)).toEqual(['Town', 'Eyes', 'Coat']);
    expect(worldList.map((p) => p.name)).toEqual(['Town']);
  });

  it('keeps the world copy when the persona carries a placeholder with the same id', () => {
    const carried = { ...TOWN, values: [{ id: 'other', text: 'Elsewhere' }] };
    const set = libraryPlaceholderSet(worldList, [persona({ sharedPlaceholders: [carried] })]);
    expect(set.filter((p) => p.id === TOWN.id)).toEqual([TOWN]);
  });

  it('joins each item in order, a book included, and keeps the first copy of a shared id', () => {
    const set = libraryPlaceholderSet(worldList, [persona(), book({ sharedPlaceholders: [EYES] })]);
    expect(set.map((p) => p.name)).toEqual(['Town', 'Eyes', 'Tide']);
  });
});

describe('primeLibraryRolls', () => {
  const setOf = (...items: (Entity | Dictionary)[]) => libraryPlaceholderSet(worldList, items);

  it('draws the persona Wildcards and keeps every roll already drawn', () => {
    const existing = { world: { [TOWN.id]: 'Sedge' } };
    const rolls = primeLibraryRolls(setOf(persona()), [persona()], existing, last);
    expect(rolls.world).toEqual({ [TOWN.id]: 'Sedge', [EYES.id]: 'amber' });
  });

  it('draws the Wildcards a book’s entries place', () => {
    expect(primeLibraryRolls(setOf(book()), [book()], {}, last).world).toEqual({ [TIDE.id]: 'flood' });
  });

  it('never redraws a persona roll that already exists', () => {
    const existing = { world: { [EYES.id]: 'gray' } };
    expect(primeLibraryRolls(setOf(persona()), [persona()], existing, last)).toEqual(existing);
  });

  it('draws nothing and returns the same rolls for a persona with no placeholders', () => {
    const existing = { world: { [TOWN.id]: 'Sedge' } };
    const plain = persona({ placeholders: undefined });
    expect(primeLibraryRolls(setOf(plain), [plain], existing, last)).toBe(existing);
  });

  it('resolves the persona text to its drawn roll', () => {
    const p = persona();
    const rolls = primeLibraryRolls(setOf(p), [p], {}, last);
    const text = resolvePlaceholders(p.aiDescription!, { placeholders: setOf(p), rolls });
    expect(text).toBe('Wren has amber eyes.');
  });
});
