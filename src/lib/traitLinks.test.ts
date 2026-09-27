import { describe, it, expect } from 'vitest';
import {
  addLink, detachLink, detachDropsStats, dropCustomPersonaLinksTo, dropLinksTo, linkDefaultTraits, linksTo, originalPath, removeLink, setLinkDefault,
  setLinkPinValue,
} from './traitLinks';
import type { Entity, Trait, TraitGroup, TraitLink } from '@/types';

const trait = (id: string, extra: Partial<Trait> = {}): Trait => ({ id, name: id, statChanges: [], ...extra });
const group = (id: string, parentId: string | null, extra: Partial<TraitGroup> = {}): TraitGroup =>
  ({ id, name: id, parentId, ...extra });
const link = (id: string, originalId: string, kind: TraitLink['kind'], extra: Partial<TraitLink> = {}): TraitLink =>
  ({ id, originalId, kind, originalName: originalId, groupId: null, order: 0, ...extra });

// Classes (Paladin, Wizard, Schools (Fire)), Brave at the root.
const world = {
  traits: [
    trait('paladin', { name: 'Paladin', groupId: 'classes', order: 0, isDefault: true, requires: [{ kind: 'trait', id: 'wizard' }] }),
    trait('wizard', { groupId: 'classes', order: 1 }),
    trait('fire', { groupId: 'schools' }),
    trait('brave', { groupId: null, statChanges: [{ statId: 's', value: 1, type: 'min' }] }),
  ] satisfies Trait[],
  traitGroups: [group('classes', null, { name: 'Classes', exclusive: true }), group('schools', 'classes', { order: 2 })],
};

describe('addLink', () => {
  it('links an original at the end of the bearer\'s top level, after its owned items and links', () => {
    const bearer: Entity = {
      id: 'ash', name: 'Ash',
      traits: [trait('oath', { groupId: null, order: 0 }), trait('vow', { groupId: 'g-own' })],
      traitGroups: [group('g-own', null, { order: 1 })],
      traitLinks: [link('l1', 'wizard', 'trait', { order: 2 })],
    };
    expect(addLink(world, bearer, 'classes', 'new')?.traitLinks).toEqual([
      link('l1', 'wizard', 'trait', { order: 2 }),
      { id: 'new', originalId: 'classes', kind: 'group', originalName: 'Classes', groupId: null, order: 3 },
    ]);
  });

  it('links nothing when the id is not an original', () => {
    expect(addLink(world, { id: 'ash', name: 'Ash' }, 'gone', 'new')).toBeNull();
  });
});

describe('originalPath', () => {
  it('names the world groups down to the original, the original last', () => {
    expect(originalPath(world, 'fire')).toEqual(['Classes', 'schools', 'fire']);
    expect(originalPath(world, 'classes')).toEqual(['Classes']);
    expect(originalPath(world, 'brave')).toEqual(['brave']);
    expect(originalPath(world, 'gone')).toEqual([]);
  });
});

describe('linkDefaultTraits', () => {
  it('lists the traits a linked row sets defaults for, with the link\'s value or the original\'s', () => {
    const l = link('l1', 'classes', 'group', { defaults: { wizard: true } });
    expect(linkDefaultTraits(world, l, 'classes').map(({ trait: t, on }) => [t.id, on])).toEqual([
      ['paladin', true], ['wizard', true], ['fire', false],
    ]);
    expect(linkDefaultTraits(world, l, 'schools').map(({ trait: t }) => t.id)).toEqual(['fire']);
    expect(linkDefaultTraits(world, { ...l, defaults: { paladin: false } }, 'paladin')).toMatchObject([{ trait: { id: 'paladin' }, on: false }]);
  });
});

describe('linksTo', () => {
  it('counts every link to an original across entities', () => {
    const ents: Entity[] = [
      { id: 'a', name: 'A', traitLinks: [link('l1', 'brave', 'trait'), link('l2', 'classes', 'group')] },
      { id: 'b', name: 'B', traitLinks: [link('l3', 'brave', 'trait')] },
      { id: 'c', name: 'C' },
    ];
    expect(linksTo(ents, 'brave')).toBe(2);
    expect(linksTo(ents, 'classes')).toBe(1);
    expect(linksTo(ents, 'paladin')).toBe(0);
  });

  it("counts Custom Persona's links too", () => {
    const cp = { traitLinks: [link('l4', 'brave', 'trait')] };
    expect(linksTo([{ id: 'a', name: 'A', traitLinks: [link('l1', 'brave', 'trait')] }], 'brave', cp)).toBe(2);
  });
});

describe('dropCustomPersonaLinksTo', () => {
  it("drops Custom Persona's links to one original, and keeps the node when none links it", () => {
    const cp = { traitLinks: [link('l1', 'brave', 'trait'), link('l2', 'classes', 'group')] };
    expect(dropCustomPersonaLinksTo(cp, 'brave')?.traitLinks.map((l) => l.id)).toEqual(['l2']);
    expect(dropCustomPersonaLinksTo(cp, 'wizard')).toBe(cp);
    expect(dropCustomPersonaLinksTo(undefined, 'brave')).toBeUndefined();
  });
});

describe('dropLinksTo', () => {
  it('drops the links to one original and keeps the rest, storing no links as absent', () => {
    const a: Entity = { id: 'a', name: 'A', traitLinks: [link('l1', 'brave', 'trait'), link('l2', 'classes', 'group')] };
    const b: Entity = { id: 'b', name: 'B' };
    const once = dropLinksTo([a, b], 'brave');
    expect(once[0].traitLinks?.map((l) => l.id)).toEqual(['l2']);
    expect(once[1]).toBe(b);
    expect(dropLinksTo(once, 'classes')[0]).not.toHaveProperty('traitLinks');
  });

  it('returns the same array when nothing links the original', () => {
    const ents: Entity[] = [{ id: 'a', name: 'A', traitLinks: [link('l1', 'brave', 'trait')] }];
    expect(dropLinksTo(ents, 'wizard')).toBe(ents);
  });
});

describe('removeLink', () => {
  it('removes the link alone', () => {
    const a: Entity = { id: 'a', name: 'A', traits: [trait('pack')], traitLinks: [link('l1', 'brave', 'trait'), link('l2', 'wizard', 'trait')] };
    const out = removeLink(a, 'l1');
    expect(out.traitLinks?.map((l) => l.id)).toEqual(['l2']);
    expect(out.traits).toEqual(a.traits);
  });
});

describe('setLinkDefault', () => {
  it('stores the link\'s own default-on for one original trait', () => {
    const a: Entity = { id: 'a', name: 'A', traitLinks: [link('l1', 'classes', 'group')] };
    const out = setLinkDefault(setLinkDefault(a, 'l1', 'paladin', false), 'l1', 'wizard', true);
    expect(out.traitLinks?.[0].defaults).toEqual({ paladin: false, wizard: true });
  });
});

describe('detachDropsStats', () => {
  it('reads stat changes and stat toggles anywhere the link brings', () => {
    expect(detachDropsStats(world, link('l1', 'brave', 'trait'))).toBe(true);
    expect(detachDropsStats(world, link('l1', 'wizard', 'trait'))).toBe(false);
    const toggled = { ...world, traits: [...world.traits, trait('ember', { groupId: 'schools', statToggles: [{ statId: 's', enabled: true }] })] };
    expect(detachDropsStats(toggled, link('l1', 'classes', 'group'))).toBe(true);
    expect(detachDropsStats(world, link('l1', 'classes', 'group'))).toBe(false);
  });
});

describe('detachLink', () => {
  it('turns a trait link into an owned copy with a new id in the link\'s place, without stat effects', () => {
    const a: Entity = { id: 'a', name: 'A', traitGroups: [group('bond', null)], traitLinks: [link('l1', 'brave', 'trait', { groupId: 'bond', order: 3, defaults: { brave: true } })] };
    const out = detachLink(world, a, 'l1')!;
    expect(out.entity).not.toHaveProperty('traitLinks');
    const copy = out.entity.traits!.find((t) => t.id === out.newId)!;
    expect(out.newId).not.toBe('brave');
    expect(copy).toMatchObject({ name: 'brave', groupId: 'bond', order: 3, isDefault: true, statChanges: [] });
    expect(copy).not.toHaveProperty('statToggles');
  });

  it('copies a linked group with its subtree under new ids, remapping parents and inner requirements', () => {
    const a: Entity = { id: 'a', name: 'A', traitLinks: [link('l1', 'classes', 'group', { order: 1, defaults: { paladin: false } })] };
    const out = detachLink(world, a, 'l1')!;
    const groups = out.entity.traitGroups!;
    const traits = out.entity.traits!;
    const root = groups.find((g) => g.id === out.newId)!;
    expect(root).toMatchObject({ name: 'Classes', exclusive: true, parentId: null, order: 1 });
    const schools = groups.find((g) => g.name === 'schools')!;
    expect(schools.parentId).toBe(root.id);
    const byName = (n: string) => traits.find((t) => t.name === n)!;
    expect(byName('fire').groupId).toBe(schools.id);
    expect(byName('Paladin')).toMatchObject({ groupId: root.id, isDefault: false });
    expect(byName('Paladin').requires).toEqual([{ kind: 'trait', id: byName('wizard').id }]);
    const ids = [...groups, ...traits].map((x) => x.id);
    expect(ids.some((id) => ['classes', 'schools', 'paladin', 'wizard', 'fire'].includes(id))).toBe(false);
  });

  it('is null for a link that is gone or whose original is gone', () => {
    const a: Entity = { id: 'a', name: 'A', traitLinks: [link('l1', 'gone', 'trait')] };
    expect(detachLink(world, a, 'l1')).toBeNull();
    expect(detachLink(world, a, 'nope')).toBeNull();
  });
});

describe('bearer-relative pin values on links', () => {
  const garb = (value: string, valueId?: string) =>
    ({ placeholderId: '', value, ...(valueId ? { valueId } : {}), bearerPlaceholder: 'Class Garb' });
  const pinned = {
    traits: [trait('paladin', { name: 'Paladin', groupId: 'classes', placeholderPins: [garb('Tabard', 'v-tabard')] }), trait('wizard', { groupId: 'classes' })],
    traitGroups: [group('classes', null, { name: 'Classes' })],
  };
  const ownGarb = [{ id: 'albus-garb', name: 'Class Garb', values: [] }];

  it("starts a new link with the pin's own value where it binds to the world placeholder", () => {
    expect(addLink(pinned, { id: 'mira', name: 'Mira' }, 'classes', 'new')?.traitLinks?.[0].pinValues)
      .toEqual({ paladin: { 'Class Garb': { value: 'Tabard', valueId: 'v-tabard' } } });
  });

  it("starts it unset where the bearer has its own placeholder of that name", () => {
    expect(addLink(pinned, { id: 'albus', name: 'Albus', placeholders: ownGarb }, 'paladin', 'new')?.traitLinks?.[0])
      .not.toHaveProperty('pinValues');
  });

  it('stores and clears one value, dropping emptied maps', () => {
    const bearer: Entity = { id: 'mira', name: 'Mira', traitLinks: [link('l1', 'paladin', 'trait')] };
    const set = setLinkPinValue(bearer, 'l1', 'paladin', 'Class Garb', { value: 'Plate' });
    expect(set.traitLinks![0].pinValues).toEqual({ paladin: { 'Class Garb': { value: 'Plate' } } });
    expect(setLinkPinValue(set, 'l1', 'paladin', 'Class Garb', null).traitLinks![0]).toEqual(link('l1', 'paladin', 'trait'));
  });

  it("gives a detached copy the link's value as its own, and an empty one where the link had none", () => {
    const valued: Entity = {
      id: 'mira', name: 'Mira', traitLinks: [link('l1', 'paladin', 'trait', { pinValues: { paladin: { 'Class Garb': { value: 'Plate' } } } })],
    };
    expect(detachLink(pinned, valued, 'l1')!.entity.traits![0].placeholderPins).toEqual([garb('Plate')]);
    const unset: Entity = { id: 'bo', name: 'Bo', traitLinks: [link('l1', 'paladin', 'trait')] };
    expect(detachLink(pinned, unset, 'l1')!.entity.traits![0].placeholderPins).toEqual([garb('')]);
  });
});
