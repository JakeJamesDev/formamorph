import { describe, it, expect } from 'vitest';
import type { Dictionary, Entity, Placeholder, PlaceholderGroup } from '@/types';
import {
  acceptsBlueprintChips, dropBlueprintChips, dropBookBlueprintChips, dropEntityBlueprintChips, isBlueprintChip, type ChipField,
} from './blueprintChips';

const chip = (id: string, placement = `p-${id}`) => `{{ph:${id}:world:${placement}}}`;
const group: PlaceholderGroup = { id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' };
const garb: Placeholder = { id: 'garb', name: 'Garb', groupId: 'bp', values: [{ id: 'v1', text: 'tabard' }] };
// Owned by Garb: a part of the blueprint.
const trim: Placeholder = { id: 'trim', name: 'Trim', ownerId: 'garb', values: [{ id: 'v2', text: 'gold' }] };
const town: Placeholder = { id: 'town', name: 'Town', values: [{ id: 'v3', text: 'Harrow' }] };
const street: Placeholder = { id: 'street', name: 'Street', ownerId: 'town', values: [{ id: 'v4', text: 'Mill Lane' }] };
const copy: Placeholder = { id: 'albus-garb', name: 'Garb', blueprintId: 'garb', values: [] };
const own: Placeholder = { id: 'albus-eyes', name: 'Eyes', values: [{ id: 'v5', text: 'gray' }] };
const albus = { id: 'albus', name: 'Albus', placeholders: [copy, own] } as Entity;
const world = { placeholders: [garb, trim, town, street], placeholderGroups: [group], entities: [albus] };

describe('acceptsBlueprintChips', () => {
  const cases: [string, ChipField, boolean][] = [
    ['a world trait’s text', { kind: 'trait', owned: false }, true],
    ['an entity-owned trait’s text', { kind: 'trait', owned: true }, false],
    ['a blueprint’s values', { kind: 'values', placeholderId: 'garb' }, true],
    ['a placeholder a blueprint owns', { kind: 'values', placeholderId: 'trim' }, true],
    ['a copy’s values', { kind: 'values', placeholderId: 'albus-garb' }, true],
    ['a world placeholder’s values', { kind: 'values', placeholderId: 'town' }, false],
    ['a placeholder a world placeholder owns', { kind: 'values', placeholderId: 'street' }, false],
    ['an entity’s own placeholder’s values', { kind: 'values', placeholderId: 'albus-eyes' }, false],
    ['a missing placeholder’s values', { kind: 'values', placeholderId: 'gone' }, false],
    ['any other text', { kind: 'text' }, false],
  ];
  it.each(cases)('%s', (_name, field, accepted) => {
    expect(acceptsBlueprintChips(field, world)).toBe(accepted);
  });

  it('reads a placeholder outside the Blueprints group as a world placeholder', () => {
    const loose = { ...world, placeholderGroups: [] };
    expect(acceptsBlueprintChips({ kind: 'values', placeholderId: 'garb' }, loose)).toBe(false);
  });
});

describe('dropBlueprintChips', () => {
  const blueprints = new Set(['garb']);

  it('removes each blueprint chip, keeps the text around it and every other chip, and counts', () => {
    expect(dropBlueprintChips(`In ${chip('garb')} at ${chip('town')}, ${chip('garb', 'p2')}.`, blueprints))
      .toEqual({ text: `In  at ${chip('town')}, .`, dropped: 2 });
  });

  it('leaves text with no blueprint chip as it is', () => {
    const text = `At ${chip('town')}.`;
    expect(dropBlueprintChips(text, blueprints)).toEqual({ text, dropped: 0 });
    expect(dropBlueprintChips(text, new Set())).toEqual({ text, dropped: 0 });
  });

  it('tells a blueprint chip from any other token', () => {
    expect(isBlueprintChip(chip('garb'), blueprints)).toBe(true);
    expect(isBlueprintChip(chip('town'), blueprints)).toBe(false);
    expect(isBlueprintChip('{{user}}', blueprints)).toBe(false);
  });
});

describe('dropping blueprint chips at import', () => {
  const blueprints = new Set(['garb']);
  const G = chip('garb');
  const T = chip('town');

  it('drops them from an entity’s text and its own placeholders, and keeps them in its copies and owned traits', () => {
    // A card carries partial records; only the texts under test matter here.
    const card = {
      id: 'kit', name: `Kit ${G}`, aiDescription: `Wears ${G} in ${T}.`, openings: [{ id: 'o1', kind: 'narration', text: `${G}!` }],
      traits: [{ id: 't1', name: 'Oath', aiDescription: `Sworn in ${G}.`, statChanges: [] }],
      traitGroups: [{ id: 'g1', name: `${G} Ways`, parentId: null }],
      placeholders: [
        { id: 'kit-garb', name: 'Garb', blueprintId: 'garb', values: [], valueOverrides: {} },
        { id: 'kit-trim', name: 'Trim', ownerId: 'kit-garb', values: [{ id: 'v1', text: `${G} hem` }] },
        { id: 'kit-eyes', name: 'Eyes', values: [{ id: 'v2', text: `${G} gray` }] },
      ],
    } as unknown as Entity;
    const { entity, dropped } = dropEntityBlueprintChips(card, blueprints);
    expect(dropped).toBe(4);
    expect(entity.name).toBe('Kit ');
    expect(entity.aiDescription).toBe(`Wears  in ${T}.`);
    expect(entity.openings?.[0].text).toBe('!');
    // The copies reconcile points these at Kit's own copy.
    expect(entity.traits?.[0].aiDescription).toBe(`Sworn in ${G}.`);
    expect(entity.traitGroups?.[0].name).toBe(`${G} Ways`);
    expect(entity.placeholders?.map((p) => p.values[0]?.text)).toEqual([undefined, `${G} hem`, ' gray']);
  });

  it('drops them from a book’s entries and its placeholders', () => {
    // A partial book; only the texts under test matter here.
    const book = {
      id: 'b1', name: 'Lore', entries: [{ id: 'e1', name: `${G}`, key: [`${G} key`, 'plain'], value: `About ${G}.` }],
      placeholders: [{ id: 'b-ph', name: 'Mood', values: [{ id: 'v3', text: G }] }],
    } as unknown as Dictionary;
    const out = dropBookBlueprintChips(book, blueprints);
    expect(out.dropped).toBe(4);
    expect(out.book.entries[0]).toMatchObject({ name: '', key: [' key', 'plain'], value: 'About .' });
    expect(out.book.placeholders?.[0].values[0].text).toBe('');
  });

  it('hands back the same record when nothing drops', () => {
    const plain = { id: 'kit', name: 'Kit', aiDescription: `In ${T}.` } as Entity;
    expect(dropEntityBlueprintChips(plain, blueprints)).toEqual({ entity: plain, dropped: 0 });
    expect(dropEntityBlueprintChips(plain, blueprints).entity).toBe(plain);
  });
});
