/**
 * The three script box context builders, one per surface that edits a Script: the stat panel's, the trait tab's
 * and the Scripts tab entry's. Each is pure over what its surface reads, so the parity tests run them side by side.
 */

import { boxOwnerOf, codeBoxOwnerOf } from '@/lib/codeBoxOwner';
import { traitBoxSelf, type CodeBox, type CodeWorldLookup } from '@/lib/codeWorldLookup';
import type { UnitOwner } from '@/lib/sandboxSnapshot';
import { statCodeName, statCodeNamed } from '@/lib/statCodeNames';
import { blueprintGroupStats, resolvedEntityStats, type StatLinkWorld } from '@/lib/statLinks';
import { isBlueprintItem } from '@/lib/traitTree';
import type { ScriptWorldNames } from '@/lib/useScriptWorldNames';
import type { ScriptEntry } from '@/lib/worldScripts';
import type { Entity, ScriptTiming, Stat, Trait, TraitGroup } from '@/types';
import type { ScriptBoxContext, ScriptBoxOwner, ScriptSelf } from './ScriptBox';

/** A box's `self` and the context it completes against and runs under. */
export interface BuiltBoxContext {
  self: ScriptSelf;
  context: ScriptBoxContext;
}

/** Each box's card lookup over the authored world, as `statBoxLookups` builds it. */
export type BoxLookups = (box: CodeBox) => CodeWorldLookup;

const namesOf = (stats: readonly Stat[]) => stats.map((stat) => stat.name).filter((name): name is string => !!name);

/** What the stat panel's boxes read. */
export interface StatPanelBoxInput {
  /** The stat as the panel was opened on it: a link's row carries the link id. */
  stat: Stat;
  /** The panel's draft of the stat. */
  editingStat: Partial<Stat>;
  /** The entity the stat sits on. Absent for a world stat. */
  store?: { stats: readonly Stat[]; ownerId: string };
  /** Absent in the library, which has no world. */
  world?: (StatLinkWorld & { playStats: readonly Stat[] }) | null;
  lookups?: BoxLookups | null;
  shared: ScriptWorldNames;
}

/** The stat panel's box context: an entity's own stat runs under that entity, a Blueprint stat under each owner, a world stat under none. */
export function statPanelBoxContext({ stat, editingStat, store, world, lookups, shared }: StatPanelBoxInput): BuiltBoxContext {
  const { names, placeholderPlaces, world: foldWorld } = shared;
  const placeholders = names.placeholders.list;
  const selfName = statCodeName(editingStat.name, placeholders);
  const isBlueprint = !store && !!world && !world.playStats.some((s) => s.id === stat.id);
  const owner: ScriptBoxOwner | null = store ? { kind: 'entity', entityId: store.ownerId } : isBlueprint ? { kind: 'blueprint' } : null;
  // `owner.stats` is the entity's own, or a Blueprint group's.
  const ownerStats = store ? statCodeNamed(store.stats, placeholders)
    : isBlueprint && world ? statCodeNamed(blueprintGroupStats(world, stat), placeholders)
      : [];
  const lookupSelf: Stat = { ...stat, ...editingStat, id: stat.id, name: selfName };
  const lookup = lookups ? (timing: ScriptTiming) => lookups({ owner, timing, self: lookupSelf }) : undefined;
  return {
    self: { kind: 'stat', stat: { ...editingStat, id: stat.id } },
    context: { selfName, owner, names, world: foldWorld, ownerStats, ownerStatNames: namesOf(ownerStats), placeholderPlaces, lookup },
  };
}

/** What a trait's Scripts tab reads. */
export interface TraitTabBoxInput {
  trait: Trait;
  /** The entity that owns or links the trait. Absent for a global or Blueprint trait. */
  owner?: Entity;
  /** Absent in the library, which has no world. */
  world?: (StatLinkWorld & { traitGroups: readonly TraitGroup[] }) | null;
  lookups?: BoxLookups | null;
  shared: ScriptWorldNames;
}

/** The trait tab's box context: an owner's trait runs under that owner, a Blueprint trait under each owner, a global trait under none. */
export function traitTabBoxContext({ trait, owner, world, lookups, shared }: TraitTabBoxInput): BuiltBoxContext {
  const { names, placeholderPlaces, world: foldWorld } = shared;
  const placeholders = names.placeholders.list;
  const selfName = statCodeName(trait.name, placeholders);
  const blueprint = !owner && isBlueprintItem({ traits: [...names.traits], traitGroups: world?.traitGroups ?? [] }, trait.id);
  const boxOwner: ScriptBoxOwner | null = owner ? { kind: 'entity', entityId: owner.id } : blueprint ? { kind: 'blueprint' } : null;
  const ownerStats = owner ? statCodeNamed(resolvedEntityStats({ stats: world?.stats ?? [], statGroups: world?.statGroups ?? [] }, owner), placeholders) : [];
  // A Blueprint trait's owners vary, so its `owner.stats` names go unchecked.
  const ownerStatNames = owner ? namesOf(ownerStats) : undefined;
  const lookupSelf = traitBoxSelf(trait.id, selfName);
  const lookup = lookups ? (timing: ScriptTiming) => lookups({ owner: boxOwner, timing, self: lookupSelf }) : undefined;
  return {
    self: { kind: 'trait', id: trait.id },
    context: {
      selfName, owner: boxOwner, names, world: foldWorld, ownerStats, ...(ownerStatNames && { ownerStatNames }), placeholderPlaces, lookup,
    },
  };
}

/** What a Scripts tab row reads. */
export interface ScriptEntryBoxInput {
  entry: ScriptEntry;
  statWorld: StatLinkWorld;
  lookups: BoxLookups;
  shared: ScriptWorldNames;
}

/** A Scripts tab row's box context, read from the stored world. A world script runs with neither owner nor `self`. */
export function scriptEntryBoxContext({ entry, statWorld, lookups, shared }: ScriptEntryBoxInput): BuiltBoxContext {
  const { names, placeholderPlaces, world: foldWorld } = shared;
  const placeholders = names.placeholders.list;
  const { box, entity } = entry;
  const trait = box && 'trait' in box ? box.trait : undefined;
  const stat = box && 'stat' in box ? box.stat : undefined;
  const selfName = statCodeName(trait?.name ?? stat?.name ?? '', placeholders);
  const derived: UnitOwner = box ? boxOwnerOf(box, placeholders) : { kind: 'none' };
  const owner: ScriptBoxOwner | null = codeBoxOwnerOf(derived);
  const ownerStats = entity && derived.kind === 'entity' ? statCodeNamed(resolvedEntityStats(statWorld, entity), placeholders)
    : derived.kind === 'blueprintStat' ? [...derived.stats]
      : [];
  // A Blueprint trait's owners vary, so its `owner.stats` names go unchecked.
  const ownerStatNames = derived.kind === 'blueprintTrait' ? undefined : namesOf(ownerStats);
  const lookupSelf: Stat = stat ? { ...stat, name: selfName } : traitBoxSelf(trait?.id ?? '', selfName);
  const self: ScriptSelf = trait ? { kind: 'trait', id: trait.id } : stat ? { kind: 'stat', stat } : { kind: 'world' };
  return {
    self,
    context: {
      selfName, owner, names, world: foldWorld, ownerStats, ...(ownerStatNames && { ownerStatNames }), placeholderPlaces,
      lookup: (timing: ScriptTiming) => lookups({ owner, timing, self: lookupSelf }),
    },
  };
}
