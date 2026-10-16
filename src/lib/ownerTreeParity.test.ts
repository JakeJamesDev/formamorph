// Records owned-trait and owned-stat drops, and the link bind and portable helpers, on bundled worlds.
import { describe, expect, it } from 'vitest';
import type { Entity, Stat, StatGroup, World } from '@/types';
import { migrateWorld } from './version';
import { applyOwnedTraitDrop, ownedTraitRows, ownedTraitTree, type OwnedTraitDrop, type TraitDropRefusal } from './traitTree';
import { applyOwnedStatDrop, ownedStatRows, ownedStatTree, type OwnedStatDrop, type StatDropRefusal } from './ownedStatTree';
import { bindOwnedStats, portableOwnedStats } from './portableStats';
import { bindOwnedTraits, portableOwnedTraits, traitWorldOf } from './portableTraits';

const bundled = new Map(Object.entries(import.meta.glob<string>('@/defaultworlds/*.json', { query: '?raw', import: 'default', eager: true }))
  .map(([file, raw]): [string, World] => [file.split('/').at(-1)!.replace('.json', ''), migrateWorld(JSON.parse(raw))]));
const bundledWorld = (name: string): World => {
  const w = bundled.get(name);
  if (!w) throw new Error(`No bundled world ${name}`);
  return w;
};

// Derived worlds reach the paths bundled data can't: each bundled stat that could change owner is read where it is.
const spareStat = (id: string, name: string, order: number): Stat => ({
  id, name, type: 'number', description: '', min: 0, max: 10, value: 5, regen: 0, descriptors: [], groupId: null, order,
});
const emptyBlueprints = { id: 'parity-blueprints', name: 'Blueprints', parentId: null, order: 0, system: 'blueprints' as const };
/** Veilwood with its world stat in a world group, the one stat-tree place an entity node can leave the top level. */
function veilwoodGrouped(): World {
  const w = bundledWorld('veilwood');
  const threats: StatGroup = { id: 'parity-threats', name: 'Threats', parentId: null, order: 0 };
  return { ...w, statGroups: [...w.statGroups ?? [], threats], stats: w.stats.map((s) => ({ ...s, groupId: threats.id, order: 0 })) };
}
/** Veilwood with a stat nothing reads on the world and on The Wanderer. */
function veilwoodSpare(): World {
  const w = bundledWorld('veilwood');
  return {
    ...w,
    stats: [...w.stats, spareStat('parity-loose', 'Loose', w.stats.length)],
    entities: w.entities.map((e) => (e.customPersona ? { ...e, stats: [...e.stats ?? [], spareStat('parity-calm', 'Calm', e.stats?.length ?? 0)] } : e)),
  };
}
/** {@link veilwoodSpare} with an empty stat Blueprints group. */
const veilwoodStatBlueprints = (): World => {
  const w = veilwoodSpare();
  return { ...w, statGroups: [...w.statGroups ?? [], { ...emptyBlueprints, order: w.stats.length }] };
};
/** Emberwatch with a stat nothing reads on Mother Hesk. */
function emberwatchSpare(): World {
  const w = bundledWorld('emberwatch');
  return { ...w, entities: w.entities.map((e) => (e.name === 'Mother Hesk' ? { ...e, stats: [...e.stats ?? [], spareStat('parity-resolve', 'Resolve', e.stats?.length ?? 0)] } : e)) };
}
/** Emberwatch with Albus holding a second Health link, stored last but placed above the first. */
function emberwatchOverlap(): World {
  const w = bundledWorld('emberwatch');
  const above = { id: 'parity-health-above', originalId: 'health', kind: 'stat' as const, originalName: 'Health', groupId: null, order: -1 };
  return { ...w, entities: w.entities.map((e) => (e.name === 'Albus' ? { ...e, statLinks: [...e.statLinks ?? [], above] } : e)) };
}
/** Veilwood with an empty trait Blueprints group, which the trait tree hides with `emptySystemNodes` off. */
const veilwoodTraitBlueprints = (): World => {
  const w = bundledWorld('veilwood');
  return { ...w, traitGroups: [...w.traitGroups ?? [], emptyBlueprints] };
};
/** {@link veilwoodTraitBlueprints} with Iron Constitution requiring Keen Eye. */
const veilwoodTraitReader = (): World => {
  const w = veilwoodTraitBlueprints();
  const reads = (e: Entity): Entity => ({
    ...e, traits: e.traits?.map((t) => (t.id === 'iron_constitution' ? { ...t, requires: [{ all: [{ kind: 'trait' as const, id: 'keen_eye', name: 'Keen Eye' }] }] } : t)),
  });
  return { ...w, entities: w.entities.map((e) => (e.customPersona ? reads(e) : e)) };
};
const worlds = {
  emberwatch: () => bundledWorld('emberwatch'), veilwood: () => bundledWorld('veilwood'),
  'emberwatch-spare': emberwatchSpare, 'veilwood-grouped': veilwoodGrouped, 'veilwood-spare': veilwoodSpare,
  'veilwood-stat-blueprints': veilwoodStatBlueprints, 'veilwood-trait-blueprints': veilwoodTraitBlueprints,
  'veilwood-trait-reader': veilwoodTraitReader,
} satisfies Record<string, () => World>;

const INDENT = 24;
type Row = { id: string; depth: number };

/** A lookup from each visible row's name path, `Owner / Group / Item`, to its id. */
function rowLocator(rows: readonly Row[], items: readonly { id: string; name: string }[]): (path: string) => string {
  const names = new Map(items.map((x) => [x.id, x.name]));
  const byPath = new Map<string, string>();
  const stack: string[] = [];
  for (const row of rows) {
    stack.length = row.depth;
    stack.push(names.get(row.id) ?? row.id);
    const path = stack.join(' / ');
    if (byPath.has(path)) throw new Error(`Two rows at ${path}`);
    byPath.set(path, row.id);
  }
  return (path) => {
    const id = byPath.get(path);
    if (!id) throw new Error(`No row at ${path}`);
    return id;
  };
}

type Outcome = 'moved' | 'none' | `refused:${TraitDropRefusal['reason'] | StatDropRefusal['reason']}`;

/** One drag: the row at `active` dropped over the row at `over`, `offset` indents right of the active row's depth. */
interface DropCase {
  name: string;
  world: keyof typeof worlds;
  active: string;
  over: string;
  offset: number;
  createLinks?: boolean;
  collapsed?: string[];
  emptySystemNodes?: boolean;
  outcome: Outcome;
  /** What a moved drop writes: `world` and each entity's name, in output order. */
  writes?: string[];
}

const traitCases: DropCase[] = [
  // Within an owner.
  { name: 'own trait into a sibling group', world: 'veilwood', active: 'The Wanderer / Instincts / Keen Eye', over: 'The Wanderer / Temperament / Zen Master', offset: 0, outcome: 'moved', writes: ['The Wanderer'] },
  { name: 'own group above another', world: 'veilwood', active: 'The Wanderer / Instincts', over: 'The Wanderer / Constitution', offset: 0, outcome: 'moved', writes: ['The Wanderer'] },
  { name: 'own trait over a collapsed group', world: 'veilwood', active: 'The Wanderer / Move Quietly', over: 'The Wanderer / Constitution', offset: 1, collapsed: ['The Wanderer / Constitution'], outcome: 'moved', writes: ['The Wanderer'] },
  { name: 'link row above another link', world: 'emberwatch', active: 'Wanderer / Classes', over: 'Wanderer / Races', offset: 0, outcome: 'moved', writes: ['Wanderer'] },
  // Across owners.
  { name: 'own trait out to the world past a hidden Blueprints group', world: 'veilwood-trait-blueprints', active: 'The Wanderer / Move Quietly', over: 'The Wanderer', offset: -1, emptySystemNodes: false, outcome: 'moved', writes: ['world', 'The Wanderer'] },
  { name: 'own trait out to the world', world: 'veilwood', active: 'The Wanderer / Move Quietly', over: 'The Wanderer', offset: -1, outcome: 'moved', writes: ['world', 'The Wanderer'] },
  { name: 'world trait into an entity', world: 'emberwatch', active: 'Bonds / Squire to Albus', over: 'Albus', offset: 0, outcome: 'moved', writes: ['world', 'Albus'] },
  { name: 'link row to another entity', world: 'emberwatch', active: 'Mother Hesk / Dwarf', over: 'Corvin Vale / Human', offset: 0, outcome: 'moved', writes: ['Mother Hesk', 'Corvin Vale'] },
  { name: 'link row to an entity that holds its original', world: 'emberwatch', active: 'Corvin Vale / Human', over: 'Albus / Races', offset: 0, outcome: 'refused:duplicate' },
  { name: 'link row out to the world', world: 'emberwatch', active: 'Mother Hesk / Dwarf', over: 'Bonds', offset: -1, outcome: 'none' },
  { name: 'entity node into a world group', world: 'emberwatch', active: 'Albus', over: 'Bonds / Squire to Albus', offset: 1, outcome: 'moved', writes: ['world', 'Albus'] },
  { name: 'entity node held out of Blueprints', world: 'emberwatch', active: 'Albus', over: 'Blueprints / Races / Human', offset: 0, outcome: 'none' },
  // Onto the Custom Persona entity's root, and its node off the top level.
  { name: 'world trait into the Custom Persona entity', world: 'emberwatch', active: 'Bonds / Squire to Albus', over: 'Wanderer', offset: 0, outcome: 'moved', writes: ['world', 'Wanderer'] },
  { name: 'Custom Persona node into a world group', world: 'emberwatch', active: 'Wanderer', over: 'Bonds / Squire to Albus', offset: 1, outcome: 'refused:root' },
  // Blueprints with links on and off.
  { name: 'Blueprint trait into an entity, links on', world: 'emberwatch', active: 'Blueprints / Class Abilities / Firebolt', over: 'Mother Hesk / Dwarf', offset: 0, outcome: 'moved', writes: ['Mother Hesk'] },
  { name: 'Blueprint trait into an entity, links off', world: 'emberwatch', active: 'Blueprints / Class Abilities / Firebolt', over: 'Mother Hesk / Dwarf', offset: 0, createLinks: false, outcome: 'moved', writes: ['world', 'Mother Hesk'] },
  { name: 'linked Blueprint trait into an entity, links on', world: 'emberwatch', active: 'Blueprints / Races / Dwarf', over: 'Mother Hesk / Cleric', offset: 0, outcome: 'refused:duplicate' },
  { name: 'linked Blueprint trait into an entity, links off', world: 'emberwatch', active: 'Blueprints / Races / Human', over: 'Mother Hesk / Dwarf', offset: 0, createLinks: false, outcome: 'refused:blueprint-linked' },
  { name: 'Blueprint trait into the Custom Persona entity, links on', world: 'emberwatch', active: 'Blueprints / Class Abilities / Firebolt', over: 'Wanderer', offset: 0, outcome: 'refused:duplicate' },
  { name: 'linked Blueprint group out of Blueprints', world: 'emberwatch', active: 'Blueprints / Races', over: 'Bonds', offset: -1, outcome: 'refused:blueprint-linked' },
  { name: 'unread world trait into Blueprints', world: 'emberwatch', active: 'Bonds / Squire to Albus', over: 'Blueprints / Races', offset: 0, outcome: 'moved', writes: ['world'] },
  { name: 'unread own trait into Blueprints', world: 'veilwood-trait-reader', active: 'The Wanderer / Move Quietly', over: 'The Wanderer', offset: 0, outcome: 'moved', writes: ['world', 'The Wanderer'] },
  { name: 'read own trait into Blueprints', world: 'veilwood-trait-reader', active: 'The Wanderer / Instincts / Keen Eye', over: 'The Wanderer', offset: -1, outcome: 'refused:into-blueprints' },
];

const statCases: DropCase[] = [
  // Within an owner.
  { name: 'own stat above a sibling', world: 'veilwood', active: 'The Wanderer / Toxin', over: 'The Wanderer / Health', offset: 0, outcome: 'moved', writes: ['world', 'The Wanderer'] },
  { name: 'link row above another link', world: 'emberwatch', active: 'Albus / Renown', over: 'Albus / Health', offset: 0, outcome: 'moved', writes: ['Albus', 'Mother Hesk', 'Corvin Vale'] },
  { name: 'entity node above another', world: 'emberwatch', active: 'Corvin Vale', over: 'Mother Hesk', offset: 0, outcome: 'moved', writes: ['Wanderer', 'Albus', 'Sylvie Thornwhistle', 'Mother Hesk', 'Corvin Vale'] },
  { name: 'entity node held out of Blueprints', world: 'emberwatch', active: 'Albus', over: 'Blueprints / Gold', offset: 0, outcome: 'none' },
  // Across owners.
  { name: 'own stat out to the world', world: 'veilwood-spare', active: 'The Wanderer / Calm', over: 'The Wanderer', offset: -1, outcome: 'moved', writes: ['world', 'The Wanderer'] },
  { name: 'own stat out to the world beside an empty Blueprints group', world: 'veilwood-stat-blueprints', active: 'The Wanderer / Calm', over: 'The Wanderer', offset: -1, emptySystemNodes: false, outcome: 'moved', writes: ['world', 'The Wanderer'] },
  { name: "world stat among an entity's stats", world: 'veilwood-spare', active: 'Loose', over: 'The Wanderer / Health', offset: 0, outcome: 'moved', writes: ['world', 'The Wanderer'] },
  { name: 'own stat to another entity', world: 'emberwatch-spare', active: 'Mother Hesk / Resolve', over: 'Corvin Vale / Renown', offset: 0, outcome: 'moved', writes: ['Mother Hesk', 'Corvin Vale'] },
  { name: 'read own stat out to the world', world: 'veilwood', active: 'The Wanderer / Toxin', over: 'The Wanderer', offset: -1, outcome: 'refused:read' },
  { name: 'read own stat to another entity', world: 'emberwatch', active: 'Mother Hesk / Faith', over: 'Corvin Vale / Renown', offset: 0, outcome: 'refused:read' },
  { name: 'own stat to an entity that holds its id', world: 'emberwatch', active: 'Mother Hesk / Health', over: 'Albus / Mana', offset: 0, outcome: 'refused:duplicate' },
  { name: 'read link row to another entity', world: 'emberwatch', active: 'Albus / Gold', over: 'Mother Hesk / Health', offset: 0, outcome: 'refused:read' },
  { name: 'link row to an entity that holds its original', world: 'emberwatch', active: 'Albus / Mana', over: 'Corvin Vale / Renown', offset: 0, outcome: 'refused:held' },
  { name: 'link row out to the world', world: 'emberwatch', active: 'Albus / Gold', over: 'Albus', offset: -1, outcome: 'none' },
  // Onto the Custom Persona entity's root, and its node off the top level.
  { name: 'world stat into the Custom Persona entity', world: 'veilwood-spare', active: 'Loose', over: 'The Wanderer', offset: 1, outcome: 'moved', writes: ['world', 'The Wanderer'] },
  { name: 'read world stat into the Custom Persona entity', world: 'veilwood', active: 'Predator Attention', over: 'The Wanderer / Health', offset: 0, outcome: 'refused:read' },
  { name: 'Custom Persona node into a world group', world: 'veilwood-grouped', active: 'The Wanderer', over: 'Threats / Predator Attention', offset: 1, outcome: 'refused:root' },
  // Blueprints with links on and off.
  { name: 'Blueprint stat into an entity, links on', world: 'emberwatch', active: 'Blueprints / Gold', over: 'Mother Hesk / Health', offset: 0, outcome: 'moved', writes: ['Mother Hesk'] },
  { name: 'Blueprint stat into an entity, links off', world: 'emberwatch', active: 'Blueprints / Gold', over: 'Mother Hesk / Health', offset: 0, createLinks: false, outcome: 'none' },
  { name: 'Blueprint stat into an entity that holds it, links on', world: 'emberwatch', active: 'Blueprints / Health', over: 'Mother Hesk / Faith', offset: 0, outcome: 'refused:held' },
  { name: 'Blueprint stat into the Custom Persona entity, links on', world: 'emberwatch', active: 'Blueprints / Gold', over: 'Wanderer / Health', offset: 0, outcome: 'refused:held' },
  { name: 'linked Blueprint stat out of Blueprints', world: 'emberwatch', active: 'Blueprints / Health', over: 'Blueprints', offset: -1, outcome: 'refused:blueprint-linked' },
  { name: 'unread world stat into Blueprints', world: 'veilwood-stat-blueprints', active: 'Loose', over: 'Blueprints', offset: 1, outcome: 'moved', writes: ['world', 'The Wanderer'] },
  { name: 'read world stat into Blueprints', world: 'veilwood-stat-blueprints', active: 'Predator Attention', over: 'Blueprints', offset: 1, outcome: 'refused:into-blueprints' },
];

const statLists = (w: World) => ({ stats: w.stats, statGroups: w.statGroups ?? [] });
const traitLists = (w: World) => ({ traits: w.traits, traitGroups: w.traitGroups ?? [] });

function traitDrop(c: DropCase): OwnedTraitDrop | null {
  const w = worlds[c.world]();
  const emptySystemNodes = c.emptySystemNodes ?? true;
  const tree = ownedTraitTree(traitLists(w), w.entities, [], { links: true, emptySystemNodes });
  const at = rowLocator(ownedTraitRows(tree, []), [...tree.groups, ...tree.traits]);
  return applyOwnedTraitDrop(traitLists(w), w.entities, (c.collapsed ?? []).map(at), at(c.active), at(c.over), c.offset * INDENT, INDENT, {
    createLinks: c.createLinks ?? true, emptySystemNodes, newLinkId: () => 'parity-link', codeWorld: { ...statLists(w), placeholders: w.placeholders ?? [] },
  });
}

function statDrop(c: DropCase): OwnedStatDrop | null {
  const w = worlds[c.world]();
  const emptySystemNodes = c.emptySystemNodes ?? true;
  const tree = ownedStatTree(statLists(w), w.entities, { emptySystemNodes });
  const at = rowLocator(ownedStatRows(tree, []), [...tree.groups, ...tree.stats]);
  const readerWorld = { ...statLists(w), ...traitLists(w), entities: w.entities, placeholders: w.placeholders ?? [] };
  return applyOwnedStatDrop(readerWorld, (c.collapsed ?? []).map(at), at(c.active), at(c.over), c.offset * INDENT, INDENT, {
    createLinks: c.createLinks ?? true, emptySystemNodes, newLinkId: () => 'parity-link',
  });
}

type Drop = OwnedTraitDrop | OwnedStatDrop | null;
const outcomeOf = (out: Drop): Outcome => (out === null ? 'none' : out.kind === 'refused' ? `refused:${out.refusal.reason}` : 'moved');
const writesOf = (out: Drop): string[] | undefined =>
  (out?.kind === 'moved' ? [...(out.world ? ['world'] : []), ...out.entities.map((e) => e.name)] : undefined);
const TREE_FIELDS: readonly string[] = ['traits', 'traitGroups', 'traitLinks', 'traitPlacement', 'stats', 'statGroups', 'statLinks', 'statPlacement'];
const fields = (e: Entity, tree: boolean) => Object.fromEntries(Object.entries(e).filter(([k]) => TREE_FIELDS.includes(k) === tree));

/** The drop as JSON can hold it, each written entity by its tree fields. */
const recorded = (out: Drop) => (out?.kind !== 'moved' ? out : {
  ...out,
  entities: out.entities.map((e) => ({ id: e.id, ...fields(e, true) })),
  ...('rowIds' in out ? { rowIds: Object.fromEntries(out.rowIds) } : {}),
});

/** The case's outcome, what it writes, and that each written entity keeps every field outside its trees. */
function expectCase(c: DropCase, out: Drop) {
  expect(outcomeOf(out)).toBe(c.outcome);
  expect(writesOf(out)).toEqual(c.writes);
  const before = new Map(worlds[c.world]().entities.map((e) => [e.id, e]));
  for (const e of out?.kind === 'moved' ? out.entities : []) expect(fields(e, false), e.name).toEqual(fields(before.get(e.id)!, false));
}

/** The record as JSON with every object's keys sorted, since key order is no behavior. */
const json = (value: unknown) => `${JSON.stringify(value, (_k, v: unknown) => (v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v), 2)}\n`;

describe('owner-tree drop parity', () => {
  it.each(traitCases)('trait drop: $name', (c) => expectCase(c, traitDrop(c)));
  it.each(statCases)('stat drop: $name', (c) => expectCase(c, statDrop(c)));

  it('records every drop', async () => {
    const record = {
      traits: Object.fromEntries(traitCases.map((c) => [c.name, recorded(traitDrop(c))])),
      stats: Object.fromEntries(statCases.map((c) => [c.name, recorded(statDrop(c))])),
    };
    await expect(json(record)).toMatchFileSnapshot('./__parity__/ownerTreeDrops.json');
  });
});

/** The entity as a world with other ids carries it: each link's original known by its stored name only. */
const carried = (entity: Entity): Entity => {
  const rename = <L extends { originalId: string }>(links: L[] | undefined) => links?.map((l) => ({ ...l, originalId: `carried-${l.originalId}` }));
  return { ...entity, traitLinks: rename(entity.traitLinks), statLinks: rename(entity.statLinks) };
};
const owning = (e: Entity) => TREE_FIELDS.some((k) => k !== 'traitPlacement' && k !== 'statPlacement' && (e[k as keyof Entity] as unknown[] | undefined)?.length);
const traitFields = ({ traits, traitGroups, traitLinks }: Entity) => ({ traits, traitGroups, traitLinks });
const statFields = ({ stats, statGroups, statLinks }: Entity) => ({ stats, statGroups, statLinks });

describe('owner-tree link parity', () => {
  const entities = [...bundled].sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([file, w]) => w.entities.filter(owning).map((e) => ({ file, w, e })));

  /** The entity's portable lists, and its lists bound back into its world by id and by stored name. */
  const linkRecord = ({ w, e }: (typeof entities)[number]) => {
    const traitWorld = traitWorldOf(w);
    if (!traitWorld) throw new Error('A bundled world without traits');
    const portableTraits = portableOwnedTraits(e, traitWorld);
    const portableStats = portableOwnedStats(e, statLists(w));
    const portable = { ...e, ...portableTraits, ...portableStats };
    return {
      portableTraits, portableStats,
      boundTraits: traitFields(bindOwnedTraits(portable, traitWorld)),
      boundStats: statFields(bindOwnedStats(portable, statLists(w))),
      carriedTraits: traitFields(bindOwnedTraits(carried(portable), traitWorld)),
      carriedStats: statFields(bindOwnedStats(carried(portable), statLists(w))),
    };
  };

  it.each(entities.map((x) => [`${x.file}: ${x.e.name}`, x] as const))('binds every link of %s back, by id and by name', (_label, x) => {
    const r = linkRecord(x);
    const links = [r.portableTraits.traitLinks?.length ?? 0, r.portableStats.statLinks?.length ?? 0];
    expect([r.boundTraits.traitLinks?.length ?? 0, r.boundStats.statLinks?.length ?? 0]).toEqual(links);
    expect([r.carriedTraits.traitLinks?.length ?? 0, r.carriedStats.statLinks?.length ?? 0]).toEqual(links);
  });

  const overlap = (() => {
    const w = emberwatchOverlap();
    return { file: 'emberwatch-overlap', w, e: w.entities.find((e) => e.name === 'Albus')! };
  })();

  it('binds the tree-first of two overlapping stat links, by id and by name', () => {
    const r = linkRecord(overlap);
    expect(r.boundStats.statLinks?.filter((l) => l.originalId === 'health').map((l) => l.id)).toEqual(['parity-health-above']);
    expect(r.carriedStats.statLinks?.filter((l) => l.originalId === 'health').map((l) => l.id)).toEqual(['parity-health-above']);
  });

  it('records the portable and bound lists of every owning bundled entity', async () => {
    const record: Record<string, Record<string, ReturnType<typeof linkRecord>>> = {};
    for (const x of [...entities, overlap]) (record[x.file] ??= {})[x.e.name] = linkRecord(x);
    await expect(json(record)).toMatchFileSnapshot('./__parity__/ownerTreeLinks.json');
  });
});
