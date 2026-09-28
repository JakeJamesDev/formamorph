// Blueprint placeholders off-world: an entity carries the blueprints its copies read, and a receiving world
// binds each copy to a blueprint of its own or turns it into a plain placeholder.

import type { CopyValueOverrides, Entity, Placeholder, PlaceholderPin, PlaceholderValue } from '@/types';
import { effectiveCopy } from './blueprints';
import { dropBlueprintChips } from './blueprintChips';
import { mapEntityChips, mapOwnedTraitRefs, type PlaceholderHomesWorld } from './placeholderHomes';
import { worldBlueprints } from './placeholderBlueprints';
import { decodePlaceholderToken, PLACEHOLDER_TOKEN_SOURCE, remapPlaceholderIds } from './placeholders';
import { bindOwnedTraits, uniqueNamed, type TraitWorld } from './portableTraits';

/** The blueprints the entity's copies read: each from `pool`, else from what the entity already carries. */
export function carriedBlueprints(entity: Pick<Entity, 'placeholders' | 'blueprints'>, pool: readonly Placeholder[]): Placeholder[] {
  const wanted = new Set((entity.placeholders ?? []).flatMap((p) => (p.blueprintId ? [p.blueprintId] : [])));
  const out = new Map<string, Placeholder>();
  for (const p of [...pool, ...(entity.blueprints ?? [])]) if (wanted.has(p.id) && !out.has(p.id)) out.set(p.id, p);
  return [...out.values()];
}

const TOKEN_RE = new RegExp(PLACEHOLDER_TOKEN_SOURCE, 'g');

/** Carried value id → the id it takes here, or null when it has none. */
type ValueIdMap = (id: string) => string | null;

/** What a carried entity binds to: the world's blueprints, and its shared list for the names chips read. */
export interface BlueprintBindWorld {
  blueprints: readonly Placeholder[];
  placeholders: readonly Placeholder[];
}

/** A value's text as two worlds compare it: each chip read by its target's name, its placement dropped. */
const comparable = (text: string, names: ReadonlyMap<string, string>): string =>
  text.replace(TOKEN_RE, (token) => {
    const id = decodePlaceholderToken(token)?.id;
    return id ? `{{${names.get(id) ?? id}}}` : token;
  }).trim();

const namesOf = (lists: readonly (readonly Placeholder[])[]) => new Map(lists.flat().map((p) => [p.id, p.name]));

/** Carried value id → the target value whose text reads the same, or null when none or two do. */
function valueIdMap(
  carried: Placeholder | undefined, target: Placeholder, carriedNames: ReadonlyMap<string, string>, targetNames: ReadonlyMap<string, string>,
): ValueIdMap {
  return (id) => {
    const value = carried?.values.find((v) => v.id === id);
    if (!value) return target.values.some((v) => v.id === id) ? id : null;
    const text = comparable(value.text, carriedNames);
    const same = target.values.filter((v) => comparable(v.text, targetNames) === text);
    return same.length === 1 ? same[0].id : null;
  };
}

/** The map without the keys `key` sends to null, each other key renamed; absent when nothing is left. */
function rekey<V>(map: Record<string, V> | undefined, key: ValueIdMap): Record<string, V> | undefined {
  const out = Object.fromEntries(Object.entries(map ?? {}).flatMap(([id, v]) => {
    const next = key(id);
    return next === null ? [] : [[next, v] as const];
  }));
  return Object.keys(out).length ? out : undefined;
}

/**
 * The entity bound to `world`, and how many chips it lost. A copy binds by id, else by unique name, its
 * overrides and pins following the value that reads the same; else it becomes a plain placeholder of the
 * values it read, and the chips and pins at its blueprint move to it (Detach's rewrite). A chip or pin at
 * an unbound blueprint with no copy goes. The same entity when it carries nothing.
 */
export function bindCarriedBlueprints(entity: Entity, world: BlueprintBindWorld): { entity: Entity; dropped: number } {
  const { blueprints: carried = [], ...rest } = entity;
  const owned = rest.placeholders ?? [];
  const copyOf = new Map(owned.flatMap((p) => (p.blueprintId ? [[p.blueprintId, p] as const] : [])));
  if (!copyOf.size && !carried.length) return { entity, dropped: 0 };
  const carriedById = new Map(carried.map((b) => [b.id, b]));
  const worldIds = new Set(world.blueprints.map((b) => b.id));

  // Carried blueprint id → what stands in for it here: a world blueprint bound by name, or the plain copy.
  const idMap: Record<string, string> = {};
  const byName = new Map<string, Placeholder>();
  const unbound = new Set<string>();
  const gone = new Set<string>();
  for (const id of new Set([...carriedById.keys(), ...copyOf.keys()])) {
    if (worldIds.has(id)) continue;
    const match = uniqueNamed(world.blueprints, carriedById.get(id)?.name ?? copyOf.get(id)!.name);
    if (match) {
      idMap[id] = match.id;
      byName.set(id, match);
      continue;
    }
    const copy = copyOf.get(id);
    if (copy) {
      unbound.add(id);
      idMap[id] = copy.id;
    } else gone.add(id);
  }
  if (!Object.keys(idMap).length && !gone.size) return { entity: carried.length ? rest : entity, dropped: 0 };

  const carriedNames = namesOf([rest.sharedPlaceholders ?? [], carried, owned]);
  const targetNames = namesOf([world.placeholders, world.blueprints]);
  const valueMaps = new Map([...byName].map(([id, target]) => [id, valueIdMap(carriedById.get(id), target, carriedNames, targetNames)] as const));

  // A chip or pin in values that refuse blueprint chips lands on the entity's copy of any blueprint, as Detach does.
  const detachMap: Record<string, string> = { ...idMap };
  for (const [blueprintId, copy] of copyOf) {
    detachMap[blueprintId] = copy.id;
    if (idMap[blueprintId]) detachMap[idMap[blueprintId]] = copy.id;
  }
  // A chip path into a blueprint bound by name follows its values.
  const valuePaths: Record<string, string> = {};
  for (const [id, valueMap] of valueMaps) {
    for (const v of carriedById.get(id)?.values ?? []) {
      const next = valueMap(v.id);
      if (next) valuePaths[v.id] = next;
    }
  }

  // A pin names a blueprint's value by id at the blueprint itself or at a copy, whose own values keep theirs.
  const copyById = new Map([...copyOf.values()].map((copy) => [copy.id, copy]));
  const valueMapAt = (id: string): ValueIdMap | undefined => {
    const copy = copyById.get(id);
    const valueMap = valueMaps.get(copy?.blueprintId ?? id);
    return valueMap && copy ? (valueId) => (copy.values.some((v) => v.id === valueId) ? valueId : valueMap(valueId)) : valueMap;
  };

  let dropped = 0;
  /** Chip and pin rewrites through `map`: `idMap` where blueprint chips stay, `detachMap` where they refuse. */
  const rewritesThrough = (map: Record<string, string>) => {
    const chips = { ...map, ...valuePaths };
    const text = (t: string) => {
      const out = dropBlueprintChips(remapPlaceholderIds(t, chips), gone);
      dropped += out.dropped;
      return out.text;
    };
    const pins = (list: PlaceholderPin[]): PlaceholderPin[] => {
      if (!list.some((p) => map[p.placeholderId] || gone.has(p.placeholderId) || valueMapAt(p.placeholderId))) return list;
      return list.flatMap((p): PlaceholderPin[] => {
        if (gone.has(p.placeholderId)) return [];
        const to = map[p.placeholderId] ?? p.placeholderId;
        const valueMap = valueMapAt(p.placeholderId);
        if (!valueMap || !p.valueId) return [to === p.placeholderId ? p : { ...p, placeholderId: to }];
        const valueId = valueMap(p.valueId);
        if (!valueId) return [];
        // A pin at the blueprint reads its value's text here; one at a copy keeps the copy's wording.
        const target = byName.get(p.placeholderId)?.values.find((v) => v.id === valueId);
        return [{ ...p, placeholderId: to, valueId, ...(target ? { value: target.text } : {}) }];
      });
    };
    const values = (list: PlaceholderValue[]) => list.map((v) => ({ ...v, text: text(v.text), ...(v.pins ? { pins: pins(v.pins) } : {}) }));
    return { text, pins, values };
  };
  const toBound = rewritesThrough(idMap);
  const toCopies = rewritesThrough(detachMap);

  const placeholders = owned.map((p): Placeholder => {
    const blueprintId = p.blueprintId;
    if (!blueprintId) return { ...p, values: toCopies.values(p.values) };
    if (unbound.has(blueprintId)) {
      const blueprint = carriedById.get(blueprintId) ?? { id: blueprintId, name: p.name, values: [] };
      const { blueprintId: _b, valueOverrides: _o, ...plain } = effectiveCopy(p, blueprint);
      return { ...plain, values: toCopies.values(plain.values) };
    }
    const target = byName.get(blueprintId);
    const valueOverrides = rekey(p.valueOverrides, valueMaps.get(blueprintId) ?? ((id) => id));
    const { valueOverrides: _o, ...copy } = p;
    return {
      ...copy,
      ...(target ? { blueprintId: target.id } : {}),
      values: toBound.values(p.values),
      ...(valueOverrides ? { valueOverrides: overrideTexts(valueOverrides, toBound.text, target) } : {}),
    };
  });

  const fields = mapEntityChips(rest, toBound.text);
  return { entity: mapOwnedTraitRefs({ ...fields, placeholders }, toBound.text, toBound.pins), dropped };
}

/** Each text override with `text` over its value. Its snapshot is `target`'s value where the copy bound by
 *  name, whose text reads the same, else `text` over the one it holds. */
const overrideTexts = (
  overrides: Record<string, CopyValueOverrides>, text: (t: string) => string, target: Placeholder | undefined,
): Record<string, CopyValueOverrides> =>
  Object.fromEntries(Object.entries(overrides).map(([id, o]) => {
    if (!o.text) return [id, o];
    const blueprint = target?.values.find((v) => v.id === id)?.text ?? text(o.text.blueprint);
    return [id, { ...o, text: { value: text(o.text.value), blueprint } }];
  }));

/** A library entity as a world holds it: its owned traits and links bound as {@link bindOwnedTraits} binds
 *  them, and its copies bound to the world's blueprints. */
export const bindLibraryEntity = (entity: Entity, world: TraitWorld & BlueprintBindWorld): Entity =>
  bindCarriedBlueprints(bindOwnedTraits(entity, world), world).entity;

/** What a world's carried entities bind to, read from its shared list and its placeholder folders. */
export const blueprintBindWorld = (world: PlaceholderHomesWorld): BlueprintBindWorld =>
  ({ blueprints: worldBlueprints(world), placeholders: world.placeholders ?? [] });
