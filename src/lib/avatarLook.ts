// The one resolver behind every Avatar's look in play: the customization, the winning trait pins over it, then
// each bound stat on top, in the model's own slider names, plus a color plan per channel. Pure, so every Avatar agrees.

import type { BodyTraitOn, ColorChannel, ColorPin, MorphPin, Stat, Trait } from "@/types";
import { bindingBy, normalizeStat, resolveMorphAlias } from "./bodyMorphs";
import type { ColorStep } from "./oklab";

export const COLOR_CHANNELS: readonly ColorChannel[] = ["skin", "eye", "hair"];

/** One active trait that may hold the Avatar's sliders and colors. */
export interface LookTrait extends BodyTraitOn {
  morphPins?: readonly MorphPin[];
  colorPins?: readonly ColorPin[];
}

/** The trait fields the look reads. */
type LookTraitFields = Pick<Trait, "id" | "morphPins" | "colorPins">;

/** The active traits of one Avatar and the order they switched on in. */
export interface LookTraits {
  /** The switch-on order play keeps (`BodyRuntime.traitsOn`), oldest first. */
  on: readonly BodyTraitOn[];
  /** The active traits, in tree order. One missing from `on` counts as switched on after every listed one. */
  active: readonly LookTrait[];
}

/** The traits in force, as `traitForceScope` splits them, global ones in tree order. */
export interface LookTraitScope {
  global: readonly LookTraitFields[];
  owners: Readonly<Record<string, readonly LookTraitFields[]>>;
  played: readonly string[];
}

/** Each Avatar's traits: the played Persona's from the global traits and the played entities' own (Q24), and
 *  every other entity's from its own. */
export function avatarLookTraits(scope: LookTraitScope, on: readonly BodyTraitOn[]): {
  player: LookTraits;
  owners: Record<string, LookTraits>;
} {
  const of = (ownerId: string | null) => (t: LookTraitFields): LookTrait =>
    ({ ownerId, traitId: t.id, ...(t.morphPins && { morphPins: t.morphPins }), ...(t.colorPins && { colorPins: t.colorPins }) });
  const player = [
    ...scope.global.map(of(null)),
    ...scope.played.flatMap((id) => (scope.owners[id] ?? []).map(of(id))),
  ];
  const owners = Object.fromEntries(Object.entries(scope.owners)
    .filter(([id]) => !scope.played.includes(id))
    .map(([id, traits]) => [id, { on, active: traits.map(of(id)) }]));
  return { player: { on, active: player }, owners };
}

/** The stats and traits that drive one Avatar. */
export interface LookStats {
  /** The live stat copies. */
  stats: readonly Pick<Stat, "id" | "type" | "min" | "max" | "value" | "enabled" | "morphBindings" | "colorBindings">[];
  /** The authored twins, whose max anchors each stat's scale, in tree order, which orders color blends. A stat
   *  with no twin uses its own max and blends after those with one. */
  authored: readonly Pick<Stat, "id" | "max">[];
  /** Stat id → whether it is on, trait toggles included. A stat absent here reads its own `enabled`. */
  enabled?: Readonly<Record<string, boolean>>;
  /** Absent ⇒ no trait holds a slider. */
  traits?: LookTraits;
}

export interface AvatarLookInput extends LookStats {
  /** The player's slider values, by slider name. */
  customization?: Readonly<Record<string, number>>;
  /** Every slider key the model carries. Null while unknown: names then pass through as given. */
  catalog: readonly string[] | null;
  /** The player's colors, `#rrggbb` by channel. */
  colors?: Readonly<Partial<Record<ColorChannel, string>>>;
  /** The color channels the model carries. Absent or null while unknown: every channel then applies. */
  channels?: readonly ColorChannel[] | null;
}

/** One channel's color: null keeps the model's own colors. Otherwise each material starts from `set`, or its
 *  own color when `set` is absent, and blends through `steps` in order. */
export type ColorPlan = { set?: string; steps: ColorStep[] } | null;

export interface AvatarLook {
  /** The final slider values, keyed by the model's own names. */
  morphs: Record<string, number>;
  /** Model key → the trait whose pin holds it. */
  holders: Record<string, BodyTraitOn>;
  colors: Record<ColorChannel, ColorPlan>;
  /** Channel → the trait whose pin sets it. */
  colorHolders: Partial<Record<ColorChannel, BodyTraitOn>>;
}

/** Whether two switch-on entries name one owner's one trait. */
export const sameTraitOn = (a: BodyTraitOn, b: BodyTraitOn): boolean => a.ownerId === b.ownerId && a.traitId === b.traitId;

/** The active traits, oldest switch-on first: those in `on` by its order, then the rest in tree order (Q4). */
export function lookTraitsInOrder({ on, active }: LookTraits): LookTrait[] {
  const rank = (t: LookTrait) => {
    const at = on.findIndex((o) => sameTraitOn(o, t));
    return at < 0 ? on.length : at;
  };
  return active.map((trait, index) => ({ trait, index, rank: rank(trait) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ trait }) => trait);
}

/** A stat's share of its range, anchored to the authored max: unbounded above, capped at 1 for percentages. */
function statShare(stat: LookStats["stats"][number], refMax: number): number {
  const t = normalizeStat(stat.value ?? 0, stat.min, stat.max, refMax);
  return stat.type === "percentage" ? Math.min(1, t) : t;
}

/**
 * Resolve an Avatar's sliders: start from the customization, replace each slider an active trait pins with the
 * latest-on trait's value, then add each on stat's `t × by` per bound slider, summed across stats. Names resolve
 * to the model's own through aliases first; a key the model lacks is skipped. A stat bound to two alias-mates of
 * one key counts once, with the first binding's Change By.
 *
 * Each color channel starts from the player's pick, replaced by the latest-on trait pin, then takes one blend
 * step per on stat bound to it, in authored order, its share clamped to [0, 1]. A channel the model lacks has
 * no plan.
 */
export function resolveAvatarLook(input: AvatarLookInput): AvatarLook {
  const { customization, catalog, stats, authored, enabled, traits, colors: picked, channels } = input;
  const keys = catalog ? new Set(catalog) : null;
  const keyOf = (name: string): string | null => (keys ? resolveMorphAlias(name, (candidate) => keys.has(candidate)) : name);

  const morphs: Record<string, number> = {};
  for (const [name, value] of Object.entries(customization ?? {})) {
    const key = keyOf(name);
    if (key !== null) morphs[key] = value;
  }

  const hasChannel = (channel: ColorChannel) => !channels || channels.includes(channel);
  const set: Partial<Record<ColorChannel, string>> = {};
  for (const channel of COLOR_CHANNELS) {
    const color = picked?.[channel];
    if (color && hasChannel(channel)) set[channel] = color;
  }

  const holders: Record<string, BodyTraitOn> = {};
  const colorHolders: Partial<Record<ColorChannel, BodyTraitOn>> = {};
  for (const trait of traits ? lookTraitsInOrder(traits) : []) {
    const holder = { ownerId: trait.ownerId, traitId: trait.traitId };
    for (const pin of trait.morphPins ?? []) {
      const key = keyOf(pin.name);
      if (key === null) continue;
      morphs[key] = pin.value;
      holders[key] = holder;
    }
    for (const pin of trait.colorPins ?? []) {
      if (!hasChannel(pin.channel)) continue;
      set[pin.channel] = pin.color;
      colorHolders[pin.channel] = holder;
    }
  }

  const refMax = new Map(authored.map((s) => [s.id, s.max]));
  const isOn = (stat: LookStats["stats"][number]) =>
    typeof stat.value === "number" && (enabled?.[stat.id] ?? stat.enabled !== false);
  for (const stat of stats) {
    if (!stat.morphBindings?.length || !isOn(stat)) continue;
    const t = statShare(stat, refMax.get(stat.id) ?? stat.max);
    const counted = new Set<string>();
    for (const binding of stat.morphBindings) {
      const key = keyOf(binding.name);
      if (key === null || counted.has(key)) continue;
      counted.add(key);
      morphs[key] = (morphs[key] ?? 0) + t * bindingBy(binding);
    }
  }

  const steps: Record<ColorChannel, ColorStep[]> = { skin: [], eye: [], hair: [] };
  const rank = new Map(authored.map((s, i) => [s.id, i]));
  const blending = stats.filter((s) => s.colorBindings?.length && isOn(s))
    .map((stat, index) => ({ stat, index, rank: rank.get(stat.id) ?? authored.length }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index);
  for (const { stat } of blending) {
    const t = Math.min(1, statShare(stat, refMax.get(stat.id) ?? stat.max));
    const counted = new Set<ColorChannel>();
    for (const binding of stat.colorBindings!) {
      if (counted.has(binding.channel) || !hasChannel(binding.channel)) continue;
      counted.add(binding.channel);
      steps[binding.channel].push({ target: binding.color, t });
    }
  }
  const plan = (channel: ColorChannel): ColorPlan => {
    const start = set[channel];
    if (start === undefined && !steps[channel].length) return null;
    return { ...(start !== undefined && { set: start }), steps: steps[channel] };
  };
  return { morphs, holders, colors: { skin: plan("skin"), eye: plan("eye"), hair: plan("hair") }, colorHolders };
}
