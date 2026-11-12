// Pure helpers behind stat-bound Avatar sliders: the normalized stat value, alias names, the picker groups and
// the binding migration. `avatarLook` composes them into the final morph map.

import type { MorphBinding, Stat } from "@/types";

/** The legacy v1.2 body stat → morph mapping the runtime used to hardcode (Stomach drives the Belly
 *  morph, Fatness the Fat morph, Breastsize the Breasts morph). Used by the import migration. */
export const LEGACY_BODY_BINDINGS: Record<string, string[]> = {
  Stomach: ["Belly"],
  Fatness: ["Fat"],
  Breastsize: ["Breasts"],
};

/** Interchangeable shape-key names across avatar generations: the bundled alternate model uses the
 *  first name in each group, older models and worlds use the rest. Resolution is bidirectional. */
export const MORPH_ALIAS_GROUPS: readonly (readonly string[])[] = [
  ["Waist", "Abdomen", "Belly"],
  ["Thickness", "Weight", "Fat"],
  ["Bust", "Chest", "Breasts"],
];

/**
 * Resolve a bound morph name against the names a model actually exposes: the exact name when present,
 * otherwise the first alias-mate that is. Null when neither exists.
 */
export function resolveMorphAlias(name: string, has: (candidate: string) => boolean): string | null {
  if (has(name)) return name;
  const group = MORPH_ALIAS_GROUPS.find((g) => g.includes(name));
  return group?.find((candidate) => candidate !== name && has(candidate)) ?? null;
}

/**
 * Map a stat value to a morph influence, linearly across the stat's range. `refMax` is the scale
 * anchor — the authored max, so a max raised during play extends the morph past 1 instead of
 * rescaling every point down. Only the floor is clamped; the caller caps the top if it wants one.
 */
export function normalizeStat(value: number, min: number, max: number, refMax: number = max): number {
  if (refMax === min) return 0;
  const t = (value - min) / (refMax - min);
  return Math.max(0, t);
}

/** The Change By a binding with no `by` has. */
export const DEFAULT_CHANGE_BY = 1;

/** A binding's Change By: its `by`, or the default when absent. */
export const bindingBy = (binding: MorphBinding): number => binding.by ?? DEFAULT_CHANGE_BY;

/** One model's contribution to the slider picker: its display name and the sliders it exposes. */
export interface MorphSource {
  /** The model's name; each group heading starts with it. */
  heading: string;
  /** Every body slider the model exposes. */
  morphs: readonly string[];
  /** Every head-feature slider; absent on a model with no head catalog. */
  head?: readonly string[];
}

/** A model's options as the MultiSelect's grouped-options shape. */
export interface MorphOptionGroup {
  heading: string;
  options: { label: string; value: string }[];
}

/** The grouped slider options: per model, a "Body Sliders" group then a "Head Features" group, names de-duplicated
 *  within each, empty groups dropped. A binding names its slider, so a name shared by several models binds on each. */
export function buildMorphGroups(sources: readonly MorphSource[]): MorphOptionGroup[] {
  const groups: MorphOptionGroup[] = [];
  const add = (heading: string, names: readonly string[]) => {
    const seen = new Set<string>();
    const options: { label: string; value: string }[] = [];
    for (const name of names) {
      if (seen.has(name)) continue;
      seen.add(name);
      options.push({ label: name, value: name });
    }
    if (options.length) groups.push({ heading, options });
  };
  for (const source of sources) {
    add(`${source.heading} · Body Sliders`, source.morphs);
    add(`${source.heading} · Head Features`, source.head ?? []);
  }
  return groups;
}

/** Auto-bind legacy body stats on import: a Stomach/Fatness/Breastsize stat that has no `morphBindings`
 *  yet gets the standard mapping. Idempotent (skips any stat that already carries the field) and
 *  immutable (returns new objects for changed stats only). */
export function autoBindLegacyBodyStats(stats: readonly Stat[]): Stat[] {
  return stats.map((stat) => {
    const binding = LEGACY_BODY_BINDINGS[stat.name];
    if (!binding || stat.morphBindings !== undefined) return stat;
    return { ...stat, morphBindings: binding.map((name) => ({ name })) };
  });
}

/** A raw `morphBindings` list with each bare name as `{ name }`. The same list when no entry is a string. */
export function migrateMorphBindingList(list: unknown): unknown {
  if (!Array.isArray(list) || !list.some((entry) => typeof entry === "string")) return list;
  return list.map((entry) => (typeof entry === "string" ? { name: entry } : entry));
}

/** A raw stat with its `morphBindings` as objects. The same stat when there is nothing to change. */
export function migrateStatMorphBindings<T>(stat: T): T {
  if (!stat || typeof stat !== "object" || !("morphBindings" in stat)) return stat;
  const list = (stat as { morphBindings?: unknown }).morphBindings;
  const next = migrateMorphBindingList(list);
  return next === list ? stat : { ...stat, morphBindings: next };
}

/** A raw stat list with every stat's bindings as objects. The same list when none changed. */
export function migrateStatListMorphBindings<T>(stats: T): T {
  if (!Array.isArray(stats)) return stats;
  const next = stats.map(migrateStatMorphBindings);
  return (next.some((stat, i) => stat !== stats[i]) ? next : stats) as T;
}
