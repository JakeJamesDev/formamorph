/**
 * Which stat a route in stat code reaches, with no playthrough: every box of code in a world, the runs each
 * box gets, and the owner's stat that `stats.X`, `owner.stats.X`, `entities[x].stats.X`, or
 * `persona.stats.X` lands on from each run. The Test Bench rules and the rename planner read this one
 * resolution.
 *
 * Every authored entity counts as in the game, and `persona` may be any entity that can be played (Q11).
 */

import type { Entity, Placeholder, Script, Stat, StatGroup, StatLink, Tool, Trait, TraitGroup, TraitLink } from '@/types';
import { canBePlayer } from './owners';
import { codeRenameChains, type CodeRenameKey } from './codeRenameChains';
import { hasEntityKey, statCodeName, statsByCodeName } from './statCodeNames';
import { filledCodeBoxes } from './statCodeTiming';
import { filledScripts, hasCode, type ScriptHome } from './scripts';
import { SCRIPT_TIMING_OF_TOOL, toolTimingOf } from './tools/worldTools';
import { effectiveLinkTrait, linkTraitState } from './blueprints';
import { blueprintItemIds, isDescendantGroup } from './traitTree';
import {
  blueprintGroupStats, globalStatsOf, resolvedEntityStatTree, statBlueprintIds, statLinkState, type StatLinkWorld,
} from './statLinks';

/** What the resolution reads from a world. */
export interface StatRouteWorld {
  stats?: readonly Stat[];
  statGroups?: readonly StatGroup[];
  entities?: readonly Entity[];
  /** Every placeholder, owned ones included, since stat and entity names read through their chips. */
  placeholders: readonly Placeholder[];
}

/** One owner whose stats code reaches: the world, an entity, or a Blueprint group in its own box. */
export interface CodeOwner {
  entity: Entity | null;
  /** Its stats as play reads them. An entity's include the stats its links bring. */
  stats: Stat[];
  /** Its stats as its stat map keys them by code name. */
  byCodeName: ReadonlyMap<string, Stat>;
  /** A linked stat's id → the link that brings it. Empty off an entity. */
  linkOf: ReadonlyMap<string, StatLink>;
}

type EntityOwner = CodeOwner & { entity: Entity };

/** Every owner stat code reaches. */
export interface CodeOwners {
  world: CodeOwner;
  /** The world, then each entity in authored order. */
  all: CodeOwner[];
  /** Each entity as `entities` keys it by code name. */
  byName: ReadonlyMap<string, EntityOwner>;
  /** What `persona` may be (Q11). */
  playable: EntityOwner[];
  statWorld: StatLinkWorld;
  /** Stats as a stat map keys them by code name. */
  byCodeName: (stats: readonly Stat[]) => ReadonlyMap<string, Stat>;
  /** A stat or entity name as code reads it. */
  codeName: (name: string | undefined) => string;
}

/** A stat authored off runs no code and takes no write. */
export const isStatOn = (stat: Stat): boolean => stat.enabled !== false;

const NO_LINKS: ReadonlyMap<string, StatLink> = new Map();

export function statCodeOwners(world: StatRouteWorld): CodeOwners {
  const codeName = (text: string | undefined) => statCodeName(text, world.placeholders);
  const statWorld = { stats: [...world.stats ?? []], statGroups: [...world.statGroups ?? []] };
  const byCodeName = (stats: readonly Stat[]) => statsByCodeName(stats, (stat) => codeName(stat.name), isStatOn);
  const worldStats = globalStatsOf(statWorld.stats, statWorld.statGroups);
  const worldOwner: CodeOwner = { entity: null, stats: worldStats, byCodeName: byCodeName(worldStats), linkOf: NO_LINKS };
  const entities = (world.entities ?? []).map((entity): EntityOwner => {
    const tree = resolvedEntityStatTree(statWorld, entity);
    return { entity, stats: tree.stats, byCodeName: byCodeName(tree.stats), linkOf: tree.linkOf };
  });
  return {
    world: worldOwner,
    all: [worldOwner, ...entities],
    byName: new Map(entities.map((o) => [codeName(o.entity.name), o] as const).filter(([name]) => hasEntityKey(name))),
    playable: entities.filter((o) => canBePlayer(o.entity)),
    statWorld,
    byCodeName,
    codeName,
  };
}

/** One route's literal keys: its global, the entity an `entities` route names, and the stat's code name.
 *  A `self` route names no stat. */
export interface StatRoute {
  root: 'self' | 'stats' | 'owner' | 'entities' | 'persona';
  entity?: string;
  stat: string | null;
}

/** One run of a box: the stat it runs as, and what `owner` holds there. Null is the empty `owner`. */
export interface CodeRun {
  self: Stat;
  owner: CodeOwner | null;
}

/** One run of a trait's box, which runs as no stat. */
export type TraitRun = Pick<CodeRun, 'owner'>;

/** One owner's stat a route lands on. */
export interface StatTarget {
  owner: CodeOwner;
  stat: Stat;
}

/** Each owner's stat `route` lands on from one run. */
export function routeTargets(owners: CodeOwners, run: TraitRun & { self?: Stat }, route: StatRoute): StatTarget[] {
  const on = (owner: CodeOwner | null | undefined): StatTarget[] => {
    const stat = owner && route.stat !== null ? owner.byCodeName.get(route.stat) : undefined;
    return owner && stat ? [{ owner, stat }] : [];
  };
  switch (route.root) {
    case 'self': return run.self ? [{ owner: run.owner ?? owners.world, stat: run.self }] : [];
    case 'stats': return on(owners.world);
    case 'owner': return on(run.owner);
    case 'entities': return on(owners.byName.get(route.entity ?? ''));
    case 'persona': return owners.playable.flatMap((target) => on(target));
  }
}

/** Where a box's code is authored. */
export type CodeHome =
  /** A global stat's own box, a Blueprint stat's included. */
  | { kind: 'stat'; statId: string }
  /** An entity's own stat. */
  | { kind: 'entity'; entityId: string; statId: string }
  /** An owner's link that overrides this box of the Blueprint stat it brings. */
  | { kind: 'link'; entityId: string; linkId: string; statId: string };

/** One script of a stat that holds code. */
export interface StatCodeBox extends Script {
  home: CodeHome;
  /** The stored script the box was built from. */
  script: Script;
  /** The stat as its runs read it: an owner's linked copy for a link's box. */
  stat: Stat;
  /** The entity an own or link box sits on. */
  entity: Entity | null;
  /** What `owner` holds where the editor reads the box: the empty entry for a global stat, the group alone for
   *  a Blueprint stat (Q10), the entity otherwise. */
  owner: CodeOwner | null;
  /** Each run the box gets in play: one per owner for a Blueprint stat whose link leaves the box alone. */
  runs: CodeRun[];
}

/** Where a trait's script is authored. */
export type TraitCodeHome =
  /** A world trait's own script, a Blueprint trait's included. */
  | { kind: 'trait'; traitId: string }
  /** An entity's own trait. */
  | { kind: 'entityTrait'; entityId: string; traitId: string }
  /** An owner's link that overrides the scripts of the Blueprint trait it brings. */
  | { kind: 'traitLink'; entityId: string; linkId: string; traitId: string };

/** One script of a trait that holds code. Its runs read no stat as `self`. */
export interface TraitCodeBox extends Script {
  home: TraitCodeHome;
  /** The stored script the box was built from. */
  script: Script;
  /** The trait as its runs read it: a link's override applied. */
  trait: Trait;
  entity: Entity | null;
  /** What `owner` holds where the editor reads the box: none for a global trait, an empty entry for a Blueprint
   *  trait, whose owners vary, the entity otherwise. */
  owner: CodeOwner | null;
  /** Each run the box gets in play: one per owner for a Blueprint trait whose link leaves its scripts alone. */
  runs: TraitRun[];
}

/** The world's traits, which a trait box reads. */
export interface TraitCodeWorld {
  traits: readonly Trait[];
  traitGroups: readonly TraitGroup[];
}

/** Which of a home's scripts a walk visits. */
export type ScriptPick = (home: ScriptHome) => readonly Script[];

/** Where a world script is authored: the world's own list. */
export type WorldScriptHome = { kind: 'world' };

/** One world script that holds code. It runs once, with `self` and `owner` empty (Q31). */
export interface WorldScriptBox extends Script {
  home: WorldScriptHome;
  /** The stored script the box was built from. */
  script: Script;
  owner: null;
  runs: TraitRun[];
}

/** What a walk of world scripts reads from a world. */
export interface WorldScriptsSource {
  worldScripts?: readonly Script[];
}

/** Whether a box is a world script's. */
export const isWorldScriptBox = (box: { home: { kind: string } }): box is WorldScriptBox => box.home.kind === 'world';

/** The world's filled scripts, in stored order. `pick` widens the walk. */
export function worldScriptBoxes(world: WorldScriptsSource, pick: ScriptPick = filledScripts): WorldScriptBox[] {
  return pick({ scripts: world.worldScripts }).map((script) => ({ home: { kind: 'world' }, ...script, script, owner: null, runs: [] }));
}

/** Where a World Tool's script is authored: the Tool on the Tools tab. */
export type WorldToolHome = { kind: 'tool'; toolId: string };

/** One Script World Tool that holds code. It runs with `self` and `owner` empty, as a world script does, and reads
 *  `args` too. Its `id` is the Tool's, and its timing the script timing the Tool runs on. */
export interface WorldToolBox extends Script {
  home: WorldToolHome;
  /** The Script the Tool's handler reads as. */
  script: Script;
  /** The Tool as the Tools tab holds it. */
  tool: Tool;
  owner: null;
  runs: TraitRun[];
}

/** What a walk of World Tools reads from a world. */
export interface WorldToolsSource {
  worldTools?: readonly Tool[];
}

/** Whether a box is a World Tool's. */
export const isWorldToolBox = (box: { home: { kind: string } }): box is WorldToolBox => box.home.kind === 'tool';

/** The world's Script Tools that hold code, in Tools-tab order. A Lookup or Template Tool holds none. */
export function worldToolBoxes(world: WorldToolsSource): WorldToolBox[] {
  return (world.worldTools ?? []).flatMap((tool): WorldToolBox[] => {
    const { handler } = tool;
    if (handler.kind !== 'script' || !hasCode(handler)) return [];
    const script: Script = { id: tool.id, name: tool.name, timing: SCRIPT_TIMING_OF_TOOL[toolTimingOf(tool)], code: handler.code };
    return [{ home: { kind: 'tool', toolId: tool.id }, ...script, script, tool, owner: null, runs: [] }];
  });
}

/** Whether `link` brings `trait`: the trait itself, or a group above it. */
const bringsTrait = (link: TraitLink, trait: Trait, traitGroups: TraitGroup[]): boolean =>
  trait.id === link.originalId || (trait.groupId != null && isDescendantGroup(traitGroups, link.originalId, trait.groupId));

/** The owners that run the Blueprint trait `traitId`'s scripts: each whose link brings it and leaves them alone. */
export function blueprintTraitRunners(owners: CodeOwners, world: TraitCodeWorld, traitId: string): EntityOwner[] {
  const original = world.traits.find((trait) => trait.id === traitId);
  if (!original) return [];
  const traitGroups = [...world.traitGroups];
  return owners.all.flatMap((owner) => {
    const { entity } = owner;
    const runs = entity?.traitLinks?.some((link) => bringsTrait(link, original, traitGroups)
      && !linkTraitState(original, link).overridden.includes('scripts'));
    return entity && runs ? [{ ...owner, entity }] : [];
  });
}

/**
 * Every filled trait script in the world once: the world's traits', each entity's own traits' and the scripts
 * its links override. A link that leaves a Blueprint trait's scripts alone adds a run to that trait's box.
 * `pick` widens the walk, such as to blank scripts.
 */
export function traitCodeBoxes(owners: CodeOwners, world: TraitCodeWorld, pick: ScriptPick = filledScripts): TraitCodeBox[] {
  const lists = { traits: [...world.traits], traitGroups: [...world.traitGroups] };
  const blueprintIds = blueprintItemIds(lists);
  const blueprintOwner: CodeOwner = { entity: null, stats: [], byCodeName: new Map(), linkOf: NO_LINKS };
  const worldBoxes = world.traits.flatMap((trait) => {
    const blueprint = blueprintIds.has(trait.id);
    return pick(trait).map((script): TraitCodeBox => ({
      home: { kind: 'trait', traitId: trait.id }, ...script, script, trait, entity: null,
      owner: blueprint ? blueprintOwner : null, runs: blueprint ? [] : [{ owner: null }],
    }));
  });
  const runsOf = new Map(worldBoxes.map((box) => [box.id, box.runs]));
  const entityBoxes = owners.all.flatMap((codeOwner) => {
    const { entity } = codeOwner;
    if (!entity) return [];
    const run: TraitRun = { owner: codeOwner };
    const own = (entity.traits ?? []).flatMap((trait) => pick(trait).map((script): TraitCodeBox => ({
      home: { kind: 'entityTrait', entityId: entity.id, traitId: trait.id }, ...script, script, trait, entity, owner: run.owner, runs: [run],
    })));
    const linked = (entity.traitLinks ?? []).flatMap((link) => world.traits
      .filter((trait) => bringsTrait(link, trait, lists.traitGroups))
      .flatMap((original) => {
        if (!linkTraitState(original, link).overridden.includes('scripts')) {
          for (const script of pick(original)) runsOf.get(script.id)?.push(run);
          return [];
        }
        const trait = effectiveLinkTrait(original, link);
        return pick(trait).map((script): TraitCodeBox => ({
          home: { kind: 'traitLink', entityId: entity.id, linkId: link.id, traitId: original.id },
          ...script, script, trait, entity, owner: run.owner, runs: [run],
        }));
      }));
    return [...own, ...linked];
  });
  return [...worldBoxes, ...entityBoxes];
}

/** Whether a link overrides the scripts of the stat it brings. */
export const overridesScripts = (link: StatLink, original: Stat) =>
  statLinkState(original, link).overridden.includes('scripts');

/**
 * Every filled box in the world once, in this order: the global stats', each Blueprint stat's, then each
 * entity's own stats' and the boxes its links override, in the entity's tree order. `pick` widens the walk.
 */
export function statCodeBoxes(owners: CodeOwners, pick: ScriptPick = filledCodeBoxes): StatCodeBox[] {
  const { statWorld } = owners;
  const blueprintIds = statBlueprintIds(statWorld);
  const worldBoxes = owners.world.stats.flatMap((stat) => pick(stat).map((box): StatCodeBox => ({
    home: { kind: 'stat', statId: stat.id }, ...box, script: box, stat, entity: null, owner: null, runs: [{ self: stat, owner: null }],
  })));
  const blueprintBoxes = statWorld.stats.filter((stat) => blueprintIds.has(stat.id)).flatMap((stat) => {
    const group = blueprintGroupStats(statWorld, stat);
    const owner: CodeOwner = { entity: null, stats: group, byCodeName: owners.byCodeName(group), linkOf: NO_LINKS };
    return pick(stat).map((box): StatCodeBox => ({
      home: { kind: 'stat', statId: stat.id }, ...box, script: box, stat, entity: null, owner, runs: [],
    }));
  });
  const blueprintBox = new Map(blueprintBoxes.map((box) => [`${box.stat.id}:${box.id}`, box]));
  const entityBoxes = owners.all.flatMap((owner) => {
    const { entity } = owner;
    if (!entity) return [];
    return owner.stats.flatMap((stat) => pick(stat).flatMap((box): StatCodeBox[] => {
      const link = owner.linkOf.get(stat.id);
      const original = link && statWorld.stats.find((s) => s.id === stat.id);
      const run: CodeRun = { self: stat, owner };
      if (!link) {
        return [{ home: { kind: 'entity', entityId: entity.id, statId: stat.id }, ...box, script: box, stat, entity, owner, runs: [run] }];
      }
      if (original && overridesScripts(link, original)) {
        const home: CodeHome = { kind: 'link', entityId: entity.id, linkId: link.id, statId: stat.id };
        return [{ home, ...box, script: box, stat, entity, owner, runs: [run] }];
      }
      // Scripts the link leaves alone run the Blueprint's code for this owner.
      blueprintBox.get(`${stat.id}:${box.id}`)?.runs.push(run);
      return [];
    }));
  });
  return [...worldBoxes, ...blueprintBoxes, ...entityBoxes];
}

/** What a route reads in a box: its code, and what `owner` holds in each of its runs. */
export type ReferenceBox = Pick<StatCodeBox, 'code' | 'owner'> & { stat?: Stat; runs: readonly (TraitRun & { self?: Stat })[] };

/** One literal route to a stat in a box's code. */
export interface StatCodeReference<B extends ReferenceBox = StatCodeBox> {
  box: B;
  route: Exclude<StatRoute['root'], 'self'>;
  /** The entity an `entities` route names, by code name. */
  entity?: string;
  /** The stat's code name as the key spells it. */
  stat: string;
  /** Every stat the key reaches, across the box's runs and the editor's reading of it. */
  targets: StatTarget[];
  /** The key's own text in the box's code. */
  from: number;
  to: number;
  key: CodeRenameKey;
}

/** One chain that names a stat: its route, and the key that names the stat. */
export interface RouteKey {
  route: StatReferenceRoute;
  key: CodeRenameKey;
}

type StatReferenceRoute = StatRoute & { root: StatCodeReference['route']; stat: string };

/** The route each chain off a global spells, in text order. */
export function routesIn(code: string): RouteKey[] {
  const found: RouteKey[] = codeRenameChains(code, 'stats').map((chain) => ({ route: { root: 'stats', stat: chain[0].name }, key: chain[0] }));
  for (const root of ['owner', 'persona'] as const) {
    for (const chain of codeRenameChains(code, root)) {
      if (chain[0].name === 'stats' && chain[1]) found.push({ route: { root, stat: chain[1].name }, key: chain[1] });
    }
  }
  for (const chain of codeRenameChains(code, 'entities')) {
    if (chain[1]?.name === 'stats' && chain[2]) {
      found.push({ route: { root: 'entities', entity: chain[0].name, stat: chain[2].name }, key: chain[2] });
    }
  }
  return found.sort((a, b) => a.key.keyFrom - b.key.keyFrom);
}

/** Every route in one box that reaches a stat, in text order. */
export function boxReferences<B extends ReferenceBox>(owners: CodeOwners, box: B): StatCodeReference<B>[] {
  const runs = [{ self: box.stat, owner: box.owner }, ...box.runs];
  return routesIn(box.code).flatMap(({ route, key }) => {
    // One target per owner and stat, however many runs reach it.
    const seen = new Map<CodeOwner, Set<string>>();
    const targets: StatTarget[] = [];
    for (const target of runs.flatMap((run) => routeTargets(owners, run, route))) {
      const ids = seen.get(target.owner) ?? new Set<string>();
      seen.set(target.owner, ids);
      if (ids.has(target.stat.id)) continue;
      ids.add(target.stat.id);
      targets.push(target);
    }
    if (!targets.length) return [];
    const { root, entity, stat } = route;
    return [{ box, route: root, ...(entity !== undefined ? { entity } : {}), stat, targets, from: key.keyFrom, to: key.keyTo, key }];
  });
}

/** Every route to a stat in every box of the world. */
export function statCodeReferences(world: StatRouteWorld): StatCodeReference[] {
  const owners = statCodeOwners(world);
  return statCodeBoxes(owners).flatMap((box) => boxReferences(owners, box));
}

/** Where a stat's name is authored. A null entity is the world. */
export interface StatNameHome {
  entityId: string | null;
  statId: string;
}

/** Where a reached stat's name is authored: on its entity for one of the entity's own stats, else in the
 *  world, since a linked copy reads its Blueprint's name. */
export const nameHomeOf = ({ owner, stat }: StatTarget): StatNameHome => ({
  entityId: owner.entity && !owner.linkOf.has(stat.id) ? owner.entity.id : null,
  statId: stat.id,
});
