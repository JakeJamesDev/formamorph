import { describe, it, expect } from 'vitest';
import { entityTraitNames, sandboxTraits, savedTraits, worldTraitPlaces } from './statCodeTraits';
import { applyCodeTraitSwitches, type TraitWorld } from './traitRuntime';
import type { Entity, EntityGroup, Placeholder, Trait, TraitGroup } from '@/types';

describe('savedTraits', () => {
  const saved: Trait = { id: 'brave', name: 'Brave', statChanges: [{ statId: 'h', value: 10, type: 'starting' }] };
  const authored: Trait = { id: 'brave', name: 'Bold', playerToggle: true, statChanges: [{ statId: 'h', value: 99, type: 'starting' }] };

  it('re-reads each trait from the world but keeps the stat changes the save settled against', () => {
    const { acquired } = savedTraits({ playerTraits: [saved] }, [authored]);
    expect(acquired).toEqual([{ ...authored, statChanges: saved.statChanges }]);
  });

  it('reads a save with no switched-off traits, no records and no cascade-off list as empty', () => {
    expect(savedTraits({ playerTraits: [] }, []))
      .toEqual({ acquired: [], disabledTraitIds: [], appliedValues: {}, cascadeOffTraitIds: {}, ownedTraits: {} });
  });

  it('carries the switched-off ids, the movement records, the cascade-off list and owned state through', () => {
    const out = savedTraits({
      playerTraits: [saved], disabledTraitIds: ['brave'], appliedTraitValues: { brave: { h: 10 } },
      cascadeOffTraitIds: { world: ['brave'] }, ownedTraits: { ash: { chosen: ['tamed'] } },
    }, [authored]);
    expect(out).toMatchObject({
      disabledTraitIds: ['brave'], appliedValues: { brave: { h: 10 } }, cascadeOffTraitIds: { world: ['brave'] },
      ownedTraits: { ash: { chosen: ['tamed'] } },
    });
  });
});

describe('sandboxTraits under gates', () => {
  // A code switch-on of a locked trait leaves it acquired and off; the sandbox entry keeps its three fields.
  const paladin: Trait = { id: 'paladin', name: 'Paladin', statChanges: [] };
  const plate: Trait = { id: 'plate', name: 'Plate Armor', statChanges: [], requires: [{ kind: 'trait', id: 'paladin' }] };
  const world = { traits: [paladin, plate], groups: [] };

  it('reads a locked trait code switched on as acquired and not enabled', () => {
    const start = { stats: [], traits: [], disabledTraitIds: [], appliedValues: {} };
    const { state } = applyCodeTraitSwitches(start, [{ traitId: 'plate', enabled: true, by: 'Vigor' }], world);
    expect(sandboxTraits({ acquired: state.traits, disabledTraitIds: state.disabledTraitIds, appliedValues: {}, world }, []))
      .toEqual([
        { id: 'paladin', name: 'Paladin', mode: 'optional', available: true, group: '', playerToggle: false, acquired: false, enabled: false },
        { id: 'plate', name: 'Plate Armor', mode: 'optional', available: false, group: '', playerToggle: false, acquired: true, enabled: false },
      ]);
  });
});

describe('applyCodeTraitSwitches on a bearer’s own trait', () => {
  const group: TraitGroup = { id: 'g', name: 'Mood', parentId: null, maxPicks: 1 };
  const calm: Trait = { id: 'calm', name: 'Calm', groupId: 'g', statChanges: [] };
  const angry: Trait = { id: 'angry', name: 'Angry', groupId: 'g', statChanges: [] };
  const sworn: Trait = { id: 'sworn', name: 'Sworn', mode: 'alwaysOn', statChanges: [] };
  const fury: Trait = { id: 'fury', name: 'Fury', statChanges: [], requires: [{ kind: 'trait', id: 'angry' }] };
  const mira = { id: 'mira', name: 'Mira', traits: [calm, angry, sworn, fury], groups: [group] };
  const world: TraitWorld = {
    traits: [], groups: [], entities: [{ id: 'mira', name: 'Mira', persona: true }], persona: { source: 'world', entityId: 'mira' },
    bearers: [{ id: 'world', name: '', traits: [], groups: [] }, mira],
  };
  // Always On Sworn is on from the start, as play seeds it.
  const start = (chosen: string[]) => ({
    stats: [], traits: [], disabledTraitIds: [], appliedValues: {}, ownedTraits: { mira: { chosen: ['sworn', ...chosen] } },
  });
  const flip = (chosen: string[], traitId: string, enabled: boolean) =>
    applyCodeTraitSwitches(start(chosen), [{ traitId, enabled, by: 'Vigor', ownerId: 'mira' }], world);

  it('retires the active sibling in the bearer’s own Up to One group', () => {
    const { state, log } = flip(['calm'], 'angry', true);
    expect(state.ownedTraits?.mira).toEqual({ chosen: ['sworn', 'calm', 'angry'], disabled: ['calm'] });
    expect(log).toEqual(['Trait switched off: Calm (by Vigor)', 'Acquired trait: Angry (by Vigor)']);
    expect(state.traits).toEqual([]);
  });

  it('never switches an Always On trait', () => {
    const { state, log } = flip([], 'sworn', false);
    expect(state.ownedTraits?.mira).toEqual({ chosen: ['sworn'] });
    expect(log).toEqual([]);
  });

  it('applies a locked switch-on, which the settle then turns off', () => {
    const { state } = flip(['calm'], 'fury', true);
    expect(state.ownedTraits?.mira?.chosen).toContain('fury');
    expect(state.ownedTraits?.mira?.disabled).toContain('fury');
    // A locked switch-on retires nothing.
    expect(state.ownedTraits?.mira?.disabled).not.toContain('calm');
  });

  it('does nothing for a switch to the state the trait already holds', () => {
    const { state, log } = flip(['calm'], 'calm', true);
    expect(state).toEqual(start(['calm']));
    expect(log).toEqual([]);
  });
});

describe('entityTraitNames', () => {
  const cursed: Trait = { id: 'cursed', name: 'Cursed', statChanges: [] };
  const link = { id: 'l1', originalId: 'cursed', kind: 'trait' as const, originalName: 'Cursed', groupId: null };
  const entities: Entity[] = [
    { id: 'mira', name: 'Mira', persona: true, traits: [{ id: 'scarred', name: 'Scarred', statChanges: [] }], traitLinks: [link] },
    { id: 'ash', name: 'Ash', traits: [{ id: 'loyal', name: 'Loyal', statChanges: [] }] },
    { id: 'wanderer', name: 'Wanderer', customPersona: true, traits: [{ id: 'marked', name: 'Marked', statChanges: [] }] },
  ];

  it('lists each entity’s traits, owned or linked, and marks the ones a persona choice can play', () => {
    expect(entityTraitNames({ traits: [cursed], traitGroups: [], entities }, [])).toEqual([
      { id: 'mira', name: 'Mira', persona: true, folder: [], tabPosition: 0, traits: [
        { id: 'scarred', name: 'Scarred', path: [], tabPosition: 0 }, { id: 'cursed', name: 'Cursed', path: [], tabPosition: 1 },
      ] },
      { id: 'ash', name: 'Ash', persona: false, traits: [{ id: 'loyal', name: 'Loyal', path: [], tabPosition: 0 }], folder: [], tabPosition: 1 },
      { id: 'wanderer', name: 'Wanderer', persona: true, traits: [{ id: 'marked', name: 'Marked', path: [], tabPosition: 0 }], folder: [], tabPosition: 2 },
    ]);
  });

  // Play reads the set in its own order, so only the tab position follows the tree.
  it('places each of an entity’s traits, owned or linked, in its own tree under its group names', () => {
    const groups: TraitGroup[] = [
      { id: 'marks', name: 'Marks', parentId: null, order: 0 },
      { id: 'old', name: '{{ph:ph-sky:world:p1}} Scars', parentId: 'marks', order: 0 },
    ];
    const sky: Placeholder = { id: 'ph-sky', name: 'Sky', values: [{ id: 'v-gray', text: 'Gray' }] };
    const omens: TraitGroup = { id: 'omens', name: 'Omens', parentId: null, order: 0 };
    const portent: Trait = { id: 'portent', name: 'Portent', statChanges: [], groupId: 'omens' };
    const vale: Entity = {
      id: 'vale', name: 'Vale', traitGroups: groups,
      traitLinks: [
        { ...link, groupId: 'marks', order: 1 },
        { id: 'l2', originalId: 'omens', kind: 'group', originalName: 'Omens', groupId: null, order: 1 },
      ],
      traits: [
        { id: 'keen', name: 'Keen', statChanges: [], order: 2 },
        { id: 'scarred', name: 'Scarred', statChanges: [], groupId: 'old', order: 0 },
      ],
    };
    const world = { traits: [cursed, portent], traitGroups: [omens], entities: [vale] };
    expect(entityTraitNames(world, [sky])[0].traits).toEqual([
      { id: 'keen', name: 'Keen', path: [], tabPosition: 3 },
      { id: 'scarred', name: 'Scarred', path: ['Marks', 'Sky Scars'], tabPosition: 0 },
      { id: 'cursed', name: 'Cursed', path: ['Marks'], tabPosition: 1 },
      { id: 'portent', name: 'Portent', path: ['Omens'], tabPosition: 2 },
    ]);
  });

  // Authored order stays, since the sandbox keys a shared name to the last authored entity.
  it('carries each entity’s Entity folder path and its place in the Entities tab', () => {
    const folders: EntityGroup[] = [
      { id: 'crew', name: 'Crew', parentId: null, order: 1 },
      { id: 'deck', name: 'Deck', parentId: 'crew', order: 0 },
      { id: 'gone', name: 'Gone', parentId: null, order: 0 },
    ];
    const filed: Entity[] = [
      { id: 'mira', name: 'Mira', groupId: 'deck', order: 0 },
      { id: 'ash', name: 'Ash', order: 2 },
      { id: 'rook', name: 'Rook', groupId: 'gone', order: 0 },
    ];
    expect(entityTraitNames({ traits: [], traitGroups: [], entities: filed, entityGroups: folders }, [])
      .map(({ name, folder, tabPosition }) => ({ name, folder, tabPosition }))).toEqual([
      { name: 'Mira', folder: ['Crew', 'Deck'], tabPosition: 1 },
      { name: 'Ash', folder: [], tabPosition: 2 },
      { name: 'Rook', folder: ['Gone'], tabPosition: 0 },
    ]);
  });
});

describe('worldTraitPlaces', () => {
  const groups: TraitGroup[] = [
    { id: 'lineage', name: 'Lineage', parentId: null, order: 0 },
    { id: 'storms', name: '{{ph:ph-sky:world:p1}} Storms', parentId: 'lineage', order: 1 },
  ];
  const sky: Placeholder = { id: 'ph-sky', name: 'Sky', values: [{ id: 'v-grey', text: 'Grey' }] };

  it('lists the world’s traits in Traits-tab order, each with its group path under code names', () => {
    const traits: Trait[] = [
      { id: 'plain', name: 'Plain', statChanges: [], order: 1 },
      { id: 'touched', name: 'Touched', statChanges: [], groupId: 'storms', order: 0 },
      { id: 'heir', name: 'Heir', statChanges: [], groupId: 'lineage', order: 0 },
    ];
    expect(worldTraitPlaces({ traits, traitGroups: groups }, [sky])).toEqual([
      { id: 'heir', name: 'Heir', path: ['Lineage'] },
      { id: 'touched', name: 'Touched', path: ['Lineage', 'Sky Storms'] },
      { id: 'plain', name: 'Plain', path: [] },
    ]);
  });
});
