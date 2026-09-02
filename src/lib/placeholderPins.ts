// Placeholder pins: what holds a placeholder at a fixed value, from any of the four sources — a trait, the
// current location, a stat descriptor band, or a placeholder value. A pin masks the roll under it and never
// overwrites it, so every collector here is an overlay computed fresh from the current state.
//
// Precedence: descriptor > location > trait > value pin. Within traits the later one in the authored tree
// wins; within one location or one band the later row wins.

import type { GameLocation, Placeholder, PlaceholderPin, PlaceholderRolls, Stat, Trait } from '@/types';
import { encodePlaceholderToken, pinText, placeholderIsChoice } from './placeholders';
import { activeDescriptor } from './statContext';
import type { BandedStat } from './statDescriptorGeometry';
import { activeStatEnabled } from './traitEffects';

/** A stat as the descriptor source reads it: its bands and the value that picks one, plus the id and
 *  enabled flag that gate them. A live `PlayerStat` is one; so is an authored stat given its start value. */
export type PinnableStat = BandedStat & Pick<Stat, 'id' | 'enabled'> & { value: number };

/** A structural problem met while settling value pins. */
export interface PinFinding {
  /** Value pins that flip each other without settling; the ids are the placeholders caught in the loop. */
  kind: 'value-pin-cycle';
  placeholderIds: string[];
}

/** Everything a pin collection reads. Only `traits` and `placeholders` are always present. */
export interface PinSources {
  /** The chosen traits, in authored order. */
  traits: readonly Trait[];
  disabledTraitIds?: readonly string[];
  /** Where the player is; absent or null before a location is picked. */
  location?: Pick<GameLocation, 'placeholderPins'> | null;
  /** The stats with their current values; each one's band is what pins. */
  stats?: readonly PinnableStat[];
  placeholders: readonly Placeholder[];
  /** The playthrough's rolls: what a value-pinning placeholder reads as when nothing pins it. */
  rolls?: PlaceholderRolls;
  onFinding?: (finding: PinFinding) => void;
}

const indexPlaceholders = (placeholders: readonly Placeholder[]) => new Map(placeholders.map((p) => [p.id, p]));

/** Lay one source's pins over `out`, later rows winning. */
function layPins(
  out: Record<string, string>,
  pins: readonly PlaceholderPin[] | undefined,
  byId: ReadonlyMap<string, Placeholder>,
): void {
  for (const pin of pins ?? []) {
    const text = pinText(pin, byId);
    if (text) out[pin.placeholderId] = text;
  }
}

/**
 * Placeholder id → the value the active traits force it to, later traits winning. The trait-only
 * collector: what a trait's own card and the editor's conflict notes read.
 */
export function activePlaceholderPins(
  activeInOrder: readonly Trait[],
  placeholders: readonly Placeholder[] = [],
): Record<string, string> {
  const byId = indexPlaceholders(placeholders);
  const out: Record<string, string> = {};
  for (const t of activeInOrder) layPins(out, t.placeholderPins, byId);
  return out;
}

/**
 * Placeholder id → the value in force, from every source at once. Traits, then the location, then the
 * active descriptor of each live stat lay their pins in that order, later winning. Value pins then settle
 * underneath: each value-pinning placeholder reads its effective world value — the pin on it so far, else
 * its roll — and lays that value's pins wherever nothing above claimed the target. A pin can change which
 * value another placeholder reads as, so this repeats until a pass changes nothing.
 */
export function collectPins(src: PinSources): Record<string, string> {
  const { traits, disabledTraitIds = [], location, stats = [], placeholders, rolls, onFinding } = src;
  const byId = indexPlaceholders(placeholders);
  const off = new Set(disabledTraitIds);
  const active = traits.filter((t) => !off.has(t.id));

  const layered: Record<string, string> = {};
  for (const t of active) layPins(layered, t.placeholderPins, byId);
  layPins(layered, location?.placeholderPins, byId);
  const enabled = activeStatEnabled(stats, active);
  for (const stat of stats) {
    if (enabled[stat.id] === false) continue;
    layPins(layered, activeDescriptor(stat, stat.value)?.placeholderPins, byId);
  }
  return settleValuePins(layered, placeholders, byId, rolls, onFinding);
}

/** The value a placeholder holds at world scope under `pins`: the pin on it, else its roll, else its sole
 *  value — a Variable reads as that value with or without a roll. */
function effectiveValue(ph: Placeholder, pins: Record<string, string>, rolls?: PlaceholderRolls): string | undefined {
  const values = ph.values ?? [];
  return pins[ph.id] ?? rolls?.world?.[ph.id] ?? (values.length === 1 ? values[0].text : undefined);
}

/**
 * Value pins under the layered ones, to a fixed point: apply one placeholder's pins, re-read, move on. A
 * placeholder reads its effective value from the pins this pass has laid so far, else the last pass's, so
 * a value that pins another placeholder away from its roll has its say before that one is read — two
 * values excluding each other settle on the first listed, and the other, now pinned, pins nothing. Passes
 * repeat until one changes nothing. A pass ending on a state an earlier pass ended on is a cycle: values
 * flipping each other forever. The walk stops on the state it stood on and reports the placeholders that
 * would have flipped.
 */
function settleValuePins(
  layered: Record<string, string>,
  placeholders: readonly Placeholder[],
  byId: ReadonlyMap<string, Placeholder>,
  rolls: PlaceholderRolls | undefined,
  onFinding?: (finding: PinFinding) => void,
): Record<string, string> {
  const pinners = placeholders.filter((p) => (p.values ?? []).some((v) => v.pins?.length));
  if (!pinners.length) return layered;

  const seen: Record<string, string>[] = [layered];
  let prev = layered;
  for (;;) {
    const laid: Record<string, string> = {};
    for (const ph of pinners) {
      const values = ph.values ?? [];
      const pinsOn = { ...prev, ...laid, ...layered };
      // An Object holds every value at once, so each one's pins apply; a choice holds the one it reads as.
      const held = placeholderIsChoice(ph)
        ? values.filter((v) => v.text === effectiveValue(ph, pinsOn, rolls))
        : values;
      for (const v of held) layPins(laid, v.pins, byId);
    }
    const next = { ...laid, ...layered };
    if (samePins(next, prev)) return prev;
    if (seen.some((s) => samePins(s, next))) {
      onFinding?.({ kind: 'value-pin-cycle', placeholderIds: differingKeys(next, prev) });
      return prev;
    }
    seen.push(next);
    prev = next;
  }
}

function samePins(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
}

function differingKeys(a: Record<string, string>, b: Record<string, string>): string[] {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]).sort();
}

/** The world as the priming pass reads pins from: every trait, location and stat it has. */
export interface PinWorld {
  traits?: readonly Trait[];
  locations?: ReadonlyArray<Pick<GameLocation, 'placeholderPins'>>;
  stats?: ReadonlyArray<Pick<BandedStat, 'descriptors'>>;
  placeholders: readonly Placeholder[];
}

/** Placeholder id → every text some source pins it to, whichever sources end up active — what a priming
 *  pass walks beside the rolls, since a pin's chips are read the moment its source is on. */
export function allPinTexts(world: PinWorld): Record<string, string[]> {
  const byId = indexPlaceholders(world.placeholders);
  const out: Record<string, string[]> = {};
  const add = (pins?: readonly PlaceholderPin[]) => {
    for (const pin of pins ?? []) {
      const text = pinText(pin, byId);
      if (!text) continue;
      const texts = (out[pin.placeholderId] ??= []);
      if (!texts.includes(text)) texts.push(text);
    }
  };
  for (const trait of world.traits ?? []) add(trait.placeholderPins);
  for (const location of world.locations ?? []) add(location.placeholderPins);
  for (const stat of world.stats ?? []) for (const band of stat.descriptors ?? []) add(band.placeholderPins);
  for (const ph of world.placeholders) for (const value of ph.values ?? []) add(value.pins);
  return out;
}

/** A World chip for every placeholder whose values pin something, so priming rolls it even when no world
 *  text places it: its value pins read its world roll, which has to exist before they can fire. */
export function valuePinRollChips(placeholders: readonly Placeholder[]): string[] {
  return placeholders
    .filter((p) => (p.values ?? []).some((v) => v.pins?.length))
    .map((p) => encodePlaceholderToken({ id: p.id, mode: 'world', placementId: VALUE_PIN_PLACEMENT }));
}

/** The placement id on a priming chip. A World roll keys by placeholder id, so the id itself is never read. */
const VALUE_PIN_PLACEMENT = 'value-pins';

/** The pins for a trait's OWN text: its pins over the active ones. A pinning trait's card always reads its
 *  own value — "Sworn to Marrow" stays "Sworn to Marrow" whatever else is ticked — because the card
 *  advertises what picking the trait does, not what the current selection happens to have made true.
 *  Everything outside the card (stat bars, locations, narration) keeps the active pins. Returns `activePins`
 *  itself when the trait pins nothing, so pin-less traits keep resolver identity. */
export function traitScopedPins(
  trait: Trait,
  activePins: Record<string, string>,
  placeholders: readonly Placeholder[] = [],
): Record<string, string> {
  const own = activePlaceholderPins([trait], placeholders);
  return Object.keys(own).length ? { ...activePins, ...own } : activePins;
}

/**
 * A pin rewritten to hold `value`, naming that value by id when the placeholder carries one spelling it
 * exactly. Every surface that writes a pin's text goes through here, so a pin picked off the list follows a
 * rename and a value typed off the list stays the free text it is.
 */
export function withPinnedValue(
  pin: PlaceholderPin,
  value: string,
  placeholders: readonly Placeholder[],
): PlaceholderPin {
  const valueId = placeholders
    .find((p) => p.id === pin.placeholderId)?.values?.find((v) => v.text === value)?.id;
  const { valueId: _drop, ...rest } = pin;
  return { ...rest, value, ...(valueId ? { valueId } : {}) };
}
