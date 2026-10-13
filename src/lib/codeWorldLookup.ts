/**
 * What one stat code box can ask the world when a card opens. Bound to the box, so `self` and `owner` name
 * that box's stat and owner. Every record holds what code reads at run time: a Link's Overrides, then its
 * Blueprint.
 */

import type { Stat } from '@/types';
import { blueprintGroupStats } from './statLinks';
import type { StatOwner } from './statCodeResolver';
import { overridesBox, type CodeOwner, type CodeOwners } from './statCodeTargets';
import type { StatCodeTiming } from './statCodeTiming';

/** A stat as a card shows it. */
export interface CodeStatRecord {
  /** Null where the route reaches several unrelated stats, so only their owners show (Q34). */
  stat: Stat | null;
  /** The Owner row: the entity's name, World, Blueprint, or every playable entity that has the stat. */
  owner: string;
  /** The entity that holds the stat. Absent for a world or Blueprint stat. */
  entityId?: string;
  /** Who runs the box's code: set for a Blueprint box's own stats. */
  bearers?: readonly string[];
}

/** What `owner` holds in the box. */
export type CodeOwnerRecord =
  | { kind: 'empty' }
  | { kind: 'entity'; entityId: string; name: string; stats: readonly string[] }
  | { kind: 'blueprint'; bearers: readonly string[] };

export interface CodeWorldLookup {
  /** The stat the box belongs to. */
  self(): CodeStatRecord & { stat: Stat };
  owner(): CodeOwnerRecord;
  /** The stat `key` names on `owner`'s map, or null where the map has no such stat. */
  stat(owner: StatOwner, key: string): CodeStatRecord | null;
}

/** Whose code a box holds: an entity's own stat or Link, or a Blueprint stat. */
export type CodeBoxOwner = { kind: 'entity'; entityId: string } | { kind: 'blueprint' };

export interface CodeBox {
  /** Null for a world stat. */
  owner: CodeBoxOwner | null;
  timing: StatCodeTiming;
  /** The box's stat under its code name, as the editor holds it now. */
  self: Stat;
}

const WORLD = 'World';
const BLUEPRINT = 'Blueprint';
const UNNAMED = 'Unnamed entity';

/** A lookup that builds on its first question, so a box no card opens on never resolves the world. */
export function lazyLookup(make: () => CodeWorldLookup): CodeWorldLookup {
  let made: CodeWorldLookup | undefined;
  const at = () => (made ??= make());
  return { self: () => at().self(), owner: () => at().owner(), stat: (owner, key) => at().stat(owner, key) };
}

/** A lookup over `owners`, bound to `box`. */
export function statBoxLookup(owners: CodeOwners, box: CodeBox): CodeWorldLookup {
  const entityName = (owner: CodeOwner | null) => (owner?.entity && owners.codeName(owner.entity.name)) || UNNAMED;
  const boxEntityId = box.owner?.kind === 'entity' ? box.owner.entityId : null;
  const entityOwner = boxEntityId === null ? null : owners.all.find((owner) => owner.entity?.id === boxEntityId) ?? null;
  const boxOwnerName = entityName(entityOwner);

  // A bearer runs a Blueprint box unless its Link overrides that box.
  let bearers: readonly string[] | undefined;
  const bearersOf = (): readonly string[] => (bearers ??= (() => {
    const original = owners.statWorld.stats.find((stat) => stat.id === box.self.id);
    if (!original) return [];
    return owners.all.flatMap((owner) => {
      const link = owner.linkOf.get(original.id);
      return owner.entity && link && !overridesBox(link, original, box.timing) ? [entityName(owner)] : [];
    });
  })());

  let groupMap: ReadonlyMap<string, Stat> | undefined;
  const blueprintGroup = () => (groupMap ??= owners.byCodeName(blueprintGroupStats(owners.statWorld, box.self)));

  const onEntity = (owner: CodeOwner, key: string): CodeStatRecord | null => {
    const stat = owner.byCodeName.get(key);
    return stat && owner.entity ? { stat, owner: entityName(owner), entityId: owner.entity.id } : null;
  };

  return {
    self() {
      if (!box.owner) return { stat: box.self, owner: WORLD };
      if (box.owner.kind === 'blueprint') return { stat: box.self, owner: BLUEPRINT, bearers: bearersOf() };
      return { stat: box.self, owner: boxOwnerName, entityId: box.owner.entityId };
    },
    owner() {
      if (!box.owner) return { kind: 'empty' };
      if (box.owner.kind === 'blueprint') return { kind: 'blueprint', bearers: bearersOf() };
      return {
        kind: 'entity',
        entityId: box.owner.entityId,
        name: boxOwnerName,
        stats: entityOwner ? [...entityOwner.byCodeName.keys()] : [],
      };
    },
    stat(owner, key) {
      switch (owner.route) {
        case 'world': {
          const stat = owners.world.byCodeName.get(key);
          return stat ? { stat, owner: WORLD } : null;
        }
        case 'owner': {
          if (!box.owner) return null;
          if (box.owner.kind === 'blueprint') {
            const stat = blueprintGroup().get(key);
            return stat ? { stat, owner: BLUEPRINT, bearers: bearersOf() } : null;
          }
          return entityOwner && onEntity(entityOwner, key);
        }
        case 'entity': {
          const target = owners.byName.get(owner.entity);
          return target ? onEntity(target, key) : null;
        }
        case 'persona': {
          // Values show only where every holder links one Blueprint stat, which then supplies them (Q34).
          const holders = owners.playable.flatMap((target) => {
            const stat = target.byCodeName.get(key);
            return stat ? [{ owner: target, stat }] : [];
          });
          if (!holders.length) return null;
          const owner = holders.map((holder) => entityName(holder.owner)).join(', ');
          // A linked stat keeps its Blueprint's id, which no own stat shares.
          const id = holders[0].stat.id;
          const shared = holders.every((holder) => holder.stat.id === id);
          return { stat: shared ? owners.statWorld.stats.find((stat) => stat.id === id) ?? null : null, owner };
        }
      }
    },
  };
}
