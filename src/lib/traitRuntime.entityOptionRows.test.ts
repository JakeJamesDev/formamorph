import { describe, it, expect } from 'vitest';
import { entityStatTraitsInForce, settleTraits, type TraitRuntimeState, type TraitWorld } from './traitRuntime';
import { activeStatEnabled } from './traitEffects';
import { openingFold, type OpeningFoldWorld } from './openingState';
import { backfillEntityStats } from './entityStats';
import type { ChoiceWorldOption, Entity, OptionStatChange, OptionStatToggle, PlayerStat, Stat, StatChange, StatGroup, StatLink, Trait } from '@/types';

/** Option rows with an owner move that one entity's own stats (Q6, Q10, Q19–Q20). */

const stat = (id: string, over: Partial<Stat> = {}): Stat =>
  ({ id, name: id, type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [], ...over });
const playerStat = (s: Stat, over: Partial<PlayerStat> = {}): PlayerStat => ({
  ...s, value: s.value ?? 0, baseMin: s.min, baseMax: s.max, baseRegen: s.regen ?? 0, aiMaxDelta: 0, ...over,
});
const trait = (id: string, statChanges: StatChange[] = [], over: Partial<Trait> = {}): Trait => ({ id, name: id, statChanges, playerToggle: true, ...over });

// Howl is a stat Blueprint; the Dragon and the Wolf both link it. Each also owns a Health of its own.
const blueprints: StatGroup = { id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' };
const howl = stat('howl', { groupId: 'bp', value: 10 });
const howlLink = (id: string): StatLink => ({ id, originalId: 'howl', kind: 'stat', originalName: 'howl', groupId: null });
const dragon = { id: 'dragon', name: 'Dragon', description: '', locations: [], stats: [stat('health')], statLinks: [howlLink('d-howl')] } as Entity;
const wolf = { id: 'wolf', name: 'Wolf', description: '', locations: [], stats: [stat('health')], statLinks: [howlLink('w-howl')] } as Entity;

const difficulty = (easy: OptionStatChange[], hard: OptionStatChange[] = [], hardToggles: OptionStatToggle[] = []): ChoiceWorldOption => ({
  id: 'diff', name: 'Difficulty', type: 'choice', shownToPlayer: true, midGame: true, default: 'easy',
  values: [{ id: 'easy', name: 'Easy', statChanges: easy }, { id: 'hard', name: 'Hard', statChanges: hard, statToggles: hardToggles }],
});

const foldWorld = (option: ChoiceWorldOption, entities: Entity[] = [dragon, wolf]): OpeningFoldWorld => ({
  stats: [stat('health', { value: 5 }), howl], statGroups: [blueprints], traits: [], traitGroups: [], entities, options: [option],
});
const valueOf = (stats: readonly PlayerStat[] | undefined, id: string) => stats?.find((s) => s.id === id);

describe('an Option starting row on an entity', () => {
  it('applies at game start to that entity only, never on the global stat or another entity', () => {
    const option = difficulty([{ statId: 'health', type: 'starting', value: 20, ownerId: 'dragon' }]);
    const fold = openingFold(foldWorld(option), { traits: [], owned: {}, options: { diff: 'easy' } });
    expect(valueOf(fold.entityStats.dragon, 'health')?.value).toBe(70);
    expect(valueOf(fold.entityStats.wolf, 'health')?.value).toBe(50);
    expect(valueOf(fold.state.stats, 'health')?.value).toBe(5);
  });

  it('moves the named entity’s copy of a Blueprint stat and no other bearer’s', () => {
    const option = difficulty([{ statId: 'howl', type: 'starting', value: 7, ownerId: 'wolf' }, { statId: 'howl', type: 'max', value: 10, ownerId: 'wolf' }]);
    const fold = openingFold(foldWorld(option), { traits: [], owned: {}, options: { diff: 'easy' } });
    expect(valueOf(fold.entityStats.wolf, 'howl')).toMatchObject({ value: 17, max: 110 });
    expect(valueOf(fold.entityStats.dragon, 'howl')).toMatchObject({ value: 10, max: 100 });
  });

  it('applies before the entity’s own traits, so a trait’s start fits inside the Option’s raised max', () => {
    const tough = trait('tough', [{ statId: 'health', type: 'starting', value: 60 }]);
    const owner = { ...dragon, traits: [tough] } as Entity;
    const option = difficulty([{ statId: 'health', type: 'max', value: 50, ownerId: 'dragon' }]);
    const fold = openingFold(foldWorld(option, [owner, wolf]), { traits: [], owned: { dragon: ['tough'] }, options: { diff: 'easy' } });
    expect(valueOf(fold.entityStats.dragon, 'health')).toMatchObject({ value: 110, max: 150 });
  });

  it('is ignored when it names a deleted entity or a stat the entity lacks', () => {
    const option = difficulty([
      { statId: 'health', type: 'starting', value: 20, ownerId: 'gone' },
      { statId: 'mana', type: 'max', value: 20, ownerId: 'dragon' },
    ]);
    const fold = openingFold(foldWorld(option), { traits: [], owned: {}, options: { diff: 'easy' } });
    expect(fold.entityStats.gone).toBeUndefined();
    expect(valueOf(fold.entityStats.dragon, 'health')).toMatchObject({ value: 50, max: 100 });
  });
});

// The Wolf is an owner in play with a trait tree; the Dragon is not, and its Option rows still reach it (Q19).
const thick = trait('thick', [{ statId: 'health', type: 'regen', value: 4 }, { statId: 'health', type: 'max', value: 10 }]);
type OwnersWorld = Extract<TraitWorld, { global: object }>;
const owners: OwnersWorld = {
  traits: [], groups: [], entities: [{ id: 'wolf', name: 'Wolf' }, { id: 'dragon', name: 'Dragon' }],
  persona: { source: 'none' }, global: { traits: [], groups: [] }, owners: [{ id: 'wolf', name: 'Wolf', traits: [thick], groups: [] }],
};
const health = stat('health', { regen: 1 });
const playState = (over: Partial<TraitRuntimeState> = {}): TraitRuntimeState => ({
  stats: [], traits: [], disabledTraitIds: [], appliedValues: {},
  ownedTraits: { wolf: { chosen: ['thick'] } },
  entityStats: { wolf: [playerStat(health, { max: 110, regen: 5 })], dragon: [playerStat(health)] },
  ...over,
});
const hardWorld = (option: ChoiceWorldOption, value: string): OwnersWorld => ({ ...owners, options: [option], optionValues: { diff: value } });
const hardRows = difficulty(
  [{ statId: 'health', type: 'max', value: 100, ownerId: 'dragon' }, { statId: 'health', type: 'regen', value: 2, ownerId: 'dragon' }],
  [{ statId: 'health', type: 'max', value: -40, ownerId: 'dragon' }, { statId: 'health', type: 'regen', value: -1, ownerId: 'dragon' },
    { statId: 'health', type: 'regen', value: -2, ownerId: 'wolf' }],
);

describe('a mid-game Option change on entity stats', () => {
  it('moves an entity’s max and regen at once and leaves its value alone', () => {
    const settled = settleTraits(playState(), hardWorld(hardRows, 'hard')).state;
    expect(valueOf(settled.entityStats?.dragon, 'health')).toMatchObject({ value: 50, max: 60, regen: 0 });
  });

  it('clamps an entity value above its new max', () => {
    const start = playState({ entityStats: { dragon: [playerStat(health, { value: 150, max: 200, regen: 3 })] } });
    expect(valueOf(settleTraits(start, hardWorld(hardRows, 'hard')).state.entityStats?.dragon, 'health')).toMatchObject({ value: 60, max: 60 });
  });

  it('stacks with the entity’s own trait rows on the same stat', () => {
    const settled = settleTraits(playState(), hardWorld(hardRows, 'hard')).state;
    expect(valueOf(settled.entityStats?.wolf, 'health')).toMatchObject({ value: 50, max: 110, regen: 1 + 4 - 2 });
  });

  it('gives an entity its base bounds once the world drops the last row naming it (Q30)', () => {
    const start = playState({ entityStats: { ...playState().entityStats, dragon: [playerStat(health, { value: 150, max: 200, regen: 3 })] } });
    const wolfOnly = difficulty([], [{ statId: 'health', type: 'regen', value: -2, ownerId: 'wolf' }]);
    const settled = settleTraits(start, hardWorld(wolfOnly, 'easy')).state;
    expect(valueOf(settled.entityStats?.dragon, 'health')).toMatchObject({ value: 100, max: 100, regen: 1 });
  });

  it('holds an entity stat backfilled after the save at one trait raise across settles (Q30)', () => {
    // The author added the Wolf after the save; its Health is backfilled from the world, then settles every turn.
    const start = playState({ entityStats: backfillEntityStats({}, [wolf]) });
    const once = settleTraits(start, owners).state;
    const twice = settleTraits(once, owners).state;
    expect(valueOf(twice.entityStats?.wolf, 'health')).toMatchObject({ max: 110, regen: 4 });
    expect(twice).toBe(once);
  });

  it('holds a saved entity stat with no bases at its saved bounds across settles (Q30)', () => {
    // A save holds the Wolf's Health without bases, at the bounds Thick gave it.
    const { baseMin: _min, baseMax: _max, baseRegen: _regen, ...bare } = playerStat(health, { max: 110, regen: 5 });
    const once = settleTraits(playState({ entityStats: { wolf: [bare as PlayerStat] } }), owners).state;
    const twice = settleTraits(once, owners).state;
    expect(valueOf(twice.entityStats?.wolf, 'health')).toMatchObject({ max: 110, regen: 5 });
    expect(twice).toBe(once);
  });

  it('does not throw for a row naming a deleted entity', () => {
    const lost = difficulty([{ statId: 'health', type: 'max', value: 5, ownerId: 'gone' }]);
    const start = playState();
    expect(settleTraits(start, hardWorld(lost, 'easy')).state.entityStats).toEqual(start.entityStats);
  });
});

describe('Option toggles on an entity stat', () => {
  const sleepy: Stat = stat('sleep', { enabled: false });
  const toggled = difficulty([], [], [{ statId: 'sleep', enabled: true, ownerId: 'wolf' }]);

  it('turn the entity’s stat on, for that entity only', () => {
    const world = hardWorld(toggled, 'hard');
    expect(activeStatEnabled([sleepy], entityStatTraitsInForce(undefined, world, 'wolf'))).toEqual({ sleep: true });
    expect(activeStatEnabled([sleepy], entityStatTraitsInForce(undefined, world, 'dragon'))).toEqual({ sleep: false });
  });

  it('lose to the entity’s own trait toggle on the same stat', () => {
    const calm = trait('calm', [], { statToggles: [{ statId: 'sleep', enabled: false }] });
    const world: OwnersWorld = { ...hardWorld(toggled, 'hard'), owners: [{ id: 'wolf', name: 'Wolf', traits: [calm], groups: [] }] };
    expect(activeStatEnabled([sleepy], entityStatTraitsInForce({ wolf: { chosen: ['calm'] } }, world, 'wolf'))).toEqual({ sleep: false });
  });
});
