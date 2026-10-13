import { describe, it, expect } from 'vitest';
import { migrateWorld } from './version';
import { canBePlayer, resolveBearers, type BearerWorld } from './bearers';
import { playerStatsOf, resolvedEntityStats, statBlueprintIds } from './statLinks';
import { seedEntityStats } from './entityStats';
import { seedNewGameStats } from './traitRuntime';
import { executeStatCode, type SandboxEntity } from './statCodeExecutor';
import { statCodeNamed } from './statCodeNames';
import { runRules } from './testBench/rules';
import type { Entity, Stat, World } from '@/types';

const raws = import.meta.glob<string>('@/defaultworlds/*.json', { query: '?raw', import: 'default', eager: true });
// Loaded the way the seeder loads it: raw text through the world migration.
const load = (id: string): World => {
  const raw = Object.entries(raws).find(([path]) => path.endsWith(`/${id}.json`))?.[1];
  if (!raw) throw new Error(`no bundled world ${id}`);
  return migrateWorld(JSON.parse(raw));
};

/** Per world: the stats the persona owns, and the stats that stay on the world. */
const SPLIT: Record<string, { owned: string[]; loose: string[] }> = {
  drone: { owned: ['Health', 'Power', 'Mobility', 'Firepower', 'Charge'], loose: [] },
  rampage: { owned: ['Health', 'Stamina', 'Rampage'], loose: ['Destruction', 'Alert Level'] },
  slime: { owned: ['Health', 'Stamina', 'Assimilation', 'Panic'], loose: ['Suspicion'] },
  sugarscape: { owned: ['Health', 'Stamina', 'Craving', 'Fullness', 'Stickiness'], loose: [] },
  valentines: { owned: ['Health', 'Stamina', 'Sugar', 'Agility'], loose: ['Pursuit'] },
  veilwood: { owned: ['Health', 'Stamina', 'Stress', 'Satiety', 'Toxin'], loose: ['Predator Attention'] },
};
const OWNING = Object.keys(SPLIT);
const PLAYER_STATS = ['Health', 'Mana', 'Faith', 'Gold', 'Renown'];

const bearerWorld = (w: World): BearerWorld => ({ traits: w.traits, traitGroups: w.traitGroups ?? [], entities: w.entities });
const statWorld = (w: World) => ({ stats: w.stats, statGroups: w.statGroups ?? [] });
const customPersona = (w: World): Entity => {
  const marked = w.entities.filter((e) => e.customPersona);
  expect(marked).toHaveLength(1);
  return marked[0];
};
const names = (stats: readonly Stat[]) => stats.map((s) => s.name);
/** The world's own stats: what stays loose once the player's moved or became Blueprints. */
const looseStats = (w: World) => playerStatsOf(w.stats, w.statGroups ?? []);
/** The Test Bench rows about stat targets and stat code. */
const statFindings = (w: World) => runRules(w)
  .filter((f) => /^(trait-stat-no-target|stat-code-|trait-toggle-missing-stat)/.test(f.ruleId))
  .map((f) => `${f.ruleId}: ${f.message}`);

describe.each(OWNING)('the %s world', (id) => {
  const world = load(id);

  it('puts its player stats on a Custom Persona entity and leaves its world stats loose', () => {
    expect(names(resolvedEntityStats(statWorld(world), customPersona(world)))).toEqual(SPLIT[id].owned);
    expect(names(looseStats(world))).toEqual(SPLIT[id].loose);
  });

  it('gives the persona the player traits too, so their stat rows reach the stats they name', () => {
    expect(world.traits).toEqual([]);
    expect(customPersona(world).traits?.length).toBeGreaterThan(0);
    const { bearers } = resolveBearers(bearerWorld(world), { source: 'none' });
    const loose = looseStats(world);
    /** The stats a bearer's trait rows may name. A player bearer's rows may also name a loose world stat. */
    const reachable = (entity: Entity | null | undefined): Stat[] => {
      if (!entity) return loose;
      return [...resolvedEntityStats(statWorld(world), entity), ...(canBePlayer(entity) ? loose : [])];
    };
    for (const bearer of bearers) {
      const ids = new Set(reachable(bearer.entity).map((s) => s.id));
      const rows = bearer.traits.flatMap((t) => (t.statChanges ?? []).map((c) => ({ trait: t.name, statId: c.statId })));
      const dead = rows.filter((row) => !ids.has(row.statId)).map((row) => `${row.trait}: ${row.statId}`);
      expect(dead, bearer.id).toEqual([]);
    }
  });

  it('runs clean on the Test Bench for stat targets and stat code', () => {
    expect(statFindings(world)).toEqual([]);
  });
});

describe('the drone persona', () => {
  it('takes its name from twelve distinct robotic designations it owns, rolled once per playthrough', () => {
    const world = load('drone');
    const persona = customPersona(world);
    const chip = /^\{\{ph:([^:]+):world:[^:}]+\}\}$/.exec(persona.name);
    const designation = persona.placeholders?.find((p) => p.id === chip?.[1]);
    expect(designation?.values).toHaveLength(12);
    expect(new Set(designation?.values.map((v) => v.text)).size).toBe(12);
  });
});

describe('a new game in the rampage world', () => {
  it('holds Health under the persona and Destruction under the world', () => {
    const world = load('rampage');
    const persona = customPersona(world);
    expect(names(seedEntityStats(world.entities)[persona.id])).toEqual(SPLIT.rampage.owned);
    expect(names(seedNewGameStats(looseStats(world)))).toEqual(SPLIT.rampage.loose);
  });
});

/** Persona traits whose rows name a loose world stat: they move it as the player's, not the persona's. */
const LOOSE_ROWS = [
  ['slime', 'Long Coat & Gloves', 'Suspicion'],
  ['valentines', 'Student Council President', 'Pursuit'],
  ['veilwood', 'Keen Eye', 'Predator Attention'],
  ['veilwood', 'Move Quietly', 'Predator Attention'],
] as const;

describe.each(LOOSE_ROWS)('the %s world: %s', (id, traitName, statName) => {
  it(`changes ${statName}, which the world keeps and the persona does not own`, () => {
    const world = load(id);
    const persona = customPersona(world);
    const loose = world.stats.find((s) => s.name === statName)!;
    const trait = persona.traits?.find((t) => t.name === traitName);
    expect(trait?.statChanges.some((c) => c.statId === loose.id)).toBe(true);
    expect(resolvedEntityStats(statWorld(world), persona).some((s) => s.id === loose.id)).toBe(false);
  });
});

/** Every stat's start value, as the code check seeds a run. */
const atStart = (stats: readonly Stat[]): Stat[] => stats.map((s) => ({ ...s, value: s.starting ?? s.value ?? s.min }));

/** Each owner's stats under their code names, owner by owner: the world's, then each entity's own and linked. */
const WORLD_OWNER = 'world';
const owners = (w: World): { owner: string; stats: Stat[] }[] => [
  { owner: WORLD_OWNER, stats: statCodeNamed(atStart(looseStats(w)), w.placeholders ?? []) },
  ...w.entities.map((e) => ({ owner: e.name, stats: statCodeNamed(atStart(resolvedEntityStats(statWorld(w), e)), w.placeholders ?? []) }))
    .filter(({ stats }) => stats.length),
];

/** The sandbox's `entities`, each owner's stats readable on it. */
const sandboxEntities = (w: World, held: ReturnType<typeof owners>): SandboxEntity[] =>
  w.entities.flatMap((e) => {
    const stats = held.find((o) => o.owner === e.name)?.stats;
    return stats ? [{ id: e.id, name: e.name, traits: [], stats: { stats } }] : [];
  });

describe.each([...OWNING, 'emberwatch'])('stat code in the %s world', (id) => {
  const world = load(id);
  const held = owners(world);
  const coded = held.flatMap(({ owner, stats }) => stats.filter((s) => s.code?.trim() || s.beforeCode?.trim()).map((s) => ({ owner, stats, stat: s })));

  it('runs every stat to a number under its own owner', async () => {
    const entities = sandboxEntities(world, held);
    const worldStats = held.find((o) => o.owner === WORLD_OWNER)?.stats ?? [];
    for (const { owner, stat } of coded) {
      const own = owner === WORLD_OWNER ? undefined : entities.find((e) => e.name === owner);
      for (const code of [stat.beforeCode, stat.code].filter((c): c is string => !!c?.trim())) {
        const res = await executeStatCode(code, worldStats, stat, { entities, owner: own });
        expect(res.error, `${owner}: ${stat.name}`).toBeNull();
        expect(typeof res.value, `${owner}: ${stat.name}`).toBe('number');
      }
    }
  });
});

describe('Alert Level in the rampage world', () => {
  const world = load('rampage');
  const held = owners(world);
  const worldStats = held.find((o) => o.owner === WORLD_OWNER)!.stats;
  const alert = worldStats.find((s) => s.name === 'Alert Level')!;

  it('reads the Rampage its creature holds', async () => {
    const creature = customPersona(world);
    const run = (rampage: number) => {
      const moved = held.map((o) => (o.owner === creature.name
        ? { ...o, stats: o.stats.map((s) => (s.name === 'Rampage' ? { ...s, value: rampage } : s)) }
        : o));
      return executeStatCode(alert.code ?? '', worldStats, alert, { entities: sandboxEntities(world, moved) });
    };
    const calm = await run(0);
    const raging = await run(100);
    expect(calm.error).toBeNull();
    expect(raging.value).toBeGreaterThan(calm.value ?? Infinity);
  });
});

describe('the emberwatch world', () => {
  const world = load('emberwatch');

  it('holds its five player stats as Blueprints and has no loose stats', () => {
    expect(names(world.stats)).toEqual(PLAYER_STATS);
    expect(statBlueprintIds(statWorld(world)).size).toBe(PLAYER_STATS.length);
    expect(looseStats(world)).toEqual([]);
  });

  it.each(['Wanderer', 'Albus', 'Sylvie Thornwhistle'])('links all five on %s', (name) => {
    const persona = world.entities.find((e) => e.name === name)!;
    expect(names(resolvedEntityStats(statWorld(world), persona))).toEqual(PLAYER_STATS);
    expect(persona.stats ?? []).toEqual([]);
  });

  it('keeps its root traits and runs clean on the Test Bench for stat targets', () => {
    expect(world.traitGroups?.some((g) => g.name === 'Bonds')).toBe(true);
    expect(world.entities.filter((e) => e.traits?.length)).toEqual([]);
    expect(statFindings(world)).toEqual([]);
  });
});
