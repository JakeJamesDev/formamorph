import { describe, expect, it } from 'vitest';
import { applyPreset, emptyEntryDraft, entryGateInput, withLibraryDefaults, withSettledTraits, type EntryDraft, type EntryTraitWorld } from './entryDraft';
import { startLocationIdsOpen } from './inPlayWorld';
import { gateOf, gateStates, settle, switchTrait } from './traitGates';
import { scoped, type OwnerId } from './scope';
import type {
  ChoiceWorldOption, Entity, GameLocation, PresetWorldOption, Stat, StatChange, StatRequirement, Trait, WorldOptionValues,
} from '@/types';

/** Setup gates read the stats the picks start the game with (Q26, Q31). */

const strength = (over: Partial<Stat> = {}): Stat =>
  ({ id: 'str', name: 'Strength', type: 'number', description: '', min: 0, max: 20, value: 4, regen: 0, descriptors: [], ...over });
const needs = (value: number): StatRequirement => ({ kind: 'stat', id: 'str', operator: '>=', value, unit: 'raw' });
const gives = (value: number, type: StatChange['type'] = 'starting'): StatChange => ({ statId: 'str', type, value });
const T = (id: string, over: Partial<Trait> = {}): Trait => ({ id, name: id, statChanges: [], ...over });
const gated = (id: string, value: number, over: Partial<Trait> = {}) => T(id, { requires: [{ all: [needs(value)] }], ...over });

const bodybuilder = T('bodybuilder', { statChanges: [gives(3)] });
const carry = gated('carry', 7);

const worldOf = (traits: Trait[], over: Partial<EntryTraitWorld> = {}): EntryTraitWorld =>
  ({ traits, traitGroups: [], entities: [], library: [], stats: [strength()], ...over });
const draftOf = (traitIds: string[], over: Partial<EntryDraft> = {}): EntryDraft => ({ ...emptyEntryDraft(), traitIds, ...over });
const unlocked = (world: EntryTraitWorld, draft: EntryDraft, id: string, owner: OwnerId = null) =>
  gateOf(gateStates(entryGateInput(world, draft)), owner, id)?.unlocked;
/** One click on a trait, as Enter World runs it; null when the click is refused. */
const click = (world: EntryTraitWorld, draft: EntryDraft, id: string, owner: OwnerId = null) => {
  const result = switchTrait(entryGateInput(world, draft), owner, id);
  return result && { draft: withSettledTraits(draft, result), turnedOff: result.turnedOff };
};

describe('trait gates at setup', () => {
  it('count a pick: Bodybuilder unlocks Carry Capacity', () => {
    const world = worldOf([bodybuilder, carry]);
    expect(unlocked(world, draftOf([]), 'carry')).toBe(false);
    expect(unlocked(world, draftOf(['bodybuilder']), 'carry')).toBe(true);
    expect(click(world, draftOf(['bodybuilder']), 'carry')?.draft.traitIds).toEqual(['bodybuilder', 'carry']);
  });

  it("count an Option value's starting row", () => {
    const might: ChoiceWorldOption = {
      id: 'might', name: 'Might', type: 'choice', shownToPlayer: true, midGame: false, default: 'weak',
      values: [{ id: 'weak', name: 'Weak' }, { id: 'strong', name: 'Strong', statChanges: [gives(3)] }],
    };
    const world = worldOf([carry], { options: [might] });
    const at = (optionValues: WorldOptionValues) => unlocked(world, draftOf([], { optionValues }), 'carry');
    expect(at({ might: 'weak' })).toBe(false);
    expect(at({ might: 'strong' })).toBe(true);
  });

  it("leave a trait's own rows out of its own gate: Berserker stays on at Strength 7", () => {
    const world = worldOf([gated('berserker', 7, { statChanges: [gives(-2)] })], { stats: [strength({ value: 7 })] });
    const picked = click(world, draftOf([]), 'berserker');
    expect(picked?.draft.traitIds).toEqual(['berserker']);
    expect(settle(entryGateInput(world, picked!.draft)).active.global).toEqual(['berserker']);
    expect(unlocked(world, picked!.draft, 'berserker')).toBe(true);
  });

  it('never lock in two traits that only prop each other up', () => {
    const a = gated('a', 7, { statChanges: [gives(3)] });
    const b = gated('b', 7, { statChanges: [gives(3)] });
    const world = worldOf([a, b]);
    expect(unlocked(world, draftOf([]), 'a')).toBe(false);
    // Proposed together, neither has a root.
    expect(settle(entryGateInput(world, draftOf(['a', 'b']))).active.global).toEqual([]);
    // Bodybuilder opens A, A opens B; dropping Bodybuilder takes both, since each needs the other.
    const world3 = worldOf([bodybuilder, a, b]);
    let draft = draftOf(['bodybuilder']);
    for (const id of ['a', 'b']) draft = click(world3, draft, id)!.draft;
    expect(draft.traitIds).toEqual(['bodybuilder', 'a', 'b']);
    const dropped = click(world3, draft, 'bodybuilder')!;
    expect(dropped.draft.traitIds).toEqual([]);
    expect(dropped.turnedOff.map((r) => r.traitId).sort()).toEqual(['a', 'b']);
  });

  it('never lock in two traits that only prop each other up through a Preset', () => {
    const a = gated('a', 7, { statChanges: [gives(3)] });
    const b = gated('b', 7, { statChanges: [gives(3)] });
    const preset: PresetWorldOption = {
      id: 'kit', name: 'Kit', type: 'preset', mode: 'overlay',
      values: [{ id: 'both', name: 'Both', description: '', rows: [{ kind: 'trait', traitId: 'a', on: true }, { kind: 'trait', traitId: 'b', on: true }] }],
    };
    const applied = applyPreset(draftOf([]), worldOf([a, b], { options: [preset] }), preset, 'both')!;
    expect(applied.draft.traitIds).toEqual([]);
    expect(applied.notice.skipped).toHaveLength(2);
  });

  it('read a starting row clamped by the max a pick sets', () => {
    // Strength starts at 4 + 4 = 8, above the 6 that Frail's max leaves.
    const frail = T('frail', { statChanges: [gives(-14, 'max')] });
    const brawn = T('brawn', { statChanges: [gives(4)] });
    const world = worldOf([brawn, frail, carry]);
    expect(unlocked(world, draftOf(['brawn']), 'carry')).toBe(true);
    expect(unlocked(world, draftOf(['brawn', 'frail']), 'carry')).toBe(false);
  });

  it('turn off a pick whose support is removed, through the cascade', () => {
    const world = worldOf([bodybuilder, carry]);
    const dropped = click(world, draftOf(['bodybuilder', 'carry']), 'bodybuilder')!;
    expect(dropped.draft.traitIds).toEqual([]);
    expect(dropped.turnedOff).toEqual([{ ownerId: null, traitId: 'carry' }]);
    expect(dropped.draft.cascadeOffTraitIds.global).toEqual(['carry']);
  });

  it.each([
    ['Carry Capacity first', ['carry', 'weakling']],
    ['Weakling first', ['weakling', 'carry']],
  ])('turn off the pick a lowering pick fails, whatever the order (%s)', (_, order) => {
    const world = worldOf([carry, T('weakling', { statChanges: [gives(-2)] })], { stats: [strength({ value: 7 })] });
    const result = settle(entryGateInput(world, draftOf(order)));
    expect(result.active.global).toEqual(['weakling']);
    expect(result.turnedOff).toEqual([{ ownerId: null, traitId: 'carry' }]);
  });

  it("count an entity's picks on its own stat", () => {
    const ox: Entity = {
      id: 'ox', name: 'Ox', stats: [strength()],
      traits: [bodybuilder, carry],
    };
    const world = worldOf([], { stats: [], entities: [ox] });
    const draft = (ids: string[]) => draftOf([], { ownedTraitIds: { ox: ids } });
    expect(unlocked(world, draft([]), 'carry', 'ox')).toBe(false);
    expect(unlocked(world, draft(['bodybuilder']), 'carry', 'ox')).toBe(true);
  });

  it('read a stat a pick turns off as inert', () => {
    const tired = T('tired', { statToggles: [{ statId: 'str', enabled: false }] });
    const world = worldOf([tired, gated('carry', 1)]);
    expect(unlocked(world, draftOf([]), 'carry')).toBe(true);
    expect(unlocked(world, draftOf(['tired']), 'carry')).toBe(false);
  });
});

describe('library entity defaults at setup', () => {
  it("settle under the picked Option value's rows (Q35)", () => {
    const might: ChoiceWorldOption = {
      id: 'might', name: 'Might', type: 'choice', shownToPlayer: true, midGame: false, default: 'weak',
      values: [{ id: 'weak', name: 'Weak' }, { id: 'strong', name: 'Strong', statChanges: [gives(3)] }],
    };
    const lib: Entity = {
      id: 'lib', name: 'Lib',
      traits: [gated('hauler', 7, { isDefault: true, groupId: 'role' })], traitGroups: [{ id: 'role', name: 'Role', parentId: null }],
    };
    const world = worldOf([], { options: [might], library: [lib] });
    const joined = (optionValues: WorldOptionValues) => withLibraryDefaults(draftOf([], { optionValues }), world).ownedTraitIds.lib;
    expect(joined({ might: 'weak' })).toEqual([]);
    expect(joined({ might: 'strong' })).toEqual(['hauler']);
  });
});

describe('Starting Location gates at setup', () => {
  it("count the picks' stat effects", () => {
    const vault: GameLocation = { id: 'vault', name: 'Vault', isStarting: true, enabledWhen: [{ all: [needs(7)] }] };
    const world = { entities: [], locations: [vault], traits: [bodybuilder], stats: [strength()] };
    expect([...startLocationIdsOpen(world, null, undefined, scoped([]))]).toEqual([]);
    expect([...startLocationIdsOpen(world, null, undefined, scoped(['bodybuilder']))]).toEqual(['vault']);
  });

  it("count a library persona's picks", () => {
    const vault: GameLocation = { id: 'vault', name: 'Vault', isStarting: true, enabledWhen: [{ all: [needs(7)] }] };
    const world = { entities: [], locations: [vault], traits: [], stats: [strength()] };
    const lib: Entity = { id: 'lib', name: 'Lib', traits: [bodybuilder] };
    const open = (ids: string[]) => [...startLocationIdsOpen(world, 'lib', undefined, scoped([], { lib: ids }), [lib])];
    expect(open([])).toEqual([]);
    expect(open(['bodybuilder'])).toEqual(['vault']);
  });
});
