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
import { allPlaceholders, placeholderOwners } from '@/lib/placeholderHomes';
import { labelPlaceholders, worldPlacementLetters } from '@/lib/placementLetters';
import { allPinRows, bindBlueprintPins, collectPinLayers, samePin, sameSource, type PinLayer } from '@/lib/placeholderPins';
import { copyLookup, readerFor, type CopyLookup } from '@/lib/blueprints';
import { activeStatEnabled, defaultPicks, exclusiveSiblings, inAuthoredOrder, traitOrderIndex } from '@/lib/traitEffects';
import { startingStatsWith } from '@/lib/traitRuntime';
import { PLAYER_BEARER, resolveBearers, type Bearer } from '@/lib/bearers';
import type { GameLocation, Placeholder, Trait } from '@/types';
import { bearerWorldOf, type RuleWorld } from './rules';

/** The slices of the authored world the lens reads. The rest of the document is optional and read only to
 *  letter the pickers' chips the way the editor letters them — entities come first in that walk. */
export type LensWorld =
  Pick<RuleWorld, 'traits' | 'traitGroups' | 'locations' | 'placeholders' | 'stats'>
  & Partial<Pick<RuleWorld, 'entities' | 'entityGroups' | 'dictionaries' | 'worldOverview'>>;

/** The lens tests as the None player: the root outside Blueprints, and the Custom Persona entity's tree after
 *  it, as one list. Cached per world object, since every instrument reads it. */
const playerByWorld = new WeakMap<LensWorld, Bearer>();
function lensPlayer(world: LensWorld): Bearer {
  let player = playerByWorld.get(world);
  if (!player) {
    const { bearers } = resolveBearers(bearerWorldOf(world), { source: 'none' });
    const root = bearers.find((b) => b.id === PLAYER_BEARER)!;
    const custom = bearers.find((b) => b.isPlayer && b.entity);
    player = custom ? {
      ...root,
      traits: [...root.traits, ...custom.traits],
      groups: [...root.groups, ...custom.groups],
      linkOf: new Map([...root.linkOf, ...custom.linkOf]),
    } : root;
    playerByWorld.set(world, player);
  }
  return player;
}

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
  /** The source as every pin surface names it: `Trait: Sworn`, `Location: Fen`, `Hunger ≤ 20`. */
  source: string;
}

/** One pin an active source lays under this lens, labeled as the pin editors label its source. */
export type LensPinLayer = PinLayer & { label: string };

/** The lens resolved against a world: who and where, and everything that follows from the PC. */
export interface BenchLens {
  state: LensState;
  pc: Trait | null;
  location: GameLocation | null;
  /** Placeholder id → the value in force, from every source a fresh game as this PC standing here would
   *  have: the active traits, the location, the band each starting stat lands in, and the value pins those
   *  settle. Broken pins are in here too when play would apply them, so what the Bench shows is what a turn
   *  would show. */
  pins: Record<string, string>;
  /** Every pin behind `pins`, in the order play lays them, the one in force per placeholder marked. */
  pinLayers: LensPinLayer[];
  brokenPins: BrokenPin[];
  /** Stat id → whether it is live under this PC — the world's defaults with the PC's toggles over them. */
  statEnabled: Record<string, boolean>;
  /** What the PC's trait text reads a blueprint chip as: the Custom Persona entity's copy, else the blueprint. */
  copies: CopyLookup;
}

/**
 * The traits an author can test as: every member of an exclusive group, in authored order. A trait outside
 * one isn't a character — it is an option a character may also have — so it never appears here. Names
 * read as the editor's own trait list reads them: a chip by its placement label, never by a roll or a pin,
 * so the picker and the list agree on what a character is called.
 */
export function lensPcOptions(world: LensWorld): LensOption[] {
  const placeholders = allPlaceholders(world);
  const { traits, groups } = lensPlayer(world);
  const exclusive = new Map(groups.filter((g) => g.maxPicks === 1).map((g) => [g.id, g.name]));
  if (exclusive.size === 0) return [];
  const order = traitOrderIndex(traits, groups);
  const members = traits.filter((t) => t.groupId != null && exclusive.has(t.groupId));
  const letters = worldPlacementLetters(world);
  return inAuthoredOrder(members, order).map((t) => ({
    id: t.id,
    name: labelPlaceholders(t.name, placeholders, { letters }) || 'Untitled trait',
    groupName: labelPlaceholders(exclusive.get(t.groupId as string) ?? '', placeholders, { letters }) || 'Traits',
  }));
}

/** Everywhere the author can stand, in authored order, named as the editor's own list names it. */
export function lensLocationOptions(world: LensWorld): LensOption[] {
  const placeholders = allPlaceholders(world);
  const letters = worldPlacementLetters(world);
  return (world.locations ?? []).map((l) => ({
    id: l.id,
    name: labelPlaceholders(l.name, placeholders, { letters }) || 'Untitled location',
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

/** The layers the world cannot honor: each names a placeholder that is gone. */
function brokenPinsOf(layers: LensPinLayer[], placeholders: Placeholder[]): BrokenPin[] {
  const known = new Set(placeholders.map((p) => p.id));
  return layers
    .filter((layer) => !known.has(layer.placeholderId))
    .map((layer) => ({
      placeholderId: layer.placeholderId,
      value: layer.value,
      shown: describePlaceholders(layer.value, placeholders),
      source: layer.label,
    }));
}

/**
 * The lens as every instrument reads it. A PC the world no longer has resolves to none rather than to a
 * stale trait, so an id outliving its trait costs the selection and nothing else. Pins come from the game's
 * own collector over what a fresh game as this PC would have in force: the active traits, the lens location,
 * and each stat's band at the value the traits leave it starting on. No roll is drawn at design time, so a
 * Wildcard's value pins wait for a source above them to fix its value.
 *
 * Any trait works as the PC here, not only an exclusive group's member. The Authoring Tour's In Play relies
 * on that to pick a trait the way the setup screen does.
 */
export function buildLens(world: LensWorld, state: LensState): BenchLens {
  const traits = world.traits ?? [];
  const groups = world.traitGroups ?? [];
  const placeholders = allPlaceholders(world);
  const player = lensPlayer(world);
  const pc = player.traits.find((t) => t.id === state.pcTraitId) ?? traits.find((t) => t.id === state.pcTraitId) ?? null;
  const location = (world.locations ?? []).find((l) => l.id === state.locationId) ?? null;
  const active = activeTraitsFor(world, pc);
  const { pins, layers } = collectPinLayers({
    traits: lensPinTraits(world, active),
    location,
    stats: startingStatsWith(world.stats ?? [], active, { traits: player.traits, groups: player.groups }),
    placeholders,
  });
  // The editors' labels for the same rows, matched by the stored pin: a layer carries the pin object its
  // source holds, and so does every row.
  const rows = allPinRows({
    traits, traitGroups: groups, entities: world.entities ?? [],
    locations: world.locations ?? [], stats: world.stats ?? [],
    placeholders, placeholderOwners: placeholderOwners(world), placementLetters: worldPlacementLetters(world),
  });
  const pinLayers = layers.map((layer): LensPinLayer => ({
    ...layer,
    // A bound blueprint pin matches no stored row, but its source's label is the same for every pin.
    label: (rows.find((r) => sameSource(r.source, layer.source) && (r.pin === layer.pin || samePin(r.pin, layer.pin)))
      ?? rows.find((r) => sameSource(r.source, layer.source)))?.label ?? '',
  }));
  return {
    state,
    pc,
    location,
    pins,
    pinLayers,
    brokenPins: brokenPinsOf(pinLayers, placeholders),
    statEnabled: activeStatEnabled(world.stats ?? [], active),
    copies: copyLookup(lensBlueprints(world), LENS_READER),
  };
}

/**
 * The traits a fresh game as this lens's PC starts with: the world's defaults, with the PC replacing
 * whichever default its own exclusive group contributed, in authored order — the same substitution and
 * ordering that choosing the character at game start applies.
 */
export function lensActiveTraits(world: LensWorld, lens: BenchLens): Trait[] {
  return activeTraitsFor(world, lens.pc);
}

/** Every trait whose pins world-level text reads in a fresh game under the lens: the player's `active`, with
 *  no persona, so a blueprint pin traces to the Custom Persona entity's copy, else the blueprint. */
export function lensPinTraits(world: LensWorld, active: readonly Trait[]): Trait[] {
  const blueprints = lensBlueprints(world);
  return active.map((t) => bindBlueprintPins(t, blueprints, LENS_READER));
}

/** The lens reads blueprints as the None player. */
const LENS_READER = readerFor({ source: 'none' }, null, true);
const lensBlueprints = (world: LensWorld) => ({ placeholders: world.placeholders ?? [], entities: world.entities ?? [] });

function activeTraitsFor(world: LensWorld, pc: Trait | null): Trait[] {
  const { traits, groups } = lensPlayer(world);
  const order = traitOrderIndex(traits, groups);
  const capped = new Set(defaultPicks(traits, groups));
  const defaults = traits.filter((t) => capped.has(t.id));
  if (!pc) return inAuthoredOrder(defaults, order);
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
  return `${quote(pin.source)} pins a placeholder that doesn’t exist, so ${quote(pin.shown)} is never applied.`;
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
  /** The bearer's copy lookup, for its trait text. */
  copies?: CopyLookup,
): string => describePlaceholders(text, placeholders ?? [], pins, copies);
