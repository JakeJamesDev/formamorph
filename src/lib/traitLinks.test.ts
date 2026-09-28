import { describe, it, expect } from 'vitest';
import {
  addLink, detachLink, detachDropsStats, dropLinksTo, linkedTraits, linksTo, originalPath, removeLink, resetLink, resetLinkField,
  setLinkField,
} from './traitLinks';
import type { Entity, Trait, TraitGroup, TraitLink } from '@/types';

const trait = (id: string, extra: Partial<Trait> = {}): Trait => ({ id, name: id, statChanges: [], ...extra });
const group = (id: string, parentId: string | null, extra: Partial<TraitGroup> = {}): TraitGroup =>
  ({ id, name: id, parentId, ...extra });
const link = (id: string, originalId: string, kind: TraitLink['kind'], extra: Partial<TraitLink> = {}): TraitLink =>
  ({ id, originalId, kind, originalName: originalId, groupId: null, order: 0, ...extra });
const on = (blueprint: boolean) => ({ isDefault: { value: true, blueprint } });
const off = (blueprint: boolean) => ({ isDefault: { value: false, blueprint } });

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

describe('linkedTraits', () => {
  it('lists the traits a linked row brings, each read through the link\'s overrides or live', () => {
    const l = link('l1', 'classes', 'group', { overrides: { wizard: on(false) } });
    expect(linkedTraits(world, l, 'classes').map((t) => [t.id, !!t.isDefault])).toEqual([
      ['paladin', true], ['wizard', true], ['fire', false],
    ]);
    expect(linkedTraits(world, l, 'schools').map((t) => t.id)).toEqual(['fire']);
    expect(linkedTraits(world, { ...l, overrides: { paladin: off(true) } }, 'paladin')).toMatchObject([{ id: 'paladin', isDefault: false }]);
  });

  it('reads an overridden requirement list, toggle and stat changes, leaving the rest of the trait live', () => {
    const l = link('l1', 'paladin', 'trait', {
      overrides: {
        paladin: {
          requires: { value: [], blueprint: [{ kind: 'trait', id: 'wizard' }] },
          playerToggle: { value: true, blueprint: false },
          statChanges: { value: [{ statId: 's', value: 2, type: 'max' }], blueprint: [] },
        },
      },
    });
    const [paladin] = linkedTraits(world, l, 'paladin');
    expect(paladin).toMatchObject({ name: 'Paladin', isDefault: true, requires: [], playerToggle: true, statChanges: [{ statId: 's', value: 2, type: 'max' }] });
  });
});

describe('linksTo', () => {
  it('counts every link to an original across entities, the Custom Persona entity among them', () => {
    const ents: Entity[] = [
      { id: 'a', name: 'A', traitLinks: [link('l1', 'brave', 'trait'), link('l2', 'classes', 'group')] },
      { id: 'b', name: 'B', traitLinks: [link('l3', 'brave', 'trait')] },
      { id: 'c', name: 'C' },
      { id: 'cp', name: 'Newcomer', customPersona: true, traitLinks: [link('l4', 'brave', 'trait')] },
    ];
    expect(linksTo(ents, 'brave')).toBe(3);
    expect(linksTo(ents, 'classes')).toBe(1);
    expect(linksTo(ents, 'paladin')).toBe(0);
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

  it("drops the Custom Persona entity's links like any entity's", () => {
    const cp: Entity = { id: 'cp', name: 'Newcomer', customPersona: true, traitLinks: [link('l1', 'brave', 'trait'), link('l2', 'classes', 'group')] };
    expect(dropLinksTo([cp], 'brave')[0].traitLinks?.map((l) => l.id)).toEqual(['l2']);
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

describe('setLinkField', () => {
  const a: Entity = { id: 'a', name: 'A', traitLinks: [link('l1', 'classes', 'group')] };

  it("stores the link's own default-on per original trait, each against the original's value", () => {
    const out = setLinkField(world, setLinkField(world, a, 'l1', 'paladin', 'isDefault', false), 'l1', 'wizard', 'isDefault', true);
    expect(out.traitLinks?.[0].overrides).toEqual({ paladin: off(true), wizard: on(false) });
  });

  it('writes nothing for a trait that is not a world trait', () => {
    expect(setLinkField(world, a, 'l1', 'pack', 'isDefault', true)).toBe(a);
  });

  it('resets one field, dropping emptied maps, and resets the whole link', () => {
    const set = setLinkField(world, setLinkField(world, a, 'l1', 'paladin', 'isDefault', false), 'l1', 'paladin', 'playerToggle', true);
    const one = resetLinkField(set, 'l1', 'paladin', 'isDefault');
    expect(one.traitLinks?.[0].overrides).toEqual({ paladin: { playerToggle: { value: true, blueprint: false } } });
    expect(resetLinkField(one, 'l1', 'paladin', 'playerToggle').traitLinks?.[0]).toEqual(link('l1', 'classes', 'group'));
    expect(resetLink(set, 'l1').traitLinks?.[0]).toEqual(link('l1', 'classes', 'group'));
  });
});

describe('detachDropsStats', () => {
  it('reads stat changes and stat toggles anywhere the link brings, as the link reads them', () => {
    expect(detachDropsStats(world, link('l1', 'brave', 'trait'))).toBe(true);
    expect(detachDropsStats(world, link('l1', 'wizard', 'trait'))).toBe(false);
    const toggled = { ...world, traits: [...world.traits, trait('ember', { groupId: 'schools', statToggles: [{ statId: 's', enabled: true }] })] };
    expect(detachDropsStats(toggled, link('l1', 'classes', 'group'))).toBe(true);
    expect(detachDropsStats(world, link('l1', 'classes', 'group'))).toBe(false);
    // An override that adds stat changes counts; one that clears them does not.
    const adds = { wizard: { statChanges: { value: [{ statId: 's', value: 1, type: 'max' as const }], blueprint: [] } } };
    expect(detachDropsStats(world, link('l1', 'classes', 'group', { overrides: adds }))).toBe(true);
    const clears = { brave: { statChanges: { value: [], blueprint: world.traits[3].statChanges } } };
    expect(detachDropsStats(world, link('l1', 'brave', 'trait', { overrides: clears }))).toBe(false);
  });
});

describe('detachLink', () => {
  it('turns a trait link into an owned copy with a new id in the link\'s place, as the link reads it, without stat effects', () => {
    const overrides = { brave: { ...on(false), playerToggle: { value: true, blueprint: false } } };
    const a: Entity = { id: 'a', name: 'A', traitGroups: [group('bond', null)], traitLinks: [link('l1', 'brave', 'trait', { groupId: 'bond', order: 3, overrides })] };
    const out = detachLink(world, a, 'l1')!;
    expect(out.entity).not.toHaveProperty('traitLinks');
    const copy = out.entity.traits!.find((t) => t.id === out.newId)!;
    expect(out.newId).not.toBe('brave');
    expect(copy).toMatchObject({ name: 'brave', groupId: 'bond', order: 3, isDefault: true, playerToggle: true, statChanges: [] });
    expect(copy).not.toHaveProperty('statToggles');
  });

  it('copies a linked group with its subtree under new ids, remapping parents and inner requirements', () => {
    const a: Entity = { id: 'a', name: 'A', traitLinks: [link('l1', 'classes', 'group', { order: 1, overrides: { paladin: off(true) } })] };
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

describe('blueprint pins on links', () => {
  const tabard = { placeholderId: 'garb', value: 'Tabard', valueId: 'v-tabard' };
  const plate = { placeholderId: 'garb', value: 'Plate' };
  const pinned = {
    traits: [trait('paladin', { name: 'Paladin', groupId: 'classes', placeholderPins: [tabard] }), trait('wizard', { groupId: 'classes' })],
    traitGroups: [group('classes', null, { name: 'Classes' })],
  };

  it("stores no pin data of its own on a new link; the original's pin stays aimed at the blueprint", () => {
    const l = addLink(pinned, { id: 'mira', name: 'Mira' }, 'classes', 'new')!.traitLinks![0];
    expect(l).not.toHaveProperty('overrides');
    expect(linkedTraits(pinned, l, 'paladin')[0].placeholderPins).toEqual([tabard]);
  });

  it("overrides the pin list against the original's, and clears it back to live", () => {
    const bearer: Entity = { id: 'mira', name: 'Mira', traitLinks: [link('l1', 'paladin', 'trait')] };
    const set = setLinkField(pinned, bearer, 'l1', 'paladin', 'placeholderPins', [plate]);
    expect(set.traitLinks![0].overrides).toEqual({ paladin: { placeholderPins: { value: [plate], blueprint: [tabard] } } });
    expect(linkedTraits(pinned, set.traitLinks![0], 'paladin')[0].placeholderPins).toEqual([plate]);
    expect(resetLinkField(set, 'l1', 'paladin', 'placeholderPins').traitLinks![0]).toEqual(link('l1', 'paladin', 'trait'));
  });

  it("gives a detached copy the link's pins where it overrides them, and the original's where it does not", () => {
    const valued: Entity = {
      id: 'mira', name: 'Mira', traitLinks: [link('l1', 'paladin', 'trait', { overrides: { paladin: { placeholderPins: { value: [plate], blueprint: [tabard] } } } })],
    };
    expect(detachLink(pinned, valued, 'l1')!.entity.traits![0].placeholderPins).toEqual([plate]);
    const unset: Entity = { id: 'bo', name: 'Bo', traitLinks: [link('l1', 'paladin', 'trait')] };
    expect(detachLink(pinned, unset, 'l1')!.entity.traits![0].placeholderPins).toEqual([tabard]);
  });
});
