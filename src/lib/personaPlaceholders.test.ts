import { describe, expect, it } from 'vitest';
import { personaPlaceholderSet, primePersonaRolls } from './personaPlaceholders';
import { encodePlaceholderToken, newPlaceholder, resolvePlaceholders, type PlaceholderPick } from './placeholders';
import type { Entity } from '@/types';

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

/** Picks the last value, so a roll is known without being random. */
const last: PlaceholderPick = (values) => values[values.length - 1].text;

describe('personaPlaceholderSet', () => {
  it('is the world list itself when no persona is set', () => {
    expect(personaPlaceholderSet(worldList, null)).toBe(worldList);
  });

  it('is the world list itself for a persona with no placeholders', () => {
    expect(personaPlaceholderSet(worldList, persona({ placeholders: undefined }))).toBe(worldList);
  });

  it('joins the world list and the persona list, world first, without writing the world list', () => {
    const set = personaPlaceholderSet(worldList, persona({ sharedPlaceholders: [COAT] }));
    expect(set.map((p) => p.name)).toEqual(['Town', 'Eyes', 'Coat']);
    expect(worldList.map((p) => p.name)).toEqual(['Town']);
  });

  it('keeps the world copy when the persona carries a placeholder with the same id', () => {
    const carried = { ...TOWN, values: [{ id: 'other', text: 'Elsewhere' }] };
    const set = personaPlaceholderSet(worldList, persona({ sharedPlaceholders: [carried] }));
    expect(set.filter((p) => p.id === TOWN.id)).toEqual([TOWN]);
  });
});

describe('primePersonaRolls', () => {
  it('draws the persona Wildcards and keeps every roll already drawn', () => {
    const existing = { world: { [TOWN.id]: 'Sedge' } };
    const rolls = primePersonaRolls(worldList, persona(), existing, last);
    expect(rolls.world).toEqual({ [TOWN.id]: 'Sedge', [EYES.id]: 'amber' });
  });

  it('never redraws a persona roll that already exists', () => {
    const existing = { world: { [EYES.id]: 'gray' } };
    expect(primePersonaRolls(worldList, persona(), existing, last)).toEqual(existing);
  });

  it('draws nothing and returns the same rolls for a persona with no placeholders', () => {
    const existing = { world: { [TOWN.id]: 'Sedge' } };
    expect(primePersonaRolls(worldList, persona({ placeholders: undefined }), existing, last)).toBe(existing);
  });

  it('resolves the persona text to its drawn roll', () => {
    const p = persona();
    const rolls = primePersonaRolls(worldList, p, {}, last);
    const text = resolvePlaceholders(p.aiDescription!, { placeholders: personaPlaceholderSet(worldList, p), rolls });
    expect(text).toBe('Wren has amber eyes.');
  });
});
