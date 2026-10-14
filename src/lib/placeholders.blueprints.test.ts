import { describe, it, expect } from 'vitest';
import type { Entity, Placeholder, PlaceholderValue } from '@/types';
import { copyLookup, readerFor } from './blueprints';
import { describePlaceholders, encodePlaceholderToken, primeRolls, resolvePlaceholders } from './placeholders';

const value = (id: string, text: string): PlaceholderValue => ({ id, text });
const chip = (id: string) => encodePlaceholderToken({ id, mode: 'world', placementId: `p-${id}` });
const first = (values: PlaceholderValue[]) => values[0].text;

// Garb is a blueprint Wildcard; Outfit is a blueprint whose one value nests Garb.
const garb: Placeholder = { id: 'garb', name: 'Garb', values: [value('v-tabard', 'tabard'), value('v-robe', 'robe')] };
const outfit: Placeholder = { id: 'outfit', name: 'Outfit', values: [value('v-outfit', `a ${chip('garb')} and boots`)] };
const shared = [garb, outfit];

const copyOfGarb = (id: string, text: string): Placeholder =>
  ({ id, name: 'Garb', blueprintId: 'garb', values: [], valueOverrides: { 'v-tabard': { text: { value: text, blueprint: 'tabard' } } } });
const entity = (id: string, placeholders: Placeholder[], extra: Partial<Entity> = {}): Entity =>
  ({ id, name: id, placeholders, ...extra } as Entity);

const albus = entity('albus', [copyOfGarb('albus-garb', 'plate'), { id: 'albus-outfit', name: 'Outfit', blueprintId: 'outfit', values: [] }]);
const mira = entity('mira', [copyOfGarb('mira-garb', 'leathers')]);
const all = (entities: Entity[]) => [...shared, ...entities.flatMap((e) => e.placeholders ?? [])];

/** Resolve `text` as `owner`'s trait text: its copies stand in for the blueprints its chips name. */
const asOwner = (text: string, entities: Entity[], owner: Entity | null, persona?: Parameters<typeof readerFor>[0]) =>
  resolvePlaceholders(text, {
    placeholders: all(entities), rolls: {}, pick: first,
    copies: copyLookup({ placeholders: shared, entities }, readerFor(persona, owner, !owner)),
  });

describe('a blueprint chip in trait text', () => {
  const text = `Wears ${chip('garb')}.`;

  it('reads each owner’s own copy', () => {
    expect(asOwner(text, [albus, mira], albus)).toBe('Wears plate.');
    expect(asOwner(text, [albus, mira], mira)).toBe('Wears leathers.');
  });

  it('reads the blueprint with no copy lookup', () => {
    expect(resolvePlaceholders(text, { placeholders: all([albus]), rolls: {}, pick: first })).toBe('Wears tabard.');
  });

  it('reads the blueprint for an owner that holds no copy', () => {
    expect(asOwner(text, [albus, entity('oren', [])], entity('oren', []))).toBe('Wears tabard.');
  });

  it('resolves nested blueprint chips on the same owner', () => {
    expect(asOwner(`In ${chip('outfit')}.`, [albus, mira], albus)).toBe('In a plate and boots.');
    expect(asOwner(`In ${chip('outfit')}.`, [albus, mira], mira)).toBe('In a leathers and boots.');
  });

  it('reads the blueprint itself under None with no Custom Persona entity', () => {
    expect(asOwner(text, [albus, mira], null, { source: 'none' })).toBe('Wears tabard.');
  });

  it('reads the Custom Persona entity’s copy for the player under None', () => {
    const marked = entity('you', [copyOfGarb('you-garb', 'rags')], { customPersona: true });
    expect(asOwner(text, [albus, marked], null, { source: 'none' })).toBe('Wears rags.');
  });

  it('rolls each owner’s copy under its own key', () => {
    const rolls = { world: { garb: 'robe', 'albus-garb': 'plate' } };
    const copies = copyLookup({ placeholders: shared, entities: [albus] }, readerFor(undefined, albus, false));
    expect(resolvePlaceholders(text, { placeholders: all([albus]), rolls })).toBe('Wears robe.');
    expect(resolvePlaceholders(text, { placeholders: all([albus]), rolls, copies })).toBe('Wears plate.');
  });

  it('reads a pin bound to the owner’s copy', () => {
    const copies = copyLookup({ placeholders: shared, entities: [albus] }, readerFor(undefined, albus, false));
    const pins = { 'albus-garb': 'robe' };
    expect(resolvePlaceholders(text, { placeholders: all([albus]), rolls: {}, pick: first, pins, copies })).toBe('Wears robe.');
  });
});

describe('a chip aimed at a copy', () => {
  it('reads the copy’s effective values, the blueprint’s under its overrides', () => {
    const text = `Wears ${chip('albus-garb')}.`;
    expect(resolvePlaceholders(text, { placeholders: all([albus]), rolls: { world: { 'albus-garb': 'robe' } } })).toBe('Wears robe.');
    expect(resolvePlaceholders(text, { placeholders: all([albus]), rolls: {}, pick: first })).toBe('Wears plate.');
  });
});

describe('describePlaceholders with a copy lookup', () => {
  it('describes the owner’s copy', () => {
    const copies = copyLookup({ placeholders: shared, entities: [albus] }, readerFor(undefined, albus, false));
    expect(describePlaceholders(chip('garb'), all([albus]))).toBe('{tabard|robe}');
    expect(describePlaceholders(chip('garb'), all([albus]), undefined, copies)).toBe('{plate|robe}');
    expect(describePlaceholders(chip('outfit'), all([albus]), undefined, copies)).toBe('a {plate|robe} and boots');
  });
});

describe('primeRolls with a copy lookup', () => {
  it('mints the owner’s copy roll, not the blueprint’s', () => {
    const copies = copyLookup({ placeholders: shared, entities: [albus] }, readerFor(undefined, albus, false));
    const rolls = primeRolls(all([albus]), [chip('outfit')], {}, first, undefined, copies);
    expect(rolls.world).toEqual({ 'albus-garb': 'plate' });
  });
});
