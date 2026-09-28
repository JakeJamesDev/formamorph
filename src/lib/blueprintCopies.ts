// Automatic placeholder copies: one reconcile over the world that gives every bearer the copies its traits
// need and takes back the ones nothing uses. It runs after every editor write and at load, so no trigger is
// wired by hand: a trait added, linked or moved onto a bearer, a chip or pin joining an original that has
// bearers, an entity marked Persona or Custom Persona, all land here. The same pass traces an owned trait's
// blueprint chips and pins to the owner's copies, which is what Detach and a drag into an entity rewrite.

import type { Entity, Placeholder, PlaceholderGroup, PlaceholderPin, Trait, TraitGroup } from '@/types';
import { canBePlayer, resolveBearers, type Bearer } from './bearers';
import { copyOf, effectiveCopy } from './blueprints';
import { entityTexts } from './entityTexts';
import { blueprintIds } from './placeholderBlueprints';
import { directChipTargets, remapPlaceholderIds } from './placeholders';
import { offeredWorldTraits } from './traitTree';
import { randomUUID } from './uuid';

/** What the reconcile reads: the trait lists, the entities, and the world's own placeholder list with its folders. */
export interface CopyWorld {
  traits: readonly Trait[];
  traitGroups: readonly TraitGroup[];
  entities: readonly Entity[];
  placeholders: readonly Placeholder[];
  placeholderGroups: readonly PlaceholderGroup[];
}

/** A copy the author has not edited: no value overrides and no values of its own. Only these are removed. */
export const isUntouchedCopy = (p: Placeholder): boolean => !!p.blueprintId && !p.values.length && !p.valueOverrides;

const traitTexts = (t: Trait | TraitGroup): string[] => [t.name, t.playerDescription, t.aiDescription].filter((s): s is string => !!s);

/** The placeholder ids a trait's text and pins name. A group has text only. */
function traitTargets(item: Trait | TraitGroup): Set<string> {
  const ids = directChipTargets(traitTexts(item));
  for (const pin of ('placeholderPins' in item ? item.placeholderPins : undefined) ?? []) ids.add(pin.placeholderId);
  return ids;
}

/** The placeholder ids a placeholder's values name, through their chips and their value pins. */
function valueTargets(p: Placeholder): Set<string> {
  const ids = directChipTargets(p.values.map((v) => v.text));
  for (const v of p.values) for (const pin of v.pins ?? []) ids.add(pin.placeholderId);
  return ids;
}

/** Copy id → its blueprint id, across every entity, so a chip at another owner's copy still names a blueprint. */
function copyBlueprints(entities: readonly Entity[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const e of entities) for (const p of e.placeholders ?? []) if (p.blueprintId) out.set(p.id, p.blueprintId);
  return out;
}

/**
 * Entity id → the blueprints it needs a copy of. A bearer needs every blueprint a trait on it pins or
 * places, its links expanded, and the root traits' when it can be the player; then every blueprint those
 * placeholders reach through their values, read as the bearer's own copy where it has one. A chip in the
 * owner's own text, or a pin on its own trait, that names one of its copies keeps that copy needed. Entities
 * that need nothing have no entry.
 */
export function neededCopies(world: CopyWorld): Map<string, Set<string>> {
  const blueprints = blueprintIds({ placeholders: [...world.placeholders], placeholderGroups: [...world.placeholderGroups] });
  const out = new Map<string, Set<string>>();
  if (!blueprints.size) return out;
  const byId = new Map(world.placeholders.map((p) => [p.id, p]));
  const copyBlueprint = copyBlueprints(world.entities);
  const bearers = new Map(resolveBearers(world, undefined).bearers.map((b) => [b.id, b]));
  const root = offeredWorldTraits(world.traits, world.traitGroups);

  for (const e of world.entities) {
    const own = new Set((e.placeholders ?? []).filter((p) => p.blueprintId).map((p) => p.id));
    // A named id counts as its blueprint's, whether it is the blueprint or a copy of it anywhere.
    const asBlueprint = (id: string): string | undefined => (blueprints.has(id) ? id : copyBlueprint.get(id));
    const needed = new Set<string>();
    const bearer: Bearer | undefined = bearers.get(e.id);
    const items: (Trait | TraitGroup)[] = [
      ...(bearer ? [...bearer.traits, ...bearer.groups] : []),
      ...(canBePlayer(e) ? [...root.traits, ...root.groups] : []),
    ];
    for (const item of items) for (const id of traitTargets(item)) { const b = asBlueprint(id); if (b) needed.add(b); }
    // The owner's own text and its placeholders' values keep a copy of its own in use.
    const ownTexts = [...entityTexts(e), ...(e.placeholders ?? []).flatMap((p) => p.values.map((v) => v.text))].filter((s): s is string => !!s);
    for (const id of directChipTargets(ownTexts)) if (own.has(id)) needed.add(copyBlueprint.get(id)!);
    // What each needed placeholder reaches through its values, as this bearer reads it.
    const queue = [...needed];
    while (queue.length) {
      const id = queue.pop()!;
      const blueprint = byId.get(id);
      if (!blueprint) continue;
      const mine = copyOf(e, id);
      const read = mine ? effectiveCopy(mine, blueprint) : blueprint;
      for (const target of valueTargets(read)) {
        const b = asBlueprint(target);
        if (b && !needed.has(b)) { needed.add(b); queue.push(b); }
      }
    }
    if (needed.size) out.set(e.id, needed);
  }
  return out;
}

/** The pins with each target in `idMap` moved; the same list when none is. */
function remapPins(pins: PlaceholderPin[] | undefined, idMap: Record<string, string>): PlaceholderPin[] | undefined {
  if (!pins?.some((p) => idMap[p.placeholderId])) return pins;
  return pins.map((p) => (idMap[p.placeholderId] ? { ...p, placeholderId: idMap[p.placeholderId] } : p));
}

/** The item with its text chips and pins traced through `idMap`; the same object when nothing moved. */
function remapItem<T extends Trait | TraitGroup>(item: T, idMap: Record<string, string>): T {
  let out = item;
  for (const field of ['name', 'playerDescription', 'aiDescription'] as const) {
    const text = item[field];
    if (!text) continue;
    const next = remapPlaceholderIds(text, idMap);
    if (next !== text) out = { ...out, [field]: next };
  }
  if ('placeholderPins' in item) {
    const pins = remapPins(item.placeholderPins, idMap);
    if (pins !== item.placeholderPins) out = { ...out, placeholderPins: pins };
  }
  return out;
}

/**
 * The entities with their copies reconciled: each needed copy present, named after its blueprint with no
 * values of its own; each untouched copy nothing needs removed, an edited one kept; and every owned trait's
 * blueprint chips and pins, or ones at another owner's copy, traced to the owner's copy. The same array when
 * nothing changes, and each untouched entity the same object.
 */
export function syncBlueprintCopies(world: CopyWorld, newId: () => string = randomUUID): Entity[] {
  const needed = neededCopies(world);
  const byId = new Map(world.placeholders.map((p) => [p.id, p]));
  const copyBlueprint = copyBlueprints(world.entities);
  let changed = false;
  const entities = world.entities.map((e): Entity => {
    const needs = needed.get(e.id) ?? new Set<string>();
    const before = e.placeholders ?? [];
    const kept = before.filter((p) => !p.blueprintId || needs.has(p.blueprintId) || !isUntouchedCopy(p));
    const have = new Set(kept.map((p) => p.blueprintId).filter((id): id is string => !!id));
    const added = [...needs].flatMap((id): Placeholder[] => {
      const blueprint = byId.get(id);
      return blueprint && !have.has(id) ? [{ id: newId(), name: blueprint.name, values: [], blueprintId: id }] : [];
    });
    const placeholders = kept.length === before.length && !added.length ? before : [...kept, ...added];

    // An owned trait names its owner's copy, never the blueprint or another owner's copy of it.
    const ownCopy = new Map(placeholders.filter((p) => p.blueprintId).map((p) => [p.blueprintId!, p.id]));
    const idMap: Record<string, string> = {};
    for (const [blueprintId, copyId] of ownCopy) idMap[blueprintId] = copyId;
    for (const [copyId, blueprintId] of copyBlueprint) {
      const mine = ownCopy.get(blueprintId);
      if (mine && mine !== copyId) idMap[copyId] = mine;
    }
    const traits = (e.traits ?? []).map((t) => remapItem(t, idMap));
    const groups = (e.traitGroups ?? []).map((g) => remapItem(g, idMap));
    const sameTraits = traits.every((t, i) => t === e.traits![i]);
    const sameGroups = groups.every((g, i) => g === e.traitGroups![i]);
    if (placeholders === before && sameTraits && sameGroups) return e;
    changed = true;
    const { placeholders: _p, ...rest } = e;
    return {
      ...rest,
      ...(placeholders.length ? { placeholders } : {}),
      ...(sameTraits ? {} : { traits }),
      ...(sameGroups ? {} : { traitGroups: groups }),
    };
  });
  return changed ? entities : world.entities as Entity[];
}
