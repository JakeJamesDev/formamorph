import { describe, expect, it } from 'vitest';
import { landSwitchRun } from './switchRunLanding';
import { switchPlayerTrait, type TraitRuntimeState, type TraitWorld } from './traitRuntime';
import type { PlayerStat, StatChange, Trait } from '@/types';

const stat = (id: string, over: Partial<PlayerStat> = {}): PlayerStat => ({
  id, name: id, type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [],
  baseMin: 0, baseMax: 100, baseRegen: 0, aiMaxDelta: 0, ...over,
});
const trait = (id: string, statChanges: StatChange[] = [], over: Partial<Trait> = {}): Trait => ({
  id, name: id, statChanges, playerToggle: true, ...over,
});

// Bram owns Vigor. Hardy raises it; Boast raises the global h; Grim switches nothing.
const hardy = trait('hardy', [{ statId: 'vigor', value: 10, type: 'max' }, { statId: 'vigor', value: 5, type: 'starting' }]);
const boast = trait('boast', [{ statId: 'h', value: 7, type: 'starting' }]);
const grim = trait('grim');
const keen = trait('keen', [{ statId: 'h', value: 2, type: 'starting' }]);
const world: TraitWorld = {
  traits: [keen], groups: [], entities: [{ id: 'bram', name: 'Bram' }], persona: { source: 'none' },
  global: { traits: [keen], groups: [] }, owners: [{ id: 'bram', name: 'Bram', traits: [hardy, boast, grim], groups: [] }],
};

const start = (): TraitRuntimeState => ({
  stats: [stat('h')], traits: [], disabledTraitIds: [], appliedValues: {}, entityStats: { bram: [stat('vigor')] },
});
const flip = (s: TraitRuntimeState, id: string, on: boolean, owner: string | null = 'bram') => {
  const result = switchPlayerTrait(s, id, on, world, (t) => t.name, owner);
  if (!result) throw new Error(`switch of ${id} refused`);
  return result.state;
};
const value = (stats: readonly PlayerStat[] | undefined, id: string) => stats?.find((s) => s.id === id);

describe('a switch run’s landing', () => {
  it('lands the run whole when play did not move meanwhile', () => {
    const ran = flip(flip(start(), 'hardy', true), 'boast', true);
    const landed = landSwitchRun(start(), ran, start(), world).state;
    expect(landed.ownedTraits).toEqual(ran.ownedTraits);
    expect(landed.appliedValues).toEqual(ran.appliedValues);
    expect(value(landed.stats, 'h')?.value).toBe(57);
    expect(value(landed.entityStats?.bram, 'vigor')).toMatchObject({ value: 55, max: 110 });
  });

  it('keeps an entity trait the player switched both ways, and drops the run’s switch of it from its own stats', () => {
    const ran = flip(flip(start(), 'hardy', true), 'boast', true);
    const latest = flip(flip(flip(start(), 'hardy', true), 'hardy', false), 'keen', true, null);
    const landed = landSwitchRun(start(), ran, latest, world).state;
    expect(landed.ownedTraits?.bram).toEqual({ chosen: ['hardy', 'boast'], disabled: ['hardy'] });
    expect(landed.traits.map((t) => t.id)).toEqual(['keen']);
    expect(value(landed.entityStats?.bram, 'vigor')).toMatchObject({ value: 50, max: 100 });
    expect(value(landed.stats, 'h')?.value).toBe(59);
  });

  it('leaves a trait the run did not change as play left it', () => {
    const ran = flip(start(), 'boast', true);
    const latest = flip(start(), 'grim', true);
    const landed = landSwitchRun(start(), ran, latest, world).state;
    expect(landed.ownedTraits?.bram.chosen).toEqual(['grim', 'boast']);
  });
});
