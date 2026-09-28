// Blueprint placeholders off-world: an entity carries the blueprints its copies read, and a receiving world
// binds each copy to a blueprint of its own or turns it into a plain placeholder.

import type { CopyValueOverrides, Entity, Placeholder, PlaceholderPin, PlaceholderValue } from '@/types';
import { effectiveCopy } from './blueprints';
import { dropBlueprintChips } from './blueprintChips';
import { mapEntityChips, mapOwnedTraitRefs } from './placeholderHomes';
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

/** A value's text as two worlds compare it: each chip read by its target through `idMap`, its placement dropped. */
const comparable = (text: string, idMap: Record<string, string>): string =>
  text.replace(TOKEN_RE, (token) => {
    const id = decodePlaceholderToken(token)?.id;
    return id ? `{{${idMap[id] ?? id}}}` : token;
  }).trim();

/** Carried value id → the target value carrying the same text, or null when none or two do. */
function valueIdMap(carried: Placeholder | undefined, target: Placeholder, idMap: Record<string, string>): (id: string) => string | null {
  return (id) => {
    const value = carried?.values.find((v) => v.id === id);
    if (!value) return target.values.some((v) => v.id === id) ? id : null;
    const text = comparable(value.text, idMap);
    const same = target.values.filter((v) => comparable(v.text, {}) === text);
    return same.length === 1 ? same[0].id : null;
  };
}

/** The map without the keys `key` sends to null, each other key renamed; absent when nothing is left. */
function rekey<V>(map: Record<string, V> | undefined, key: (id: string) => string | null): Record<string, V> | undefined {
  const out = Object.fromEntries(Object.entries(map ?? {}).flatMap(([id, v]) => {
    const next = key(id);
    return next === null ? [] : [[next, v] as const];
  }));
  return Object.keys(out).length ? out : undefined;
}

/**
 * The entity bound to a world holding `blueprints`, and how many chips it lost. Each copy binds to its
 * blueprint by id, else to the one world blueprint carrying its name, its value overrides and the pins at it
 * following the value with the same text. A copy with no match becomes a plain placeholder holding the
 * values it read, and every chip and pin at its blueprint moves to it, a chip in those values at another
 * blueprint moving to the entity's copy of that one, as Detach does. A chip or pin at an unmatched blueprint
 * the entity holds no copy of goes. The carried blueprints go too. The same entity when it carries nothing.
 */
export function bindCarriedBlueprints(entity: Entity, blueprints: readonly Placeholder[]): { entity: Entity; dropped: number } {
  const { blueprints: carried = [], ...rest } = entity;
  const owned = rest.placeholders ?? [];
  const copyOf = new Map(owned.flatMap((p) => (p.blueprintId ? [[p.blueprintId, p] as const] : [])));
  if (!copyOf.size && !carried.length) return { entity, dropped: 0 };
  const carriedById = new Map(carried.map((b) => [b.id, b]));
  const worldIds = new Set(blueprints.map((b) => b.id));

  // Carried blueprint id → what stands in for it here: a world blueprint bound by name, or the plain copy.
  const idMap: Record<string, string> = {};
  const valueMaps = new Map<string, (id: string) => string | null>();
  const unbound = new Set<string>();
  const gone = new Set<string>();
  for (const id of new Set([...carriedById.keys(), ...copyOf.keys()])) {
    if (worldIds.has(id)) continue;
    const match = uniqueNamed(blueprints, carriedById.get(id)?.name ?? copyOf.get(id)!.name);
    if (match) {
      idMap[id] = match.id;
      continue;
    }
    const copy = copyOf.get(id);
    if (copy) {
      unbound.add(id);
      idMap[id] = copy.id;
    } else gone.add(id);
  }
  if (!Object.keys(idMap).length && !gone.size) return { entity: carried.length ? rest : entity, dropped: 0 };
  // A value's chips read by what they bind to, so they compare after every blueprint has bound.
  const byName = Object.entries(idMap).filter(([id]) => !unbound.has(id));
  const boundTo = Object.fromEntries(byName);
  for (const [id, to] of byName) valueMaps.set(id, valueIdMap(carriedById.get(id), blueprints.find((b) => b.id === to)!, boundTo));

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
  const valueMapAt = (id: string): ((valueId: string) => string | null) | undefined => {
    const copy = copyById.get(id);
    const valueMap = valueMaps.get(copy?.blueprintId ?? id);
    return valueMap && copy ? (valueId) => (copy.values.some((v) => v.id === valueId) ? valueId : valueMap(valueId)) : valueMap;
  };

  let dropped = 0;
  const via =(map: Record<string, string>) => {
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
        return valueId ? [{ ...p, placeholderId: to, valueId }] : [];
      });
    };
    const values = (list: PlaceholderValue[]) => list.map((v) => ({ ...v, text: text(v.text), ...(v.pins ? { pins: pins(v.pins) } : {}) }));
    return { text, pins, values };
  };
  const live = via(idMap);
  const detached = via(detachMap);

  const placeholders = owned.map((p): Placeholder => {
    const blueprintId = p.blueprintId;
    if (!blueprintId) return { ...p, values: detached.values(p.values) };
    if (unbound.has(blueprintId)) {
      const blueprint = carriedById.get(blueprintId) ?? { id: blueprintId, name: p.name, values: [] };
      const { blueprintId: _b, valueOverrides: _o, ...plain } = effectiveCopy(p, blueprint);
      return { ...plain, values: detached.values(plain.values) };
    }
    const valueOverrides = rekey(p.valueOverrides, valueMaps.get(blueprintId) ?? ((id) => id));
    const { valueOverrides: _o, ...copy } = p;
    return {
      ...copy,
      ...(idMap[blueprintId] ? { blueprintId: idMap[blueprintId] } : {}),
      values: live.values(p.values),
      ...(valueOverrides ? { valueOverrides: overrideTexts(valueOverrides, live.text) } : {}),
    };
  });

  const fields = mapEntityChips(rest, live.text);
  return { entity: mapOwnedTraitRefs({ ...fields, placeholders }, live.text, live.pins), dropped };
}

/** Each text override with `text` over its value and its snapshot. */
const overrideTexts = (overrides: Record<string, CopyValueOverrides>, text: (t: string) => string): Record<string, CopyValueOverrides> =>
  Object.fromEntries(Object.entries(overrides).map(([id, o]) =>
    [id, o.text ? { ...o, text: { value: text(o.text.value), blueprint: text(o.text.blueprint) } } : o]));

/** A library entity as a world holds it: its owned traits and links bound as {@link bindOwnedTraits} binds
 *  them, and its copies bound to the world's blueprints. */
export const bindLibraryEntity = (entity: Entity, world: TraitWorld & { blueprints: readonly Placeholder[] }): Entity =>
  bindCarriedBlueprints(bindOwnedTraits(entity, world), world.blueprints).entity;
