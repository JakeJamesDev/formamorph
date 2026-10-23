/**
 * Every script in a world as the Scripts tab lists it: one entry per script, filed under its timing in run order,
 * and the writes that reorder or edit a script wherever its home keeps it.
 */

import type { Entity, Placeholder, Script, ScriptTiming, Stat, StatGroup, Trait, TraitGroup } from '@/types';
import { setTraitLinkScripts } from './blueprints';
import { rowIdOf, WORLD_SCRIPT_OWNER } from './codeUses';
import { updateOwnedStat } from './ownedStats';
import { linksInTreeOrder } from './owners';
import { updateOwnedTrait } from './ownedTraits';
import { filledScripts, inRunOrder, SCRIPT_TIMINGS, scriptLabel, scriptsOf } from './scripts';
import { setStatLinkScripts, withStatLinks } from './statLinks';
import { traitOrderIndex } from './traitEffects';
import {
  statCodeBoxes, statCodeOwners, traitCodeBoxes, worldScriptBoxes, type CodeHome, type CodeOwners, type ScriptPick,
  type StatCodeBox, type TraitCodeBox, type TraitCodeHome, type WorldScriptBox, type WorldScriptHome,
} from './statCodeTargets';

/** Where a script is stored: the world's own list, or a stat's or trait's home as Find All Uses names it. */
export type ScriptHomeRef = WorldScriptHome | CodeHome | TraitCodeHome;

/** What the tree reads from a world. */
export interface ScriptTreeWorld {
  scripts?: readonly Script[];
  stats: readonly Stat[];
  statGroups: readonly StatGroup[];
  traits: readonly Trait[];
  traitGroups: readonly TraitGroup[];
  entities: readonly Entity[];
  placeholders: readonly Placeholder[];
}

/** One row of the tree. */
export interface ScriptEntry {
  /** Unique among the rows: a link's copy of a Blueprint script shares the script's id. */
  key: string;
  home: ScriptHomeRef;
  script: Script;
  /** The stat's or trait's authored name, chips and all; "World" for a world script. */
  ownerName: string;
  /** The script's name, or its owner and timing (Q6). */
  label: string;
  /** The entity the stat or trait sits on. */
  entity: Entity | null;
  /** The stat or trait the box opens on its own tab; absent on a world script. */
  box?: StatCodeBox | TraitCodeBox;
}

const homeKey = (home: ScriptHomeRef): string => {
  switch (home.kind) {
    case 'world': return 'world';
    case 'stat': return `stat/${home.statId}`;
    case 'entity': return `entity/${home.entityId}/${home.statId}`;
    case 'link': return `link/${home.entityId}/${home.linkId}/${home.statId}`;
    case 'trait': return `trait/${home.traitId}`;
    case 'entityTrait': return `entityTrait/${home.entityId}/${home.traitId}`;
    case 'traitLink': return `traitLink/${home.entityId}/${home.linkId}/${home.traitId}`;
  }
};

/** The row key of the script `scriptId` at `home`. */
export const scriptEntryKey = (home: ScriptHomeRef, scriptId: string): string => `${homeKey(home)}|${scriptId}`;

/** The editor tab whose row opens a script's home. */
export type ScriptSection = 'scripts' | 'stats' | 'traits' | 'entities';

/** One script of the world with its box: its owner, its timing and its runs. */
export type ListedScript = { key: string; section: ScriptSection } & (
  | { kind: 'world'; box: WorldScriptBox }
  | { kind: 'stat'; box: StatCodeBox }
  | { kind: 'trait'; box: TraitCodeBox }
);

/**
 * Every script of the world once, as every reader walks it: the world's, then each stat's, then each trait's. A
 * Blueprint stat or trait is one box that runs once per owner; a link adds its own box only where it overrides
 * the scripts. `pick` widens the walk, such as to blank scripts.
 */
export function worldScriptList(
  world: ScriptTreeWorld, pick: ScriptPick = filledScripts, owners: CodeOwners = statCodeOwners(world),
): ListedScript[] {
  const onEntity = (box: StatCodeBox | TraitCodeBox, own: ScriptSection) => (box.entity ? 'entities' : own);
  return [
    ...worldScriptBoxes({ worldScripts: world.scripts }, pick).map((box): ListedScript => ({
      kind: 'world', box, key: scriptEntryKey(box.home, box.id), section: 'scripts',
    })),
    ...statCodeBoxes(owners, pick).map((box): ListedScript => ({
      kind: 'stat', box, key: scriptEntryKey(box.home, box.id), section: onEntity(box, 'stats'),
    })),
    ...traitCodeBoxes(owners, world, pick).map((box): ListedScript => ({
      kind: 'trait', box, key: scriptEntryKey(box.home, box.id), section: onEntity(box, 'traits'),
    })),
  ];
}

const entryOf = (home: ScriptHomeRef, script: Script, ownerName: string, entity: Entity | null, box?: StatCodeBox | TraitCodeBox): ScriptEntry => ({
  key: scriptEntryKey(home, script.id), home, script, ownerName, label: scriptLabel(script, ownerName), entity, ...(box && { box }),
});

/** The row a box opens on its owner's tab. */
export const ownerRowId = (entry: ScriptEntry): string | null => (entry.box ? rowIdOf(entry.box) : null);

/**
 * Every script in the world, blank ones included, in the order the runner reaches owners: the world's, the global
 * stats' in stat order, the global traits', each entity's stats then traits in authored order, then the Blueprints'.
 * A Blueprint script runs under each owner that links it, so its one row comes last. The played persona's move to
 * the front is a play-time fact the editor can't show.
 */
export function worldScriptEntries(world: ScriptTreeWorld): ScriptEntry[] {
  const listed = worldScriptList(world, scriptsOf);
  const stats = listed.flatMap((entry) => (entry.kind === 'stat' ? [entry.box] : []));
  const traits = listed.flatMap((entry) => (entry.kind === 'trait' ? [entry.box] : []));
  const worldScripts = listed.flatMap((entry) => (entry.kind === 'world' ? [entry.box] : []));
  const statEntry = (box: StatCodeBox) => entryOf(box.home, box.script, box.stat.name, box.entity, box);
  const traitEntry = (box: TraitCodeBox) => entryOf(box.home, box.script, box.trait.name, box.entity, box);
  const blueprint = (box: StatCodeBox | TraitCodeBox) => (box.home.kind === 'stat' || box.home.kind === 'trait') && box.owner !== null;
  const global = (box: StatCodeBox | TraitCodeBox) => (box.home.kind === 'stat' || box.home.kind === 'trait') && box.owner === null;
  // The runner reaches global traits in the Traits tab's order (Q50); the sort is stable within one trait's scripts.
  const treeOrder = traitOrderIndex(world.traits, world.traitGroups);
  const treePlace = (box: TraitCodeBox) => treeOrder.get(box.trait.id) ?? Number.MAX_SAFE_INTEGER;
  const globalTraits = () => traits.filter(global).sort((a, b) => treePlace(a) - treePlace(b));
  const onEntity = (id: string) => (box: StatCodeBox | TraitCodeBox) => box.entity?.id === id;
  // An entity runs its own traits, then its links' in the link tree's order.
  const entityTraits = (entity: Entity) => {
    const place = new Map(linksInTreeOrder(entity).map((link, i) => [link.id, i]));
    const at = (box: TraitCodeBox) => (box.home.kind === 'traitLink' ? place.get(box.home.linkId) ?? place.size : -1);
    return traits.filter(onEntity(entity.id)).sort((a, b) => at(a) - at(b));
  };
  return [
    ...worldScripts.map((box) => entryOf(box.home, box.script, WORLD_SCRIPT_OWNER, null)),
    ...stats.filter(global).map(statEntry),
    ...globalTraits().map(traitEntry),
    ...world.entities.flatMap((entity) => [
      ...stats.filter(onEntity(entity.id)).map(statEntry),
      ...entityTraits(entity).map(traitEntry),
    ]),
    ...stats.filter(blueprint).map(statEntry),
    ...traits.filter(blueprint).map(traitEntry),
  ];
}

/** `entries` filed by timing, each timing in run order. */
export function scriptsByTiming(entries: readonly ScriptEntry[]): Record<ScriptTiming, ScriptEntry[]> {
  return Object.fromEntries(SCRIPT_TIMINGS.map((timing) => [
    timing, inRunOrder(entries.filter((entry) => entry.script.timing === timing)),
  ])) as Record<ScriptTiming, ScriptEntry[]>;
}

/** One script's new `order`. */
export interface OrderWrite {
  entry: ScriptEntry;
  order: number;
}

/**
 * The `order` writes that move `activeKey` onto `overKey` within one timing's rows, or to the top on `'top'`.
 * Every row takes its new index; only a row whose `order` differs is written (Q5). Null when either row is not
 * in `rows`: a drop on another timing, which the timing menu alone may do (Q4).
 */
export function reorderWrites(rows: readonly ScriptEntry[], activeKey: string, overKey: string | 'top'): OrderWrite[] | null {
  const from = rows.findIndex((entry) => entry.key === activeKey);
  const to = overKey === 'top' ? 0 : rows.findIndex((entry) => entry.key === overKey);
  if (from < 0 || to < 0) return null;
  const moved = [...rows];
  const [active] = moved.splice(from, 1);
  moved.splice(to, 0, active);
  return moved.flatMap((entry, order) => (entry.script.order === order ? [] : [{ entry, order }]));
}

/** A rewrite of one home's scripts. */
export interface ScriptEdit {
  home: ScriptHomeRef;
  edit: (scripts: Script[]) => Script[];
}

/** One edit per home, each setting the `order` of the scripts it moves. */
export function orderEdits(writes: readonly OrderWrite[]): ScriptEdit[] {
  const byHome = new Map<string, { home: ScriptHomeRef; orders: Map<string, number> }>();
  for (const { entry, order } of writes) {
    const key = homeKey(entry.home);
    const at = byHome.get(key) ?? { home: entry.home, orders: new Map() };
    at.orders.set(entry.script.id, order);
    byHome.set(key, at);
  }
  return [...byHome.values()].map(({ home, orders }) => ({
    home,
    edit: (scripts) => scripts.map((script) => (orders.has(script.id) ? { ...script, order: orders.get(script.id)! } : script)),
  }));
}

/** The slices a script edit may rewrite. */
export interface ScriptSlices {
  scripts: Script[];
  stats: Stat[];
  traits: Trait[];
  entities: Entity[];
}

/** A stat or trait with `scripts` as its list; an empty list stores none. */
function withScripts<T extends { scripts?: Script[] }>(item: T, scripts: Script[]): T {
  const { scripts: _old, ...rest } = item;
  return (scripts.length ? { ...rest, scripts } : rest) as T;
}

/** The slices `edits` rewrite, each applied where its home stores the script; slices no edit touched are absent.
 *  A link's override takes the new list and keeps its Blueprint snapshot. */
export function editScripts(world: Pick<ScriptTreeWorld, 'scripts' | 'stats' | 'traits' | 'entities'>, edits: readonly ScriptEdit[]): Partial<ScriptSlices> {
  const out: Partial<ScriptSlices> = {};
  const read = {
    scripts: () => out.scripts ?? [...world.scripts ?? []],
    stats: () => out.stats ?? [...world.stats],
    traits: () => out.traits ?? [...world.traits],
    entities: () => out.entities ?? [...world.entities],
  };
  const onEntity = (entityId: string, edit: (entity: Entity) => Entity) => {
    out.entities = read.entities().map((entity) => (entity.id === entityId ? edit(entity) : entity));
  };
  for (const { home, edit } of edits) {
    switch (home.kind) {
      case 'world':
        out.scripts = edit(read.scripts());
        break;
      case 'stat':
        out.stats = read.stats().map((stat) => (stat.id === home.statId ? withScripts(stat, edit([...scriptsOf(stat)])) : stat));
        break;
      case 'trait':
        out.traits = read.traits().map((trait) => (trait.id === home.traitId ? withScripts(trait, edit([...scriptsOf(trait)])) : trait));
        break;
      case 'entity':
        onEntity(home.entityId, (entity) => {
          const stat = entity.stats?.find((entry) => entry.id === home.statId);
          return stat ? updateOwnedStat(entity, withScripts(stat, edit([...scriptsOf(stat)]))) : entity;
        });
        break;
      case 'entityTrait':
        onEntity(home.entityId, (entity) => {
          const trait = entity.traits?.find((entry) => entry.id === home.traitId);
          return trait ? updateOwnedTrait(entity, withScripts(trait, edit([...scriptsOf(trait)]))) : entity;
        });
        break;
      case 'link':
        onEntity(home.entityId, (entity) => withStatLinks(entity, (entity.statLinks ?? []).map((link) => {
          const current = link.id === home.linkId ? link.overrides?.[home.statId]?.scripts : undefined;
          return current ? setStatLinkScripts(link, home.statId, edit([...current.value]), current.blueprint, current.blueprint) : link;
        })));
        break;
      case 'traitLink':
        onEntity(home.entityId, (entity) => ({
          ...entity,
          traitLinks: (entity.traitLinks ?? []).map((link) => {
            const current = link.id === home.linkId ? link.overrides?.[home.traitId]?.scripts : undefined;
            return current ? setTraitLinkScripts(link, home.traitId, edit([...current.value]), current.blueprint, current.blueprint) : link;
          }),
        }));
        break;
    }
  }
  return out;
}
