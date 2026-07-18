// Pure helpers behind stat-bound VRM body sliders. A stat's live value (clamped to [min,max]) maps
// linearly to a morph influence in [0,1]; several stats compose into one morph map that VRMViewer applies.
// Kept free of React/three so the (off-by-one- and clamp-prone) math is unit-testable.

import type { Stat } from "@/types";

/** The legacy v1.2 body stat → morph mapping the runtime used to hardcode (Stomach drives the Belly
 *  morph, Fatness the Fat morph, Breastsize the Breasts morph). Used by the import migration. */
export const LEGACY_BODY_BINDINGS: Record<string, string[]> = {
  Stomach: ["Belly"],
  Fatness: ["Fat"],
  Breastsize: ["Breasts"],
};

/** Map a stat value to a morph influence in [0,1], linearly across the stat's range. */
export function normalizeStat(value: number, min: number, max: number): number {
  if (max === min) return 0;
  const t = (value - min) / (max - min);
  return Math.min(1, Math.max(0, t));
}

/** Build the morph influences driven by stats: every number stat with bindings contributes its
 *  normalized value to each morph name it's bound to. Stats without bindings are ignored. */
export function statMorphMap(stats: readonly Stat[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const stat of stats) {
    if (!stat.morphBindings?.length || typeof stat.value !== "number") continue;
    const influence = normalizeStat(stat.value, stat.min, stat.max);
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
