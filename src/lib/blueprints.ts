// Blueprints: records that read a blueprint live until edited. One shape for every kind (a trait link, a
// placeholder copy, later a stat): a blueprint id and a sparse override map, each override keeping the
// blueprint's value it was made against. This module is the one reader of that map: it gives the effective
// record with its overridden and stale fields, and the copy lookup that traces a blueprint placeholder to
// the placeholder one bearer reads.

import type {
  BlueprintOverride, BlueprintOverrides, CopyValueFields, CopyValueOverrides, Entity, PersonaRef, Placeholder, PlaceholderValue, Trait,
  TraitLink, TraitLinkFields, TraitLinkOverrides,
} from '@/types';

/** A blueprint's record as one reader sees it, with the fields it overrides and the overrides the blueprint
 *  moved out from under. */
export interface EffectiveRecord<T> {
  record: T;
  overridden: (keyof T)[];
  /** Overridden fields whose blueprint value changed since the override was written. */
  stale: (keyof T)[];
}

/** Structural equality over the plain data a field holds: scalars, arrays, records. */
function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/** The blueprint's fields with `overrides` laid over them. Field order follows the blueprint's keys. */
export function effectiveRecord<T extends object>(blueprint: T, overrides: BlueprintOverrides<T> | undefined): EffectiveRecord<T> {
  const record = { ...blueprint };
  const overridden: (keyof T)[] = [];
  const stale: (keyof T)[] = [];
  for (const key of Object.keys(blueprint) as (keyof T)[]) {
    const override = overrides?.[key];
    if (!override) continue;
    record[key] = override.value;
    overridden.push(key);
    if (!sameValue(override.blueprint, blueprint[key])) stale.push(key);
  }
  return { record, overridden, stale };
}

/** `overrides` with `field` set to `value` against the blueprint's `blueprint`. */
export function withOverride<T, K extends keyof T>(
  overrides: BlueprintOverrides<T> | undefined, field: K, value: T[K], blueprint: T[K],
): BlueprintOverrides<T> {
  const override: BlueprintOverride<T[K]> = { value, blueprint };
  return { ...overrides, [field]: override } as BlueprintOverrides<T>;
}

/** `overrides` without `field`; undefined once nothing is left, so an untouched record stores no map. */
export function withoutOverride<T>(overrides: BlueprintOverrides<T> | undefined, field: keyof T): BlueprintOverrides<T> | undefined {
  if (!overrides || !(field in overrides)) return overrides;
  const { [field]: _drop, ...rest } = overrides;
  return Object.keys(rest).length ? (rest as BlueprintOverrides<T>) : undefined;
}

// ---- Trait links ----

/** The overridable fields as the original carries them, absent ones read as off or empty. */
export const linkFieldsOf = (trait: Trait): TraitLinkFields => ({
  isDefault: !!trait.isDefault,
  requires: trait.requires ?? [],
  placeholderPins: trait.placeholderPins ?? [],
  playerToggle: !!trait.playerToggle,
  statChanges: trait.statChanges,
  mode: trait.mode ?? 'optional',
});

/** The original's overridable fields as `link` reads them, with what it overrides and what went stale. */
export function linkTraitState(trait: Trait, link: TraitLink): EffectiveRecord<TraitLinkFields> {
  return effectiveRecord(linkFieldsOf(trait), link.overrides?.[trait.id]);
}

/** The original with the link's overrides on it. The trait itself when the link overrides nothing on it. */
export function effectiveLinkTrait(trait: Trait, link: TraitLink | undefined): Trait {
  const overrides = link?.overrides?.[trait.id];
  if (!overrides || !Object.keys(overrides).length) return trait;
  const { record, overridden } = effectiveRecord(linkFieldsOf(trait), overrides);
  const { mode: _m, ...fields } = record;
  const { mode: _t, ...base } = trait;
  const mode = overridden.includes('mode') ? record.mode : trait.mode;
  const others = overridden.filter((f) => f !== 'mode');
  return {
    ...base,
    ...Object.fromEntries(others.map((field) => [field, fields[field as keyof typeof fields]])),
    ...(mode && mode !== 'optional' ? { mode } : {}),
  };
}

/**
 * `holder` with the map under `prop` holding `next` at `key`: an empty `next` drops the key, and an emptied
 * map drops `prop`, so an untouched record stores no map.
 */
function withKeyed<T extends object, P extends keyof T, V extends object>(holder: T, prop: P, key: string, next: V | undefined): T {
  const { [key]: _old, ...others } = (holder[prop] ?? {}) as Record<string, V>;
  const map = next && Object.keys(next).length ? { ...others, [key]: next } : others;
  const { [prop]: _prev, ...rest } = holder;
  return (Object.keys(map).length ? { ...rest, [prop]: map } : rest) as T;
}

/** The link with its map for one trait replaced. */
const withTraitOverrides = (link: TraitLink, traitId: string, next: TraitLinkOverrides | undefined): TraitLink =>
  withKeyed(link, 'overrides', traitId, next);

/** The link overriding `field` on the original `trait`, the original's current value as the snapshot. */
export function setLinkOverride<K extends keyof TraitLinkFields>(link: TraitLink, trait: Trait, field: K, value: TraitLinkFields[K]): TraitLink {
  const next = withOverride(link.overrides?.[trait.id], field, value, linkFieldsOf(trait)[field]);
  return withTraitOverrides(link, trait.id, next);
}

/** The link reading `field` on `traitId` live again. The same link when it did not override it. */
export function resetLinkOverride(link: TraitLink, traitId: string, field: keyof TraitLinkFields): TraitLink {
  const current = link.overrides?.[traitId];
  if (!current?.[field]) return link;
  return withTraitOverrides(link, traitId, withoutOverride(current, field));
}

/** The link overriding each field where `edited` differs from what the link reads now; the same link when
 *  nothing differs. An editor writes the whole trait, so this keeps untouched fields live. */
export function setLinkEdits(link: TraitLink, trait: Trait, edited: Trait): TraitLink {
  const current = linkTraitState(trait, link).record;
  const next = linkFieldsOf(edited);
  let out = link;
  for (const field of Object.keys(next) as (keyof TraitLinkFields)[]) {
    if (!sameValue(next[field], current[field])) out = setLinkOverride(out, trait, field, next[field]);
  }
  return out;
}

/** The link reading one original trait live again: Reset to Blueprint on a linked group's child. */
export const resetLinkTraitOverrides = (link: TraitLink, traitId: string): TraitLink =>
  (link.overrides?.[traitId] ? withTraitOverrides(link, traitId, undefined) : link);

/** The link reading its original live everywhere: Reset to Blueprint. */
export function resetLinkOverrides(link: TraitLink): TraitLink {
  const { overrides: _drop, ...rest } = link;
  return rest;
}

// ---- Placeholder copies ----

export const isCopy = (placeholder: Placeholder): boolean => !!placeholder.blueprintId;

/** One blueprint value's overridable fields: its text and its draw weight, 1 when the blueprint sets none. */
const copyValueFields = (blueprint: Placeholder, value: PlaceholderValue): CopyValueFields =>
  ({ text: value.text, weight: blueprint.weights?.[value.id] ?? 1 });

/**
 * The copy as a reader sees it: the blueprint's values live under the blueprint's ids, each reworded or
 * reweighted where the copy overrides it, removed ones left out, and the copy's own values after them. The
 * id, and everything else the copy stores of its own, stay the copy's; the name is the blueprint's.
 */
export function effectiveCopy(copy: Placeholder, blueprint: Placeholder): Placeholder {
  const overrides = copy.valueOverrides ?? {};
  const weights: Record<string, number> = { ...blueprint.weights };
  const values = blueprint.values.flatMap((value): PlaceholderValue[] => {
    const own = overrides[value.id];
    if (own?.removed) {
      delete weights[value.id];
      return [];
    }
    const { record } = effectiveRecord(copyValueFields(blueprint, value), own);
    if (own?.weight) weights[value.id] = record.weight;
    return [own?.text ? { ...value, text: record.text } : value];
  });
  // The copy's own map weighs its own values only; a blueprint value's weight lives in its override.
  for (const value of copy.values) if (copy.weights?.[value.id] !== undefined) weights[value.id] = copy.weights[value.id];
  return {
    ...copy,
    name: blueprint.name,
    // The kind is the blueprint's: a copy rolls as its blueprint rolls.
    ...(blueprint.roll !== undefined ? { roll: blueprint.roll } : {}),
    values: [...values, ...copy.values],
    ...(Object.keys(weights).length ? { weights } : {}),
  };
}

type CopyValueField = keyof CopyValueOverrides;

/** What the copy changes on one blueprint value, and which of those changes the blueprint moved under. A
 *  removal is never stale: there is no value to compare. */
export function copyValueState(copy: Placeholder, blueprint: Placeholder, valueId: string): { overridden: CopyValueField[]; stale: CopyValueField[] } {
  const own = copy.valueOverrides?.[valueId];
  const value = blueprint.values.find((v) => v.id === valueId);
  if (!own || !value) return { overridden: [], stale: [] };
  const { removed: _r, ...fields } = own;
  const state = effectiveRecord(copyValueFields(blueprint, value), fields);
  return { overridden: [...state.overridden, ...(own.removed ? ['removed' as const] : [])], stale: state.stale };
}

/** The copy with its map for one value replaced. */
const withValueOverrides = (copy: Placeholder, valueId: string, next: CopyValueOverrides | undefined): Placeholder =>
  withKeyed(copy, 'valueOverrides', valueId, next);

function setCopyValueField<K extends keyof CopyValueFields>(
  copy: Placeholder, blueprint: Placeholder, valueId: string, field: K, value: CopyValueFields[K],
): Placeholder {
  const blueprintValue = blueprint.values.find((v) => v.id === valueId);
  if (!blueprintValue) return copy;
  const current = copy.valueOverrides?.[valueId];
  return withValueOverrides(copy, valueId, withOverride<CopyValueFields, K>(current, field, value, copyValueFields(blueprint, blueprintValue)[field]));
}

/** The copy rewording one blueprint value. The value keeps its id, so a pin naming it still finds it. */
export const setCopyValueText = (copy: Placeholder, blueprint: Placeholder, valueId: string, text: string): Placeholder =>
  setCopyValueField(copy, blueprint, valueId, 'text', text);

/** The copy reweighting one blueprint value; 0 benches it here without removing it. */
export const setCopyValueWeight = (copy: Placeholder, blueprint: Placeholder, valueId: string, weight: number): Placeholder =>
  setCopyValueField(copy, blueprint, valueId, 'weight', weight);

/** The copy without one blueprint value. */
export function removeCopyValue(copy: Placeholder, valueId: string): Placeholder {
  const current = copy.valueOverrides?.[valueId];
  return current?.removed ? copy : withValueOverrides(copy, valueId, { ...current, removed: true });
}

/** The copy reading one value's `field` live again, or the whole value when no field is named. */
export function resetCopyValue(copy: Placeholder, valueId: string, field?: CopyValueField): Placeholder {
  const current = copy.valueOverrides?.[valueId];
  if (!current) return copy;
  if (!field) return withValueOverrides(copy, valueId, undefined);
  if (!(field in current)) return copy;
  const { [field]: _drop, ...rest } = current;
  return withValueOverrides(copy, valueId, rest);
}

/** The copy reading its blueprint live everywhere: Reset to Blueprint. Own values stay. */
export function resetCopyOverrides(copy: Placeholder): Placeholder {
  const { valueOverrides: _drop, ...rest } = copy;
  return rest;
}

// ---- Copy lookup ----

/** What the copy lookup reads from a world. */
export interface BlueprintWorld {
  placeholders: readonly Placeholder[];
  entities: readonly Entity[];
}

/** The one entity marked Custom Persona, when the world has it. */
export const customPersonaEntity = (entities: readonly Entity[]): Entity | undefined => entities.find((e) => e.customPersona);

/** The copy `owner` holds of the blueprint. */
export const copyOf = (owner: Pick<Entity, 'placeholders'> | null | undefined, blueprintId: string): Placeholder | undefined =>
  owner?.placeholders?.find((p) => p.blueprintId === blueprintId);

/** Who reads a blueprint: the bearer's entity, null for the root player bearer, and whether the Custom
 *  Persona entity's copies fill in where the bearer has none. */
export interface CopyReader {
  entity: Pick<Entity, 'placeholders'> | null;
  viaCustomPersona: boolean;
}

/** The reader for a bearer: the Custom Persona's copies fill in for the player under None and under a
 *  library persona, never for a world persona or a cast entity. */
export const readerFor = (persona: PersonaRef | undefined, entity: Pick<Entity, 'placeholders'> | null, isPlayer: boolean): CopyReader =>
  ({ entity, viaCustomPersona: isPlayer && persona?.source !== 'world' });

/**
 * The placeholder `reader` reads for a blueprint id: its own copy, then the Custom Persona entity's when the
 * reader goes through it, then the blueprint itself. A copy comes back effective, with the blueprint's
 * values under it. Undefined when the world has no such blueprint.
 */
export function lookupCopy(world: BlueprintWorld, blueprintId: string, reader: CopyReader): Placeholder | undefined {
  const blueprint = world.placeholders.find((p) => p.id === blueprintId);
  if (!blueprint) return undefined;
  const copy = copyOf(reader.entity, blueprintId)
    ?? (reader.viaCustomPersona ? copyOf(customPersonaEntity(world.entities), blueprintId) : undefined);
  return copy ? effectiveCopy(copy, blueprint) : blueprint;
}

/** Blueprint id → the effective copy one bearer reads in its place; undefined where it reads the blueprint. */
export type CopyLookup = (blueprintId: string) => Placeholder | undefined;

/** {@link lookupCopy} for one reader, remembered per id, answering only where a copy stands in. */
export function copyLookup(world: BlueprintWorld, reader: CopyReader): CopyLookup {
  const found = new Map<string, Placeholder | undefined>();
  return (id) => {
    if (!found.has(id)) {
      const read = lookupCopy(world, id, reader);
      found.set(id, read && read.id !== id ? read : undefined);
    }
    return found.get(id);
  };
}

/** The list with each copy whose blueprint it holds read through that blueprint, so a chip aimed at a copy
 *  reads its effective values. The same list when it holds no copy. */
export function withEffectiveCopies(placeholders: readonly Placeholder[]): readonly Placeholder[] {
  if (!placeholders.some(isCopy)) return placeholders;
  const byId = new Map(placeholders.map((p) => [p.id, p]));
  return placeholders.map((p) => {
    const blueprint = p.blueprintId ? byId.get(p.blueprintId) : undefined;
    return blueprint ? effectiveCopy(p, blueprint) : p;
  });
}
