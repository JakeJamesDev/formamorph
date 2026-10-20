/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runStatCodeTurn, runSwitchScripts, SWITCH_DEPTH_CAP, type OwnerCodeTurn, type StatCodeTurn } from './statCodeTurn';
import { openOutputRun } from './outputRun';
import { traitSwitchEvents, type TraitSwitchEvent } from './traitRuntime';
import type { StatCodeOwners } from './statCodeTraits';
import { inPlayOwners } from './ownedTraitsInPlay';
import type { Entity, OwnedTraitStates, PersonaRef, PlayerStat, Script, Trait } from '@/types';
import { statCodeTurnOf, type FlatStatCodeTurn } from '@/test/statCodeTurnFixture';

const NO_PERSONA: PersonaRef = { source: 'none' };

const stat = (over: Partial<PlayerStat>): PlayerStat => ({
  id: 'x', name: 'Stat', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [],
  baseMin: 0, baseMax: 100, baseRegen: 0, aiMaxDelta: 0, ...over,
});

let scriptIds = 0;
const script = (code: string, timing: Script['timing'] = 'switch'): Script => ({ id: `s-${scriptIds++}`, timing, code });

const trait = (id: string, name: string, over: Partial<Trait> = {}): Trait => ({ id, name, statChanges: [], playerToggle: true, ...over });

const hp = () => stat({ id: 'hp', name: 'HP', value: 50 });

function ownerTraits({ traits = [], entities = [], acquired = [], off = [], owned = {} }: {
  traits?: Trait[]; entities?: Entity[]; acquired?: Trait[]; off?: string[]; owned?: OwnedTraitStates;
}): StatCodeOwners {
  return {
    acquired, disabledTraitIds: off, appliedValues: {}, ownedTraits: owned, entities, library: [],
    world: { traits, groups: [], entities, persona: NO_PERSONA, ...inPlayOwners({ traits, traitGroups: [], entities }, NO_PERSONA, []) },
  };
}

const turnOf = (traits: StatCodeOwners, { stats = [hp()], owners, timing, worldScripts }: {
  stats?: PlayerStat[]; owners?: OwnerCodeTurn[]; timing?: FlatStatCodeTurn['timing']; worldScripts?: Script[];
} = {}): StatCodeTurn => statCodeTurnOf({
  ...(timing ? { timing } : {}),
  stats, enabled: {}, previous: stats, asks: [], regenApplied: {}, clock: {}, ownerTraits: traits,
  ...(owners ? { owners } : {}), ...(worldScripts ? { worldScripts } : {}),
  statNameOf: (s) => s.name, traitNameOf: (t) => t.name,
});

const hpOf = (out: { stats: readonly PlayerStat[] } | null) => out?.stats.find((s) => s.id === 'hp')?.value;

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('traitSwitchEvents', () => {
  const a = trait('a', 'A');
  const b = trait('b', 'B');
  const entities: Entity[] = [
    { id: 'mira', name: 'Mira', traits: [trait('x', 'X'), trait('z', 'Z')] },
    { id: 'bram', name: 'Bram', traits: [trait('y', 'Y')] },
  ];
  const { world } = ownerTraits({ traits: [a, b], entities });

  it('lists offs first, then ons, global first, then owners in the world’s owner order', () => {
    const before = { traits: [a], disabledTraitIds: [], ownedTraits: { mira: { chosen: ['x'] } } };
    // Bram's pick lands first in the stored map; Mira still comes first, as the world lists her first.
    const after = {
      traits: [a, b], disabledTraitIds: ['a'], ownedTraits: { bram: { chosen: ['y'] }, mira: { chosen: ['x', 'z'], disabled: ['x'] } },
    };
    expect(traitSwitchEvents(before, after, world)).toEqual([
      { traitId: 'a', ownerId: null, enabled: false },
      { traitId: 'x', ownerId: 'mira', enabled: false },
      { traitId: 'b', ownerId: null, enabled: true },
      { traitId: 'z', ownerId: 'mira', enabled: true },
      { traitId: 'y', ownerId: 'bram', enabled: true },
    ]);
  });

  it('lists nothing for a trait that ends where it started', () => {
    const state = { traits: [a], disabledTraitIds: [] };
    expect(traitSwitchEvents(state, { traits: [a], disabledTraitIds: [] }, world)).toEqual([]);
  });
});

describe('a persona change', () => {
  // Wizard is the Custom Persona's: in the global tree under None, out of it under Albus.
  const wizard = trait('wizard', 'Wizard', { scripts: [script('stats.HP.value = trait.enabled ? 70 : 30;')] });
  const under = (persona: PersonaRef): StatCodeOwners['world'] => ({
    traits: [wizard], groups: [], entities: [{ id: 'albus', name: 'Albus', persona: true }], persona,
    global: { traits: persona.source === 'world' ? [] : [wizard], groups: [] }, owners: [{ id: 'albus', name: 'Albus', traits: [], groups: [] }],
  });
  const none = under(NO_PERSONA);
  const asAlbus = under({ source: 'world', entityId: 'albus' });
  const state = { traits: [wizard], disabledTraitIds: [] };

  it('switches off a global trait that leaves the tree, and on again when it returns (Q47)', () => {
    expect(traitSwitchEvents(state, state, asAlbus, none)).toEqual([{ traitId: 'wizard', ownerId: null, enabled: false }]);
    expect(traitSwitchEvents(state, state, none, asAlbus)).toEqual([{ traitId: 'wizard', ownerId: null, enabled: true }]);
  });

  it('runs the trait’s own script with trait.enabled false, though its pick stays on', async () => {
    const traits = { ...ownerTraits({ acquired: [wizard] }), world: asAlbus };
    const out = await runSwitchScripts(turnOf(traits), traitSwitchEvents(state, state, asAlbus, none));
    expect(hpOf(out)).toBe(30);
  });
});

describe('a trait’s own switch script', () => {
  const brave = trait('brave', 'Brave', {
    scripts: [script('stats.HP.value = self.name === "Brave" && trait.name === "Brave" ? (trait.enabled ? 80 : 20) : 0;')],
  });

  it('runs on its switch-on with the trait as self', async () => {
    const out = await runSwitchScripts(turnOf(ownerTraits({ traits: [brave], acquired: [brave] })), [
      { traitId: 'brave', ownerId: null, enabled: true },
    ]);
    expect(hpOf(out)).toBe(80);
  });

  it('runs on its switch-off, and its write lands (Q13)', async () => {
    const out = await runSwitchScripts(turnOf(ownerTraits({ traits: [brave], acquired: [brave], off: ['brave'] })), [
      { traitId: 'brave', ownerId: null, enabled: false },
    ]);
    expect(hpOf(out)).toBe(20);
    expect(out?.moved).toEqual(['hp']);
  });

  it('runs when a script in another timing switches the trait off', async () => {
    const off = script('traits.Brave.enabled = false;', 'before');
    const out = await runStatCodeTurn(turnOf(ownerTraits({ traits: [brave], acquired: [brave] }), { timing: 'before', worldScripts: [off] }));
    expect(hpOf(out)).toBe(20);
    expect(out.traits?.disabledTraitIds).toEqual(['brave']);
  });

  it('does not run on another trait’s switch', async () => {
    const calm = trait('calm', 'Calm');
    const out = await runSwitchScripts(turnOf(ownerTraits({ traits: [brave, calm], acquired: [brave, calm] })), [
      { traitId: 'calm', ownerId: null, enabled: true },
    ]);
    expect(hpOf(out)).toBe(50);
  });

  it('does not run in a timing other than its own', async () => {
    const out = await runStatCodeTurn(turnOf(ownerTraits({ traits: [brave], acquired: [brave] }), { timing: 'before' }));
    expect(hpOf(out)).toBe(50);
  });

  it('runs under its entity as owner, with trait.owner naming the entity', async () => {
    const grim = trait('grim', 'Grim', { scripts: [script('stats.HP.value = owner.name === "Bram" && trait.owner === "Bram" ? 30 : 0;')] });
    const bram: Entity = { id: 'bram', name: 'Bram', traits: [grim] };
    const out = await runSwitchScripts(turnOf(ownerTraits({ entities: [bram], owned: { bram: { chosen: ['grim'], disabled: ['grim'] } } })), [
      { traitId: 'grim', ownerId: 'bram', enabled: false },
    ]);
    expect(hpOf(out)).toBe(30);
  });

  it('reads self as not held when its owner left the world with the switch (ticket 03, ruling 3)', async () => {
    const grim = trait('grim', 'Grim', { scripts: [script('stats.HP.value = self.enabled === false && self.acquired === false ? 30 : 10;')] });
    const bram: Entity = { id: 'bram', name: 'Bram', traits: [grim] };
    // Bram is gone from the world the switch left, so no cast entry holds his trait.
    const { world: before } = ownerTraits({ entities: [bram], owned: { bram: { chosen: ['grim'] } } });
    const turn = { ...turnOf(ownerTraits({})), switchedFrom: before };
    const out = await runSwitchScripts(turn, [{ traitId: 'grim', ownerId: 'bram', enabled: false }]);
    expect(console.error).not.toHaveBeenCalled();
    expect(hpOf(out)).toBe(30);
  });
});

describe('a world script with When a Trait Switches', () => {
  const brave = trait('brave', 'Brave');
  const calm = trait('calm', 'Calm');
  // Each run shifts HP two digits left and adds 10 for an on or 20 for an off, plus the trait's name length.
  const tally = script('stats.HP.value = stats.HP.value * 100 + (trait.enabled ? 10 : 20) + trait.name.length;');

  it('runs once per switch with trait naming the trait and enabled the new state', async () => {
    const turn = turnOf(ownerTraits({ traits: [brave, calm], acquired: [brave, calm], off: ['calm'] }), { stats: [stat({ id: 'hp', name: 'HP', value: 1, max: 1e9, baseMax: 1e9 })], worldScripts: [tally] });
    const events: TraitSwitchEvent[] = [{ traitId: 'calm', ownerId: null, enabled: false }, { traitId: 'brave', ownerId: null, enabled: true }];
    // 1 → 1·100 + 24 → 124·100 + 15
    expect(hpOf(await runSwitchScripts(turn, events))).toBe(12415);
  });

  it('runs on a trait a gate cascade turns off, with trait.enabled false', async () => {
    const plate = trait('plate', 'Plate');
    const aura = trait('aura', 'Aura', { requires: [{ all: [{ kind: 'trait', id: 'plate' }] }] });
    const off = script('traits.Plate.enabled = false;', 'before');
    const turn = turnOf(ownerTraits({ traits: [plate, aura], acquired: [plate, aura] }), {
      timing: 'before', stats: [stat({ id: 'hp', name: 'HP', value: 1, max: 1e9, baseMax: 1e9 })], worldScripts: [off, tally],
    });
    const out = await runStatCodeTurn(turn);
    expect(out.traits?.disabledTraitIds).toEqual(expect.arrayContaining(['plate', 'aura']));
    // Plate's off (5), then the cascade's Aura off (4), in the order the player holds them.
    expect(hpOf(out)).toBe(12524);
  });

  it('fires nothing when no trait switched', async () => {
    const turn = turnOf(ownerTraits({ traits: [brave], acquired: [brave] }), { timing: 'before', worldScripts: [tally] });
    expect(hpOf(await runStatCodeTurn(turn))).toBe(50);
  });

  it('fires a nested run for a switch a switch script makes, and both runs’ writes land', async () => {
    const chain = script('if (trait.name === "Brave") traits.Calm.enabled = true; else stats.HP.value = stats.HP.value + 7;');
    const calmed = trait('calm', 'Calm', { scripts: [script('stats.HP.value = stats.HP.value * 2;')] });
    const turn = turnOf(ownerTraits({ traits: [brave, calmed], acquired: [brave] }), { worldScripts: [chain] });
    const out = await runSwitchScripts(turn, [{ traitId: 'brave', ownerId: null, enabled: true }]);
    // Calm's run: the world script adds 7 and Calm's own doubles, over one snapshot, so the later write wins.
    expect(hpOf(out)).toBe(100);
    expect(out?.traits?.acquired.map((t) => t.id)).toEqual(['brave', 'calm']);
  });

  it('stops firing after the depth cap when switch scripts keep switching', async () => {
    const flip = script('stats.HP.value = stats.HP.value + 1; traits.Brave.enabled = !trait.enabled;');
    const start = script('traits.Brave.enabled = false;', 'before');
    const turn = turnOf(ownerTraits({ traits: [brave], acquired: [brave] }), { timing: 'before', worldScripts: [start, flip] });
    expect(hpOf(await runStatCodeTurn(turn))).toBe(50 + SWITCH_DEPTH_CAP);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(`${SWITCH_DEPTH_CAP} rounds`));
  });
});

describe('an output script’s switch', () => {
  it('fires its switch scripts when the run lands, not per sentence (Q42)', async () => {
    const brave = trait('brave', 'Brave', { scripts: [script('stats.HP.value = 5;')] });
    const turn = turnOf(ownerTraits({ traits: [brave], acquired: [brave] }), {
      timing: 'output', worldScripts: [script('traits.Brave.enabled = false;', 'output')],
    });
    const run = openOutputRun(turn)!;
    await run.rewrite('One.', { index: 0, full: 'One.', earlier: [] });
    expect(hpOf(run.result())).toBe(50);
    const landed = await run.landing();
    expect(hpOf(landed)).toBe(5);
    expect(landed?.traits?.disabledTraitIds).toEqual(['brave']);
  });
});
