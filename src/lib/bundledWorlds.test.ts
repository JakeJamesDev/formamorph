import { describe, expect, it } from 'vitest';
import { migrateWorld } from './version';
import { runRules } from './testBench/rules';
import { entityImages } from './entityImages';
import { locationImages } from './locationImages';
import { encodePlaceholderToken, PLACEHOLDER_TOKEN_SOURCE } from './placeholders';
import { worldImageItems } from './mediaIndex';
import { PRE_EXPANSION_SHA, worldAt } from '@/test/bundledRevisions';
import { bundledWorldIds, bundledWorldText } from '@/test/bundledWorldFiles';
import type { Entity, GalleryImage, Script, Tool, Trait, TraitGroup, TraitRequirementRow, World } from '@/types';

/** The shared suite over every bundled world, read as stored so the Test Bench pass sees the real images. */

const worlds = bundledWorldIds().map((id) => [id, bundledWorldText(id)] as const);

/** What a world shows an author. */
type Feature =
  | 'scripts' | 'traitGates' | 'traitModes' | 'minMaxPicks' | 'statToggles' | 'openingWeights' | 'blueprints'
  | 'tools' | 'relationships' | 'timeGates' | 'scriptLore' | 'scriptExits' | 'visibilityRules' | 'mapBackground'
  | 'newFieldChips';

/** The features each world shows. A world ticket moves each feature it delivers here from PLANNED. */
const FEATURES: Record<string, Feature[]> = {
  'drone': ['scripts', 'traitGates', 'minMaxPicks', 'tools', 'newFieldChips', 'visibilityRules'],
  'emberwatch': ['traitGates', 'blueprints', 'tools', 'relationships', 'scriptLore', 'newFieldChips', 'mapBackground', 'visibilityRules'],
  'open-chat': [],
  'rampage': ['scripts', 'minMaxPicks', 'statToggles', 'tools', 'scriptExits', 'newFieldChips', 'mapBackground', 'visibilityRules'],
  'slime': ['scripts', 'traitModes', 'traitGates', 'tools', 'relationships', 'timeGates', 'scriptLore', 'newFieldChips', 'visibilityRules'],
  'sugarscape': ['scripts', 'minMaxPicks', 'openingWeights', 'timeGates', 'newFieldChips', 'mapBackground', 'visibilityRules'],
  'valentines': ['scripts', 'relationships', 'newFieldChips', 'visibilityRules'],
  'veilwood': ['traitGates', 'traitModes', 'minMaxPicks', 'openingWeights', 'timeGates', 'newFieldChips', 'mapBackground', 'visibilityRules'],
};

/** The expansion's assignment table: features a world ticket still has to deliver. */
const PLANNED: Record<string, Feature[]> = {
  'drone': [],
  'emberwatch': [],
  'rampage': [],
  'slime': [],
  'sugarscape': [],
  'valentines': [],
  'veilwood': [],
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

/** Every script's code, Tool script handlers included. */
const scriptCode = (world: World): string[] => [
  ...ownersOf(world).flatMap((o) => [...o.scripts, ...o.traits.flatMap((t) => t.scripts ?? [])]).map((s) => s.code),
  ...(world.tools ?? []).flatMap((t) => (t.handler.kind === 'script' ? [t.handler.code] : [])),
];

const hasVisibilityRule = (images: GalleryImage[]) => images.some((image) => (image.requires ?? []).length > 0);

/** Every Requirement Row: trait gates and image Visibility rules. */
const requirementRows = (world: World): TraitRequirementRow[] => [
  ...ownersOf(world).flatMap((o) => o.traits.flatMap((t) => t.requires ?? [])),
  ...[
    ...(world.locations ?? []).flatMap((l) => locationImages(l)),
    ...(world.entities ?? []).flatMap((e) => entityImages(e)),
    ...(world.worldOverview.mapBackground?.images ?? []),
  ].flatMap((image) => image.requires ?? []),
];

// A rolled chip, not a Built-in.
const PLACEHOLDER_TOKEN = new RegExp(PLACEHOLDER_TOKEN_SOURCE);

// An entry's `enabled` assigned, not compared: `dictionaries.Lore.entries["Sealed Vault"].enabled = true`.
const ENTRY_ENABLED_WRITE = /\.entries(?:\.[\w$]+|\[[^\]]+\])\.enabled\s*=(?!=)/;

const DETECT: Record<Feature, (world: World) => boolean> = {
  scripts: (w) => ownersOf(w).some((o) => [...o.scripts, ...o.traits.flatMap((t) => t.scripts ?? [])].some((s) => s.code.trim())),
  traitGates: (w) => ownersOf(w).some((o) => o.traits.some((t) => (t.requires ?? []).length > 0)),
  traitModes: (w) => ownersOf(w).some((o) => o.traits.some((t) => t.mode)),
  minMaxPicks: (w) => ownersOf(w).some((o) => o.groups.some((g) => (g.minPicks ?? 0) > 0 || (g.maxPicks !== undefined && g.maxPicks > 1))),
  statToggles: (w) => ownersOf(w).some((o) => o.traits.some((t) => (t.statToggles ?? []).length > 0)),
  openingWeights: (w) => openingWeightMaps(w).some((m) => Object.values(m ?? {}).some((weight) => weight !== 1)),
  blueprints: (w) => [...(w.traitGroups ?? []), ...(w.statGroups ?? [])].some((g) => g.system === 'blueprints'),
  tools: (w) => (w.tools ?? []).some((t) => t.handler.kind === 'script' && t.handler.code.trim()),
  relationships: (w) => (w.entities ?? []).some((e) => (e.relationships ?? []).length > 0),
  timeGates: (w) => requirementRows(w).some((row) => row.all.some((c) => c.kind === 'time')),
  scriptLore: (w) => scriptCode(w).some((code) => ENTRY_ENABLED_WRITE.test(code)),
  scriptExits: (w) => scriptCode(w).some((code) => /\blocation\.exits\b/.test(code)),
  visibilityRules: (w) => (w.locations ?? []).some((l) => hasVisibilityRule(locationImages(l))) && (w.entities ?? []).some((e) => hasVisibilityRule(entityImages(e))),
  mapBackground: (w) => (w.worldOverview.mapBackground?.images ?? []).length > 0,
  newFieldChips: (w) => [
    ...(w.entities ?? []).flatMap((e) => [e.pronouns ?? '', ...(e.relationships ?? []).map((r) => r.label)]),
    ...(w.connections ?? []).flatMap((c) => [c.aToB?.hint ?? '', c.bToA?.hint ?? '']),
  ].some((text) => PLACEHOLDER_TOKEN.test(text)),
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

  it('holds every image as stored data, so the image rules below read real bytes', () => {
    expect(worldImageItems(world).filter((media) => !media.value.startsWith('data:image/')).map((media) => media.value)).toEqual([]);
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

  it.each(PLANNED[id] ?? [])('still plans %s', (feature) => {
    expect(DETECT[feature](world), `the world shows ${feature}: move it from PLANNED into its FEATURES row`).toBe(false);
  });
});

describe('the bundled set', () => {
  const missing = (rows: Record<string, Feature[]>[]) => {
    const claimed = new Set(rows.flatMap((r) => Object.values(r).flat()));
    return Object.keys(DETECT).filter((feature) => !claimed.has(feature as Feature));
  };

  it('carries images for the image rules to check', () => {
    expect(worlds.some(([, raw]) => raw.includes('"data:image/'))).toBe(true);
  });

  it('shows or plans every feature', () => {
    expect(missing([FEATURES, PLANNED])).toEqual([]);
  });

  // Strict once every world has its row and no planned feature is left.
  it.runIf(worlds.every(([id]) => id in FEATURES) && Object.values(PLANNED).every((p) => p.length === 0))(
    'shows every feature in at least one world', () => {
      expect(missing([FEATURES])).toEqual([]);
    },
  );
});

describe('the expansion feature detectors', () => {
  // The pre-expansion Veilwood shows none of the expansion features, and a past revision never gains one.
  const before = worldAt(PRE_EXPANSION_SHA, 'veilwood');
  const base = () => migrateWorld(structuredClone(before));
  const atNight: TraitRequirementRow[] = [{ all: [{ kind: 'time', dayparts: ['night', 'evening'] }] }];
  const script = (code: string): Script => ({ id: 'script', timing: 'after', code });
  const tool = (handler: Tool['handler']): Tool =>
    ({ id: 'tool', name: 'mark', description: 'Marks it.', params: [], handler, emptyResult: '', offeredTo: ['narration'] });
  const chip = encodePlaceholderToken({ id: 'placeholder', mode: 'world', placementId: 'placement' });

  // Each edit adds the feature to a world that lacks it.
  const EDITS: Record<string, [Feature, (w: World) => void]> = {
    'a script Tool': ['tools', (w) => { w.tools = [tool({ kind: 'script', code: 'memory.add("Marked.");' })]; }],
    'a relationship': ['relationships', (w) => { w.entities[0].relationships = [{ targetId: w.entities[1].id, label: 'rival' }]; }],
    'a trait gated by time': ['timeGates', (w) => { w.traits = [{ ...ownersOf(w).flatMap((o) => o.traits)[0], requires: atNight }]; }],
    'a backdrop shown by time': ['timeGates', (w) => { w.locations[0].images = [{ data: 'image', requires: atNight }]; }],
    'a script that enables a lore entry': ['scriptLore', (w) => { w.scripts = [script('dictionaries.Lore.entries["Sealed Vault"].enabled = true;')]; }],
    'a Tool that enables a lore entry': ['scriptLore', (w) => { w.tools = [tool({ kind: 'script', code: 'dictionaries.Lore.entries.Gate.enabled = true;' })]; }],
    'a script that reads exits': ['scriptExits', (w) => { w.scripts = [script('const exit = location.exits[0];')]; }],
    'a location rule and an entity rule': ['visibilityRules', (w) => {
      w.locations[0].images = [{ data: 'image', requires: atNight }];
      w.entities[0].images = [{ data: 'image' }, { data: 'image', requires: atNight }];
    }],
    'a map image': ['mapBackground', (w) => { w.worldOverview.mapBackground = { images: [{ data: 'image' }], frame: { x: 0, y: 0, width: 10, height: 10 }, opacity: 0.5 }; }],
    'a chip in pronouns': ['newFieldChips', (w) => { w.entities[0].pronouns = chip; }],
    'a chip in a travel hint': ['newFieldChips', (w) => { w.connections![0].aToB = { hint: `past ${chip}'s gate` }; }],
    'a chip in a relationship label': ['newFieldChips', (w) => { w.entities[0].relationships = [{ targetId: w.entities[1].id, label: `${chip}'s rival` }]; }],
  };

  it.each(Object.entries(EDITS))('finds %s', (_name, [feature, edit]) => {
    const world = base();
    expect(DETECT[feature](world)).toBe(false);
    edit(world);
    expect(DETECT[feature](world)).toBe(true);
  });

  // Near misses: each edit is close to its feature but is not it.
  const NEAR: Record<string, [Feature, (w: World) => void]> = {
    'a template Tool': ['tools', (w) => { w.tools = [tool({ kind: 'template', body: 'Marked.' })]; }],
    'a script Tool with no code': ['tools', (w) => { w.tools = [tool({ kind: 'script', code: '  ' })]; }],
    'a backdrop shown by a stat': ['timeGates', (w) => {
      w.locations[0].images = [{ data: 'image', requires: [{ all: [{ kind: 'stat', id: w.stats[0].id, operator: '>', value: 0, unit: 'raw' }] }] }];
    }],
    'a longer name after exits': ['scriptExits', (w) => { w.scripts = [script('const count = location.exitsSeen;')]; }],
    'a map with no image': ['mapBackground', (w) => { w.worldOverview.mapBackground = { images: [], frame: { x: 0, y: 0, width: 10, height: 10 }, opacity: 0.5 }; }],
    'a whole dictionary enabled': ['scriptLore', (w) => { w.scripts = [script('dictionaries.Lore.enabled = true;')]; }],
    'an entry enabled compared': ['scriptLore', (w) => { w.scripts = [script('if (dictionaries.Lore.entries.Gate.enabled == true) stats.Fear.value += 1;')]; }],
    'a location rule only': ['visibilityRules', (w) => { w.locations[0].images = [{ data: 'image', requires: atNight }]; }],
    'a Built-in in pronouns': ['newFieldChips', (w) => { w.entities[0].pronouns = '{{user}}'; }],
  };

  it.each(Object.entries(NEAR))('ignores %s', (_name, [feature, edit]) => {
    const world = base();
    edit(world);
    expect(DETECT[feature](world)).toBe(false);
  });
});
