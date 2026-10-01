import { describe, it, expect } from 'vitest';
import { personaTraitNames, sandboxTraits, savedTraits } from './statCodeTraits';
import { applyCodeTraitSwitches, type TraitWorld } from './traitRuntime';
import type { Entity, Trait, TraitGroup } from '@/types';

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
        { name: 'Paladin', acquired: false, enabled: false },
        { name: 'Plate Armor', acquired: true, enabled: false },
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

  it('lands a locked switch-on, which the settle then turns off', () => {
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

describe('personaTraitNames', () => {
  const cursed: Trait = { id: 'cursed', name: 'Cursed', statChanges: [] };
  const link = { id: 'l1', originalId: 'cursed', kind: 'trait' as const, originalName: 'Cursed', groupId: null };
  const entities: Entity[] = [
    { id: 'mira', name: 'Mira', persona: true, traits: [{ id: 'scarred', name: 'Scarred', statChanges: [] }], traitLinks: [link] },
    { id: 'ash', name: 'Ash', traits: [{ id: 'loyal', name: 'Loyal', statChanges: [] }] },
    { id: 'wanderer', name: 'Wanderer', customPersona: true, traits: [{ id: 'marked', name: 'Marked', statChanges: [] }] },
  ];

  it('lists every trait a persona-capable entity holds, owned or linked, and no cast entity’s', () => {
    expect(personaTraitNames({ traits: [cursed], traitGroups: [], entities }, [])).toEqual(['Scarred', 'Cursed', 'Marked']);
  });
});
