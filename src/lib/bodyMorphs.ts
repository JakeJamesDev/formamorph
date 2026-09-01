// Pure helpers behind stat-bound VRM body sliders. A stat's live value maps linearly to a morph
// influence, scaled against its authored max; several stats compose into one map VRMViewer applies.
// Kept free of React/three so the (off-by-one- and clamp-prone) math is unit-testable.

import type { Stat } from "@/types";

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

/**
 * Build the morph influences driven by stats: every number stat with bindings contributes its
 * normalized value to each morph name it's bound to. Stats without bindings are ignored.
 * `authored` supplies each stat's authored max as the scale anchor; a stat missing from it falls
 * back to its own live max. Percentage stats stay capped at 1 — 100 is their definitional ceiling.
 */
export function statMorphMap(
  stats: readonly Stat[],
  authored: readonly Stat[] = [],
): Record<string, number> {
  const refMax = new Map(authored.map((s) => [s.id, s.max]));
  const map: Record<string, number> = {};
  for (const stat of stats) {
    if (!stat.morphBindings?.length || typeof stat.value !== "number") continue;
    let influence = normalizeStat(stat.value, stat.min, stat.max, refMax.get(stat.id) ?? stat.max);
    if (stat.type === "percentage") influence = Math.min(1, influence);
    for (const name of stat.morphBindings) map[name] = influence;
  }
  return map;
}

/** Compose base (customization-chosen) morphs with stat-driven morphs, summing overlapping keys —
 *  matching the historical `base + percent`. Sums may exceed 1; three.js clamps influences itself. */
export function mergeBodyMorphs(
  base: Record<string, number>,
  stat: Record<string, number>,
): Record<string, number> {
  const merged: Record<string, number> = { ...base };
  for (const [name, value] of Object.entries(stat)) {
    merged[name] = (merged[name] ?? 0) + value;
  }
  return merged;
}

/** Morph names already bound by stats *other than* `statId` — the set to hide from this stat's slider
 *  picker so a given slider is owned by only one stat. */
export function boundMorphNamesExcluding(stats: readonly Stat[], statId: string): Set<string> {
  const set = new Set<string>();
  for (const stat of stats) {
    if (stat.id === statId) continue;
    for (const name of stat.morphBindings ?? []) set.add(name);
  }
  return set;
}

/** One model's contribution to the body-slider picker: its display name and the morphs it exposes. */
export interface MorphSource {
  /** Group heading — the model's name. */
  heading: string;
  /** Every body morph the model exposes. */
  morphs: readonly string[];
}

/** A model's options as the MultiSelect's grouped-options shape. */
export interface MorphOptionGroup {
  heading: string;
  options: { label: string; value: string }[];
}

/**
 * Build the grouped body-slider options: one group per model, each carrying its morph names minus those
 * already owned by another stat, and de-duplicated within the model. A morph shared by several models
 * appears under each — selecting it anywhere binds the name everywhere, since a binding is the bare name.
 * Empty groups (all names taken or none exposed) are dropped.
 */
export function buildMorphGroups(
  sources: readonly MorphSource[],
  taken: ReadonlySet<string>,
): MorphOptionGroup[] {
  const groups: MorphOptionGroup[] = [];
  for (const source of sources) {
    const seen = new Set<string>();
    const options: { label: string; value: string }[] = [];
    for (const name of source.morphs) {
      if (taken.has(name) || seen.has(name)) continue;
      seen.add(name);
      options.push({ label: name, value: name });
    }
    if (options.length) groups.push({ heading: source.heading, options });
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
    return { ...stat, morphBindings: [...binding] };
  });
}
