/**
 * Where a script box's Script lives, resolved against the world as the Sandbox Snapshot names homes. Every
 * surface that edits a Script names its home with a `ScriptHomeRef`; this decides `self` and the Owner from it.
 */

import type { Entity, Placeholder, Stat, Trait, TraitGroup } from '@/types';
import { statLinksBoundTo } from './portableStats';
import type { UnitHome, UnitOwner } from './sandboxSnapshot';
import { statCodeName, statCodeNamed } from './statCodeNames';
import { blueprintGroupStats, resolvedEntityStats, statBlueprintIds, type StatLinkWorld } from './statLinks';
import { isBlueprintItem } from './traitTree';
import type { ScriptHomeRef } from './worldScripts';

/** What a box's home is resolved against: the loaded world, or a library entity alone beside the lists its
 *  links read. */
export interface ScriptBoxWorld extends StatLinkWorld {
  traits: readonly Trait[];
  traitGroups: readonly TraitGroup[];
  entities: readonly Entity[];
}

/** The world a library entity's boxes read: the entity, its stat links bound to the lists they read, and those
 *  lists, if any. */
export function offWorldOf(
  entity: Entity, links?: { stats?: readonly Stat[]; statGroups?: StatLinkWorld['statGroups']; traits?: readonly Trait[]; traitGroups?: readonly TraitGroup[] } | null,
): ScriptBoxWorld {
  return {
    stats: links?.stats ?? [], statGroups: links?.statGroups ?? [], traits: links?.traits ?? [], traitGroups: links?.traitGroups ?? [],
    entities: [links ? statLinksBoundTo(entity, links) : entity],
  };
}

/** Where a stat panel's scripts live: a world stat's, an entity's own, or the stat a link brings, under its
 *  original id. */
export function statPanelHome(statId: string, ownerId?: string, link?: { linkId: string; originalId: string }): ScriptHomeRef {
  if (!ownerId) return { kind: 'stat', statId };
  return link ? { kind: 'link', entityId: ownerId, linkId: link.linkId, statId: link.originalId } : { kind: 'entity', entityId: ownerId, statId };
}

/** Where a trait panel's scripts live: a world trait's, an entity's own, or the trait a link brings. */
export function traitPanelHome(traitId: string, ownerId?: string, link?: { ownerId: string; linkId: string }): ScriptHomeRef {
  if (link) return { kind: 'traitLink', entityId: link.ownerId, linkId: link.linkId, traitId };
  return ownerId ? { kind: 'entityTrait', entityId: ownerId, traitId } : { kind: 'trait', traitId };
}

/** A home the world no longer holds still runs: the executor defaults every number it marshals. */
const bareStat = (id: string) => ({ id, name: '' }) as Stat;

/** The stats `entity` holds in play, links resolved. */
function entityStatsOf(world: ScriptBoxWorld, entityId: string): Stat[] {
  const entity = world.entities.find((e) => e.id === entityId);
  return entity ? resolvedEntityStats(world, entity) : [];
}

/** The home `ref` names in `world`, stats and traits under their code names. A linked stat is the resolved stat
 *  under the original id, as play runs it. */
export function scriptHomeOf(ref: ScriptHomeRef, world: ScriptBoxWorld, placeholders: readonly Placeholder[]): UnitHome {
  const codedStat = (stat: Stat | undefined, id: string): Stat => {
    const found = stat ?? bareStat(id);
    return { ...found, name: statCodeName(found.name, placeholders) };
  };
  const codedTrait = (found: Trait | undefined, id: string) => ({ id, name: statCodeName(found?.name, placeholders) });
  switch (ref.kind) {
    case 'world': return { kind: 'world' };
    case 'stat': {
      const stat = codedStat(world.stats.find((s) => s.id === ref.statId), ref.statId);
      if (!statBlueprintIds(world).has(ref.statId)) return { kind: 'globalStat', stat };
      return { kind: 'blueprintStat', stat, groupStats: statCodeNamed(blueprintGroupStats(world, stat), placeholders) };
    }
    case 'entity':
    case 'link':
      return { kind: 'entityStat', entityId: ref.entityId, stat: codedStat(entityStatsOf(world, ref.entityId).find((s) => s.id === ref.statId), ref.statId) };
    case 'trait': {
      const found = world.traits.find((t) => t.id === ref.traitId);
      const blueprint = isBlueprintItem({ traits: [...world.traits], traitGroups: [...world.traitGroups] }, ref.traitId);
      return blueprint ? { kind: 'blueprintTrait', trait: codedTrait(found, ref.traitId) } : { kind: 'trait', trait: codedTrait(found, ref.traitId), entityId: null };
    }
    case 'entityTrait': {
      const found = world.entities.find((e) => e.id === ref.entityId)?.traits?.find((t) => t.id === ref.traitId);
      return { kind: 'trait', trait: codedTrait(found, ref.traitId), entityId: ref.entityId };
    }
    case 'traitLink':
      return { kind: 'trait', trait: codedTrait(world.traits.find((t) => t.id === ref.traitId), ref.traitId), entityId: ref.entityId };
  }
}

/** What `owner.stats` keys under `owner`, under code names: the entity's stats, a Blueprint group's, or none. */
export function ownerStatsOf(owner: UnitOwner, world: ScriptBoxWorld, placeholders: readonly Placeholder[]): Stat[] {
  switch (owner.kind) {
    case 'entity': return statCodeNamed(entityStatsOf(world, owner.entityId), placeholders);
    case 'blueprintStat': return [...owner.stats];
    default: return [];
  }
}
