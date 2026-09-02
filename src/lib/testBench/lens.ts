/**
 * The Bench's lens — `Testing as [PC] · at [location]` — as data every instrument can read.
 *
 * The PC is a trait of an exclusive group, because that is the shape an author builds a playable character
 * out of: a group of mutually exclusive traits, one of which a playthrough picks. Selecting one here applies
 * exactly what selecting it in play applies — its placeholder pins and its stat toggles, through the game's
 * own `traitEffects` — so the Bench can never resolve a chip differently from a real turn.
 *
 * Pure and world-shaped: nothing here reads storage or React, and nothing writes the world.
 */
import { describePlaceholders } from '@/lib/placeholders';
import { labelPlaceholders, worldPlacementLetters } from '@/lib/placementLetters';
import {
  activePlaceholderPins, activeStatEnabled, exclusiveSiblings, inAuthoredOrder, traitOrderIndex,
} from '@/lib/traitEffects';
import type { GameLocation, Placeholder, Trait } from '@/types';
import type { RuleWorld } from './rules';

/** The slices of the authored world the lens reads. The rest of the document is optional and read only to
 *  letter the pickers' chips the way the editor letters them — entities come first in that walk. */
export type LensWorld =
  Pick<RuleWorld, 'traits' | 'traitGroups' | 'locations' | 'placeholders' | 'stats'>
  & Partial<Pick<RuleWorld, 'entities' | 'dictionaries' | 'worldOverview'>>;

/** What the author picked, as the two ids it comes down to. Both nullable: no PC is a real setting (the
 *  world as anyone would meet it), and a world with no locations has nowhere to stand. */
export interface LensState {
  pcTraitId: string | null;
  locationId: string | null;
}

export const EMPTY_LENS: LensState = { pcTraitId: null, locationId: null };

/** One choice in a selector, labeled as the editor's own lists label it. */
export interface LensOption {
  id: string;
  name: string;
  /** The exclusive group this PC belongs to — the heading its options sit under. Absent for locations. */
  groupName?: string;
}

/** A pin the world cannot honor: it names a placeholder that is gone, so nothing it says ever reaches the
 *  text. Surfaced rather than dropped silently — a pin that reads as working and isn't is the whole trap.
 *  A pin to a value the placeholder's list doesn't carry is not broken; forcing an off-list value is what
 *  the field is for, and play applies it verbatim. */
export interface BrokenPin {
  placeholderId: string;
  /** What play applies, verbatim. */
  value: string;
  /** The value as a sentence shows it — its own chips described, since a pin's text is chip-capable. */
  shown: string;
}

/** The lens resolved against a world: who and where, and everything that follows from the PC. */
export interface BenchLens {
  state: LensState;
  pc: Trait | null;
  location: GameLocation | null;
  /** Placeholder id → the value the PC forces, exactly as an active trait pins it in play. Broken pins are
   *  in here too when play would apply them, so what the Bench shows is what a turn would show. */
  pins: Record<string, string>;
  brokenPins: BrokenPin[];
  /** Stat id → whether it is live under this PC — the world's defaults with the PC's toggles over them. */
  statEnabled: Record<string, boolean>;
}

/**
 * The traits an author can test as: every member of an exclusive group, in authored order. A trait outside
 * one isn't a character — it is an option a character may also have — so it never appears here. Names
 * read as the editor's own trait list reads them: a chip by its placement label, never by a roll or a pin,
 * so the picker and the list agree on what a character is called.
 */
export function lensPcOptions(world: LensWorld): LensOption[] {
  const placeholders = world.placeholders ?? [];
  const exclusive = new Map(
    (world.traitGroups ?? []).filter((g) => g.exclusive).map((g) => [g.id, g.name]),
  );
  if (exclusive.size === 0) return [];
  const order = traitOrderIndex(world.traits ?? [], world.traitGroups ?? []);
  const members = (world.traits ?? []).filter((t) => t.groupId != null && exclusive.has(t.groupId));
  const letters = worldPlacementLetters(world);
  return inAuthoredOrder(members, order).map((t) => ({
    id: t.id,
    name: labelPlaceholders(t.name, placeholders, letters) || 'Untitled trait',
    groupName: labelPlaceholders(exclusive.get(t.groupId as string) ?? '', placeholders, letters) || 'Traits',
  }));
}

/** Everywhere the author can stand, in authored order, named as the editor's own list names it. */
export function lensLocationOptions(world: LensWorld): LensOption[] {
  const placeholders = world.placeholders ?? [];
  const letters = worldPlacementLetters(world);
  return (world.locations ?? []).map((l) => ({
    id: l.id,
    name: labelPlaceholders(l.name, placeholders, letters) || 'Untitled location',
  }));
}

/** Where a fresh lens points: the location the author already has open in the editor, else the one a
 *  playthrough would start at, else the first that exists. */
function seedLocationId(world: LensWorld, selectedLocationId: string | null): string | null {
  const locations = world.locations ?? [];
  const selected = locations.find((l) => l.id === selectedLocationId);
  if (selected) return selected.id;
  return locations.find((l) => l.isStarting)?.id ?? locations[0]?.id ?? null;
}

/**
 * The lens to open with. A stored selection wins wherever the world still has what it names — the author's
 * setup surviving a tab switch is the point — and each half falls back to a fresh seed on its own, so
 * deleting the location doesn't also forget the PC.
 */
export function seedLens(
  world: LensWorld,
  stored: LensState | null,
  selectedLocationId: string | null,
): LensState {
  const pcs = new Set(lensPcOptions(world).map((o) => o.id));
  const storedPc = stored?.pcTraitId;
  const locations = world.locations ?? [];
  const storedLocation = stored?.locationId;
  return {
    pcTraitId: storedPc && pcs.has(storedPc) ? storedPc : null,
    locationId: storedLocation && locations.some((l) => l.id === storedLocation)
      ? storedLocation
      : seedLocationId(world, selectedLocationId),
  };
}

/** Every pin of `trait` the world cannot honor, in the order the trait declares them. */
function brokenPinsOf(trait: Trait, placeholders: Placeholder[]): BrokenPin[] {
  const known = new Set(placeholders.map((p) => p.id));
  return (trait.placeholderPins ?? [])
    .filter((pin) => pin.placeholderId && pin.value && !known.has(pin.placeholderId))
    .map((pin) => ({
      placeholderId: pin.placeholderId,
      value: pin.value,
      shown: describePlaceholders(pin.value, placeholders),
    }));
}

/** The lens as every instrument reads it. A PC the world no longer has resolves to none rather than to a
 *  stale trait, so an id outliving its trait costs the selection and nothing else. */
export function buildLens(world: LensWorld, state: LensState): BenchLens {
  const pc = (world.traits ?? []).find((t) => t.id === state.pcTraitId) ?? null;
  const active = pc ? [pc] : [];
  return {
    state,
    pc,
    location: (world.locations ?? []).find((l) => l.id === state.locationId) ?? null,
    pins: activePlaceholderPins(active, world.placeholders ?? []),
    brokenPins: pc ? brokenPinsOf(pc, world.placeholders ?? []) : [],
    statEnabled: activeStatEnabled(world.stats ?? [], active),
  };
}

/**
 * The traits a fresh game as this lens's PC starts with: the world's defaults, with the PC replacing
 * whichever default its own exclusive group contributed, in authored order — the same substitution and
 * ordering that choosing the character at game start applies.
 */
export function lensActiveTraits(world: LensWorld, lens: BenchLens): Trait[] {
  const traits = world.traits ?? [];
  const groups = world.traitGroups ?? [];
  const order = traitOrderIndex(traits, groups);
  const defaults = traits.filter((t) => t.isDefault);
  if (!lens.pc) return inAuthoredOrder(defaults, order);
  const pc = lens.pc;
  const retired = new Set(exclusiveSiblings(pc, traits, groups));
  const kept = defaults.filter((t) => t.id !== pc.id && !retired.has(t.id));
  return inAuthoredOrder([...kept, pc], order);
}

/** A stat the PC switches away from the world's default, named as the stat list names it. */
export interface StatOverride {
  stat: string;
  enabled: boolean;
}

/** The stats this PC switches away from the world's default — what an instrument names when it explains why
 *  a stat it is showing (or not showing) isn't the one the stat list would suggest. */
export function lensStatOverrides(world: LensWorld, lens: BenchLens): StatOverride[] {
  if (!lens.pc) return [];
  return (world.stats ?? [])
    .filter((s) => lens.statEnabled[s.id] !== (s.enabled !== false))
    .map((s) => ({ stat: s.name || s.id, enabled: lens.statEnabled[s.id] }));
}

const quote = (text: string) => `“${text}”`;

/** A broken pin as the sentence under the selector reads. Names the value it claims to force, since
 *  "broken" alone sends the author looking for which end of the pin moved. */
export function describeBrokenPin(pin: BrokenPin): string {
  return `Pins a placeholder that doesn’t exist, so ${quote(pin.shown)} is never applied.`;
}

/**
 * Chip-bearing text as the lens reads it: the PC's pins masking their placeholders, everything else
 * described as the editor describes it. An unpinned Wildcard stays its `{a|b}` summary — its value is
 * decided by a roll at play time, and a design-time surface inventing one would be showing a fiction.
 */
export const resolveLensText = (
  text: string,
  placeholders: Placeholder[] | undefined,
  pins: Record<string, string>,
): string => describePlaceholders(text, placeholders ?? [], pins);
