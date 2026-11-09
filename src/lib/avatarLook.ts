// The one resolver behind every Avatar's look in play: the customization, then each bound stat's Change By on
// top, in the model's own slider names. Pure, so the player's Avatar and entity Avatars agree.

import type { Stat } from "@/types";
import { bindingBy, normalizeStat, resolveMorphAlias } from "./bodyMorphs";

/** The stats that drive one Avatar. */
export interface LookStats {
  /** The live stat copies. */
  stats: readonly Pick<Stat, "id" | "type" | "min" | "max" | "value" | "enabled" | "morphBindings">[];
  /** The authored twins, whose max anchors each stat's scale. A stat with no twin uses its own max. */
  authored: readonly Pick<Stat, "id" | "max">[];
  /** Stat id → whether it is on, trait toggles included. A stat absent here reads its own `enabled`. */
  enabled?: Readonly<Record<string, boolean>>;
}

export interface AvatarLookInput extends LookStats {
  /** The player's slider values, by slider name. */
  customization?: Readonly<Record<string, number>>;
  /** Every slider key the model carries. Null while unknown: names then pass through as given. */
  catalog: readonly string[] | null;
}

export interface AvatarLook {
  /** The final slider values, keyed by the model's own names. */
  morphs: Record<string, number>;
}

/** A stat's share of its range, anchored to the authored max: unbounded above, capped at 1 for percentages. */
function statShare(stat: LookStats["stats"][number], refMax: number): number {
  const t = normalizeStat(stat.value ?? 0, stat.min, stat.max, refMax);
  return stat.type === "percentage" ? Math.min(1, t) : t;
}

/**
 * Resolve an Avatar's sliders: start from the customization, then add each on stat's `t × by` per bound slider,
 * summed across stats. Names resolve to the model's own through aliases first; a key the model lacks is skipped.
 * A stat bound to two alias-mates of one key counts once, with the first binding's Change By.
 */
export function resolveAvatarLook(input: AvatarLookInput): AvatarLook {
  const { customization, catalog, stats, authored, enabled } = input;
  const keys = catalog ? new Set(catalog) : null;
  const keyOf = (name: string): string | null => (keys ? resolveMorphAlias(name, (candidate) => keys.has(candidate)) : name);

  const morphs: Record<string, number> = {};
  for (const [name, value] of Object.entries(customization ?? {})) {
    const key = keyOf(name);
    if (key !== null) morphs[key] = value;
  }

  const refMax = new Map(authored.map((s) => [s.id, s.max]));
  for (const stat of stats) {
    if (!stat.morphBindings?.length || typeof stat.value !== "number") continue;
    if (!(enabled?.[stat.id] ?? stat.enabled !== false)) continue;
    const t = statShare(stat, refMax.get(stat.id) ?? stat.max);
    const counted = new Set<string>();
    for (const binding of stat.morphBindings) {
      const key = keyOf(binding.name);
      if (key === null || counted.has(key)) continue;
      counted.add(key);
      morphs[key] = (morphs[key] ?? 0) + t * bindingBy(binding);
    }
  }
  return { morphs };
}
