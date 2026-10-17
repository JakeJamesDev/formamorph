import { describe, expect, it } from 'vitest';
import { migrateWorld } from './version';
import { runRules } from './testBench/rules';
import type { Entity, Script, Trait, TraitGroup, World } from '@/types';

/** The shared suite over every bundled world, loaded the way the seeder loads it. */

const raws = import.meta.glob<string>('@/defaultworlds/*.json', { query: '?raw', import: 'default', eager: true });
const worlds = Object.entries(raws).map(([path, raw]) => [path.replace(/.*\/|\.json$/g, ''), raw] as const);

/** What a world shows an author. Each world ticket adds its row (Q6). */
type Feature = 'scripts' | 'traitGates' | 'traitModes' | 'minMaxPicks' | 'statToggles' | 'openingWeights' | 'blueprints';

const FEATURES: Record<string, Feature[]> = {
  'drone': ['scripts', 'traitGates', 'minMaxPicks'],
  'emberwatch': ['traitGates', 'blueprints'],
  'open-chat': [],
  'rampage': ['scripts', 'statToggles'],
  'slime': ['scripts', 'traitModes'],
  'sugarscape': ['scripts', 'minMaxPicks', 'openingWeights'],
  'valentines': ['scripts'],
  'veilwood': ['traitGates', 'traitModes', 'minMaxPicks', 'openingWeights'],
};

/** Image size has no budget the bundled worlds must meet (Q13). */
const IGNORED_RULES = new Set(['world-oversized-images']);

// Why each open finding stays. A world ticket clears its content and image rows (Q14); a by-design row stays (Q15).
const BY_DESIGN = 'the blank stage holds no entities by design';

/** Findings still open, as `rule: items` with the reason each stays, by world. */
const OPEN_FINDINGS: Record<string, Record<string, string>> = {
  'open-chat': {
    'location-no-entities: Here': BY_DESIGN,
  },
};

const ownersOf = (world: World): { traits: Trait[]; groups: TraitGroup[]; scripts: Script[] }[] => [
  {
    traits: world.traits ?? [],
    groups: world.traitGroups ?? [],
    scripts: [...(world.scripts ?? []), ...(world.stats ?? []).flatMap((s) => s.scripts ?? [])],
  },
  ...(world.entities ?? []).map((e: Entity) => ({
    traits: e.traits ?? [],
    groups: e.traitGroups ?? [],
    scripts: (e.stats ?? []).flatMap((s) => s.scripts ?? []),
  })),
];

const openingWeightMaps = (world: World) => [
  world.worldOverview.openingWeights,
  ...(world.entities ?? []).map((e) => e.openingWeights),
  ...(world.locations ?? []).map((l) => l.openingWeights),
];

const DETECT: Record<Feature, (world: World) => boolean> = {
  scripts: (w) => ownersOf(w).some((o) => [...o.scripts, ...o.traits.flatMap((t) => t.scripts ?? [])].some((s) => s.code.trim())),
  traitGates: (w) => ownersOf(w).some((o) => o.traits.some((t) => (t.requires ?? []).length > 0)),
  traitModes: (w) => ownersOf(w).some((o) => o.traits.some((t) => t.mode)),
  minMaxPicks: (w) => ownersOf(w).some((o) => o.groups.some((g) => (g.minPicks ?? 0) > 0 || (g.maxPicks !== undefined && g.maxPicks > 1))),
  statToggles: (w) => ownersOf(w).some((o) => o.traits.some((t) => (t.statToggles ?? []).length > 0)),
  openingWeights: (w) => openingWeightMaps(w).some((m) => Object.values(m ?? {}).some((weight) => weight !== 1)),
  blueprints: (w) => [...(w.traitGroups ?? []), ...(w.statGroups ?? [])].some((g) => g.system === 'blueprints'),
};

/** The file as JSON stores it: an absent key and an undefined one read the same. */
const stored = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

describe.each(worlds)('the %s world', (id, raw) => {
  const file = JSON.parse(raw) as Record<string, unknown>;
  const world = migrateWorld(structuredClone(file));

  it('is stored in the current shape', () => {
    // Every load stamps the running version, so only the stamp may differ.
    const { version: _loaded, ...loaded } = stored(world) as Record<string, unknown>;
    const { version: _stored, ...onDisk } = file;
    expect(loaded).toEqual(onDisk);
  });

  it('raises no Test Bench finding beyond its open list', () => {
    const findings = runRules(world)
      .filter((f) => !IGNORED_RULES.has(f.ruleId))
      .map((f) => `${f.ruleId}: ${f.items.map((item) => item.name).join(', ')}`);
    expect(findings.sort()).toEqual(Object.keys(OPEN_FINDINGS[id] ?? {}).sort());
  });

  it.each(FEATURES[id] ?? [])('shows %s', (feature) => {
    expect(DETECT[feature](world)).toBe(true);
  });
});

// Q6: once every world ticket has added its row, the set covers every feature.
describe.runIf(worlds.every(([id]) => id in FEATURES))('the bundled set', () => {
  it('shows every feature in at least one world', () => {
    const shown = new Set(Object.values(FEATURES).flat());
    expect(Object.keys(DETECT).filter((feature) => !shown.has(feature as Feature))).toEqual([]);
  });
});
