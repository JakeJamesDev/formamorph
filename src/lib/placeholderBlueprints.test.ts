import { describe, it, expect } from 'vitest';
import type { Entity, Placeholder, PlaceholderGroup, PlaceholderValue, Trait, TraitLink } from '@/types';
import { encodePlaceholderToken } from './placeholders';
import { removePlaceholderGroup } from './placeholderGroups';
import {
  blueprintIds, blueprintMoveRefusal, blueprintsPlaceholderGroup, copyName, type BlueprintUseWorld,
} from './placeholderBlueprints';

const chip = (id: string) => encodePlaceholderToken({ id, mode: 'world', placementId: `p-${id}` });
const value = (id: string, text: string, extra: Partial<PlaceholderValue> = {}): PlaceholderValue => ({ id, text, ...extra });
const ph = (id: string, name: string, extra: Partial<Placeholder> = {}): Placeholder =>
  ({ id, name, values: [value(`${id}-v`, name)], ...extra });
const trait = (id: string, extra: Partial<Trait> = {}): Trait => ({ id, name: id, statChanges: [], ...extra });
const entity = (id: string, extra: Partial<Entity> = {}): Entity =>
  ({ id, name: id, playerDescription: '', aiDescription: '', ...extra } as Entity);

const BLUEPRINTS: PlaceholderGroup = { id: 'bp', name: 'Blueprints', parentId: null, order: 0, system: 'blueprints' };
const SUB: PlaceholderGroup = { id: 'bp-sub', name: 'Classes', parentId: 'bp', order: 0 };
const PLAIN: PlaceholderGroup = { id: 'plain', name: 'Folder', parentId: null, order: 1 };

const garb = ph('garb', 'Class Garb', { groupId: 'bp' });
const heritage = ph('heritage', 'Heritage', { groupId: 'bp-sub' });
const eyes = ph('eyes', 'Eyes');

const world = (extra: Partial<BlueprintUseWorld> = {}): BlueprintUseWorld => ({
  placeholders: [garb, heritage, eyes],
  placeholderGroups: [BLUEPRINTS, SUB, PLAIN],
  entities: [],
  ...extra,
});

/** The world after `id` moves to `groupId`. */
const movedTo = (w: BlueprintUseWorld, id: string, groupId: string | null): BlueprintUseWorld => ({
  ...w,
  placeholders: (w.placeholders ?? []).map((p) => {
    if (p.id !== id) return p;
    const { groupId: _g, ...rest } = p;
    return groupId === null ? rest : { ...rest, groupId };
  }),
});

describe('the Blueprints group', () => {
  it('finds the one system group and the shared placeholders anywhere below it', () => {
    const w = world();
    expect(blueprintsPlaceholderGroup(w.placeholderGroups ?? [])?.id).toBe('bp');
    expect([...blueprintIds(w)].sort()).toEqual(['garb', 'heritage']);
  });

  it('holds no blueprints in a world without the group', () => {
    expect(blueprintIds(world({ placeholderGroups: [PLAIN] })).size).toBe(0);
  });

  it('names a copy after its owner and blueprint', () => {
    expect(copyName('Albus', 'Class Garb')).toBe('Albus.Class Garb');
  });
});

describe('blueprintMoveRefusal: out of Blueprints', () => {
  it('lets an unused blueprint move out', () => {
    const w = world();
    expect(blueprintMoveRefusal(w, movedTo(w, 'garb', null))).toBeNull();
  });

  it('lets a blueprint move between folders inside Blueprints', () => {
    const w = world({ traits: [trait('paladin', { aiDescription: chip('garb') })] });
    expect(blueprintMoveRefusal(w, movedTo(w, 'garb', 'bp-sub'))).toBeNull();
  });

  const cases: [string, Partial<BlueprintUseWorld>, { kind: string; name: string }][] = [
    ['trait text', { traits: [trait('Paladin', { playerDescription: `Wears ${chip('garb')}` })] }, { kind: 'trait', name: 'Paladin' }],
    ['a trait pin', { traits: [trait('Paladin', { placeholderPins: [{ placeholderId: 'garb', value: 'x' }] })] }, { kind: 'trait', name: 'Paladin' }],
    ['a world trait group', { traitGroups: [{ id: 'g', name: `Class ${chip('garb')}`, parentId: null }] }, { kind: 'trait', name: `Class ${chip('garb')}` }],
    ['another blueprint value', {
      placeholders: [garb, { ...heritage, values: [value('h1', `of ${chip('garb')}`)] }, eyes],
    }, { kind: 'blueprint', name: 'Heritage' }],
    ['a copy', {
      entities: [entity('e1', { name: 'Albus', placeholders: [ph('c1', 'Class Garb', { blueprintId: 'garb', values: [] })] })],
    }, { kind: 'copy', name: 'Albus.Class Garb' }],
    ['a link that overrides its pins', {
      traits: [trait('paladin', { name: 'Paladin' })],
      entities: [entity('e1', {
        name: 'Albus',
        traitLinks: [{
          id: 'l1', originalId: 'paladin', kind: 'trait', originalName: 'Paladin', groupId: null, order: 0,
          overrides: { paladin: { placeholderPins: { value: [{ placeholderId: 'garb', value: 'x' }], blueprint: [] } } },
        } satisfies TraitLink],
      })],
    }, { kind: 'trait', name: "Albus's Paladin" }],
  ];
  it.each(cases)('is refused while %s uses it, naming the use', (_name, extra, use) => {
    const w = world(extra);
    const refusal = blueprintMoveRefusal(w, movedTo(w, 'garb', null));
    expect(refusal).toEqual({ reason: 'out', names: ['Class Garb'], uses: [use] });
  });

  it('refuses a move into a plain folder, to an owner and nesting under a row alike', () => {
    const w = world({ traits: [trait('Paladin', { aiDescription: chip('garb') })] });
    expect(blueprintMoveRefusal(w, movedTo(w, 'garb', 'plain'))?.reason).toBe('out');
    const toOwner: BlueprintUseWorld = {
      ...w,
      placeholders: [heritage, eyes],
      entities: [entity('e1', { placeholders: [{ ...garb, groupId: undefined }] })],
    };
    expect(blueprintMoveRefusal(w, toOwner)?.reason).toBe('out');
    const nested: BlueprintUseWorld = {
      ...w,
      placeholders: [{ ...garb, groupId: undefined, ownerId: 'eyes' }, heritage, { ...eyes, values: [value('e', chip('garb'))] }],
    };
    expect(blueprintMoveRefusal(w, nested)?.reason).toBe('out');
  });

  it('refuses a move whose values would leave a blueprint chip in a world value', () => {
    const w = world({ placeholders: [garb, { ...heritage, values: [value('h1', chip('garb'))] }, eyes] });
    const folderOut: BlueprintUseWorld = { ...w, placeholderGroups: [BLUEPRINTS, { ...SUB, parentId: null }, PLAIN] };
    expect(blueprintMoveRefusal(w, folderOut)).toEqual({ reason: 'out', names: ['Heritage'], uses: [], reaches: ['Class Garb'] });
  });

  it('ignores uses that move out with it, and world-side uses that stop mattering once it is out', () => {
    const w = world({
      placeholders: [garb, { ...heritage, values: [value('h1', chip('garb'))] }, eyes],
      entities: [entity('e1', { aiDescription: chip('garb') })],
    });
    const folderOut: BlueprintUseWorld = { ...w, placeholderGroups: [BLUEPRINTS, { ...SUB, parentId: null }, PLAIN] };
    expect(blueprintMoveRefusal(w, movedTo(folderOut, 'garb', 'bp-sub'))).toBeNull();
  });

  it('refuses removing the group while any blueprint in it is used, naming each use once', () => {
    const w = world({
      traits: [trait('Paladin', { aiDescription: `${chip('garb')} ${chip('heritage')}` })],
      entities: [entity('e1', { name: 'Albus', placeholders: [ph('c1', 'Heritage', { blueprintId: 'heritage', values: [] })] })],
    });
    const next = removePlaceholderGroup(w.placeholderGroups ?? [], w.placeholders ?? [], 'bp');
    const refusal = blueprintMoveRefusal(w, { ...w, placeholderGroups: next.groups, placeholders: next.placeholders });
    expect(refusal?.reason).toBe('out');
    expect(refusal?.names).toEqual(['Class Garb', 'Heritage']);
    expect(refusal?.uses).toEqual([{ kind: 'trait', name: 'Paladin' }, { kind: 'copy', name: 'Albus.Heritage' }]);
  });

  it('lets an unused group go', () => {
    const w = world();
    const next = removePlaceholderGroup(w.placeholderGroups ?? [], w.placeholders ?? [], 'bp');
    expect(blueprintMoveRefusal(w, { ...w, placeholderGroups: next.groups, placeholders: next.placeholders })).toBeNull();
  });
});

describe('blueprintMoveRefusal: into Blueprints', () => {
  it('lets an unreferenced placeholder move in', () => {
    const w = world();
    expect(blueprintMoveRefusal(w, movedTo(w, 'eyes', 'bp'))).toBeNull();
  });

  it('lets a placeholder only trait text and blueprint values name move in', () => {
    const w = world({
      traits: [trait('Paladin', { aiDescription: chip('eyes'), placeholderPins: [{ placeholderId: 'eyes', value: 'x' }] })],
      placeholders: [{ ...garb, values: [value('g1', chip('eyes'))] }, heritage, eyes],
    });
    expect(blueprintMoveRefusal(w, movedTo(w, 'eyes', 'bp-sub'))).toBeNull();
  });

  const cases: [string, Partial<BlueprintUseWorld>, { kind: string; name: string }][] = [
    ['an entity', { entities: [entity('Molly', { playerDescription: chip('eyes') })] }, { kind: 'entity', name: 'Molly' }],
    ["an entity's own trait", {
      entities: [entity('e1', { name: 'Molly', traits: [trait('Keen', { aiDescription: chip('eyes') })] })],
    }, { kind: 'trait', name: "Molly's Keen" }],
    ["an entity's own trait pin", {
      entities: [entity('e1', { name: 'Molly', traits: [trait('Keen', { placeholderPins: [{ placeholderId: 'eyes', value: 'x' }] })] })],
    }, { kind: 'trait', name: "Molly's Keen" }],
    ['a location', { locations: [{ id: 'l', name: 'Fen', description: chip('eyes') } as never] }, { kind: 'location', name: 'Fen' }],
    ['a location pin', {
      locations: [{ id: 'l', name: 'Fen', placeholderPins: [{ placeholderId: 'eyes', value: 'x' }] } as never],
    }, { kind: 'location', name: 'Fen' }],
    ['a stat descriptor', {
      stats: [{ id: 's', name: 'Hunger', descriptors: [{ id: 1, threshold: 0, description: chip('eyes') }] } as never],
    }, { kind: 'stat', name: 'Hunger' }],
    ['a stat descriptor pin', {
      stats: [{ id: 's', name: 'Hunger', descriptors: [{ id: 1, threshold: 0, description: '', placeholderPins: [{ placeholderId: 'eyes', value: 'x' }] }] } as never],
    }, { kind: 'stat', name: 'Hunger' }],
    ['a dictionary entry', {
      dictionaries: [{ id: 'd', name: 'Lore', enabled: true, entries: [{ id: 'en', name: 'Fen', key: [], value: chip('eyes') } as never] }],
    }, { kind: 'entry', name: 'Fen' }],
    ['the overview', { worldOverview: { name: 'Sedge', description: chip('eyes') } as never }, { kind: 'overview', name: 'Sedge' }],
    ['a world value', { placeholders: [garb, heritage, eyes, ph('face', 'Face', { values: [value('f1', chip('eyes'))] })] }, { kind: 'placeholder', name: 'Face' }],
    ['a world value pin', {
      placeholders: [garb, heritage, eyes, ph('face', 'Face', { values: [value('f1', 'x', { pins: [{ placeholderId: 'eyes', value: 'y' }] })] })],
    }, { kind: 'placeholder', name: 'Face' }],
    ['an owned value', {
      entities: [entity('e1', { name: 'Molly', placeholders: [ph('mood', 'Mood', { values: [value('m1', chip('eyes'))] })] })],
    }, { kind: 'placeholder', name: 'Mood' }],
  ];
  it.each(cases)('is refused while %s names it, naming the use', (_name, extra, use) => {
    const w = world(extra);
    expect(blueprintMoveRefusal(w, movedTo(w, 'eyes', 'bp'))).toEqual({ reason: 'into', names: ['Eyes'], uses: [use] });
  });

  it('counts a copy value as a blueprint-side use', () => {
    const w = world({
      entities: [entity('e1', { name: 'Albus', placeholders: [ph('c1', 'Class Garb', { blueprintId: 'garb', values: [value('o', chip('eyes'))] })] })],
    });
    expect(blueprintMoveRefusal(w, movedTo(w, 'eyes', 'bp'))).toBeNull();
  });

  it('reads the values a moving placeholder carries as its own once it is in', () => {
    const w = world({ placeholders: [garb, heritage, { ...eyes, values: [value('e1', chip('face'))] }, ph('face', 'Face', { ownerId: 'eyes' })] });
    const next = movedTo(w, 'eyes', 'bp');
    expect(blueprintMoveRefusal(w, next)).toBeNull();
  });
});
