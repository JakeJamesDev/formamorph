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
import { activePlaceholderPins, activeStatEnabled, inAuthoredOrder, traitOrderIndex } from '@/lib/traitEffects';
import type { GameLocation, Placeholder, Trait } from '@/types';
import type { RuleWorld } from './rules';

/** The slices of the authored world the lens reads. */
export type LensWorld = Pick<RuleWorld, 'traits' | 'traitGroups' | 'locations' | 'placeholders' | 'stats'>;

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

/** A pin the world cannot honor: it names a placeholder that is gone, or a value that placeholder doesn't
 *  offer. Surfaced rather than applied silently — a pin that reads as working and isn't is the whole trap. */
export interface BrokenPin {
  placeholderId: string;
  /** The placeholder's name, or its id where the world has no such placeholder to name. */
  placeholderName: string;
  value: string;
  reason: 'missing-placeholder' | 'missing-value';
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

/** The traits an author can test as: every member of an exclusive group, in authored order. A trait outside
 *  one isn't a character — it is an option a character may also have — so it never appears here. */
export function lensPcOptions(world: LensWorld): LensOption[] {
  const exclusive = new Map(
    (world.traitGroups ?? []).filter((g) => g.exclusive).map((g) => [g.id, g.name]),
  );
  if (exclusive.size === 0) return [];
  const order = traitOrderIndex(world.traits ?? [], world.traitGroups ?? []);
  const members = (world.traits ?? []).filter((t) => t.groupId != null && exclusive.has(t.groupId));
  return inAuthoredOrder(members, order).map((t) => ({
    id: t.id,
    name: t.name || 'Untitled trait',
    groupName: exclusive.get(t.groupId as string) || 'Traits',
  }));
}

/** Everywhere the author can stand, in authored order. */
export function lensLocationOptions(world: LensWorld): LensOption[] {
  return (world.locations ?? []).map((l) => ({ id: l.id, name: l.name || 'Untitled location' }));
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
  const byId = new Map(placeholders.map((p) => [p.id, p]));
  return (trait.placeholderPins ?? []).flatMap((pin): BrokenPin[] => {
    if (!pin.placeholderId || !pin.value) return [];
    const ph = byId.get(pin.placeholderId);
    if (!ph) {
      return [{
        placeholderId: pin.placeholderId,
        placeholderName: pin.placeholderId,
        value: pin.value,
        reason: 'missing-placeholder' as const,
      }];
    }
    if (ph.values.includes(pin.value)) return [];
    return [{
      placeholderId: ph.id,
      placeholderName: ph.name || ph.id,
      value: pin.value,
      reason: 'missing-value' as const,
    }];
  });
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
    pins: activePlaceholderPins(active),
    brokenPins: pc ? brokenPinsOf(pc, world.placeholders ?? []) : [],
    statEnabled: activeStatEnabled(world.stats ?? [], active),
  };
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

/** A broken pin as the sentence under the selector reads. Says what the pin claims and what the world has
 *  instead, since "broken" alone sends the author looking for which of the two moved. */
export function describeBrokenPin(pin: BrokenPin): string {
  return pin.reason === 'missing-placeholder'
    ? `Pins a placeholder that doesn’t exist, so ${quote(pin.value)} is never applied.`
    : `Pins ${quote(pin.placeholderName)} to ${quote(pin.value)}, which isn’t one of its values.`;
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
