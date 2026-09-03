// Placeholder pins: what holds a placeholder at a fixed value, from any of the four sources — a trait, the
// current location, a stat descriptor band, or a placeholder value. A pin masks the roll under it and never
// overwrites it, so every collector here is an overlay computed fresh from the current state.
//
// Precedence: descriptor > location > trait > value pin. Within traits the later one in the authored tree
// wins; within one location or one band the later row wins.

import type {
  GameLocation, Placeholder, PlaceholderGroup, PlaceholderPin, PlaceholderRolls, PlaceholderValue, Stat, StatDescriptor,
  Trait, TraitGroup,
} from '@/types';
import { encodePlaceholderToken, pinText, placeholderIsChoice, placeholderValueLine, sameMap } from './placeholders';
import type { PlaceholderOwners } from './placeholderHomes';
import { labelPlaceholders, placeholderDisplayName, type PlacementLetters } from './placementLetters';
import { activeDescriptor } from './statContext';
import { thresholdUnitOf, type BandedStat } from './statDescriptorGeometry';
import { activeStatEnabled, exclusiveSiblings, inAuthoredOrder, traitOrderIndex } from './traitEffects';

/** A stat as the descriptor source reads it: its bands and the value that picks one, plus the id and
 *  enabled flag that gate them. A live `PlayerStat` is one; so is an authored stat given its start value. */
export type PinnableStat = BandedStat & Pick<Stat, 'id' | 'enabled'> & { value: number };

/** A structural problem met while settling value pins. */
export interface PinFinding {
  /** Value pins that flip each other without settling; the ids are the placeholders caught in the loop. */
  kind: 'value-pin-cycle';
  placeholderIds: string[];
  /** The states the walk cycles through, in order: each one the value every looping placeholder reads as,
   *  ending on the state that repeated the first. */
  loop: Record<string, string>[];
}

/** Everything a pin collection reads. Only `traits` and `placeholders` are always present. */
export interface PinSources {
  /** The chosen traits, in authored order. */
  traits: readonly Trait[];
  disabledTraitIds?: readonly string[];
  /** Where the player is; absent or null before a location is picked. */
  location?: Pick<GameLocation, 'id' | 'placeholderPins'> | null;
  /** The stats with their current values; each one's band is what pins. */
  stats?: readonly PinnableStat[];
  placeholders: readonly Placeholder[];
  /** The playthrough's rolls: what a value-pinning placeholder reads as when nothing pins it. */
  rolls?: PlaceholderRolls;
  onFinding?: (finding: PinFinding) => void;
}

/** Placeholder id → placeholder, the lookup every pin reader needs. */
export const indexPlaceholders = (placeholders: readonly Placeholder[]): Map<string, Placeholder> =>
  new Map(placeholders.map((p) => [p.id, p]));

/** The placeholders whose values pin something — the only ones a value-pin pass or a loop check reads. */
export const valuePinners = (placeholders: readonly Placeholder[]): Placeholder[] =>
  placeholders.filter((p) => (p.values ?? []).some((v) => v.pins?.length));

/** One pin as a collection laid it: where it came from, what it forced, and whether it is the pin in
 *  force on its placeholder once every source has had its say. */
export interface PinLayer {
  source: PinSourceRef;
  /** The stored pin, so a surface can find its row again. */
  pin: PlaceholderPin;
  placeholderId: string;
  /** The text laid — the named value's current text, else the pin's own. */
  value: string;
  wins: boolean;
}

/** Lay one source's pins over `out`, later rows winning; each lay is also pushed on `trace` when given. */
function layPins(
  out: Record<string, string>,
  pins: readonly PlaceholderPin[] | undefined,
  byId: ReadonlyMap<string, Placeholder>,
  trace?: { layers: PinLayer[]; source: PinSourceRef },
): void {
  for (const pin of pins ?? []) {
    const text = pinText(pin, byId);
    if (!text) continue;
    out[pin.placeholderId] = text;
    trace?.layers.push({ source: trace.source, pin, placeholderId: pin.placeholderId, value: text, wins: false });
  }
}

/** `layers` with `wins` set on the last lay per placeholder among those `pins` actually holds — the one
 *  whose text play reads. Layers under a key another kind claimed stay losers. */
function markWinners(layers: PinLayer[], pins: Record<string, string>, claimed: ReadonlySet<string>): PinLayer[] {
  const last = new Map<string, number>();
  layers.forEach((layer, i) => {
    if (!claimed.has(layer.placeholderId) && pins[layer.placeholderId] === layer.value) last.set(layer.placeholderId, i);
  });
  return layers.map((layer, i) => (last.get(layer.placeholderId) === i ? { ...layer, wins: true } : layer));
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
  return collectPinLayers(src).pins;
}

/**
 * `collectPins` with its working shown: every pin any active source laid, in the order play lays them, and
 * which one each placeholder ends up reading. The lens and the Bench's rules read the layers; play reads
 * the record. One walk produces both, so the two can never disagree about who wins.
 */
export function collectPinLayers(src: PinSources): { pins: Record<string, string>; layers: PinLayer[] } {
  const { traits, disabledTraitIds = [], location, stats = [], placeholders, rolls, onFinding } = src;
  const byId = indexPlaceholders(placeholders);
  const off = new Set(disabledTraitIds);
  const active = traits.filter((t) => !off.has(t.id));

  const layered: Record<string, string> = {};
  const layers: PinLayer[] = [];
  const laidBy = (source: PinSourceRef) => ({ layers, source });
  for (const t of active) layPins(layered, t.placeholderPins, byId, laidBy({ kind: 'trait', id: t.id }));
  if (location) layPins(layered, location.placeholderPins, byId, laidBy({ kind: 'location', id: location.id }));
  const enabled = activeStatEnabled(stats, active);
  for (const stat of stats) {
    if (enabled[stat.id] === false) continue;
    const band = activeDescriptor(stat, stat.value);
    if (band) layPins(layered, band.placeholderPins, byId, laidBy({ kind: 'descriptor', statId: stat.id, descriptorId: band.id }));
  }
  const settled = settleValuePins(layered, placeholders, byId, rolls, onFinding);
  const claimed = new Set(Object.keys(layered));
  return {
    pins: settled.pins,
    layers: [...markWinners(layers, layered, new Set()), ...markWinners(settled.layers, settled.pins, claimed)],
  };
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
): { pins: Record<string, string>; layers: PinLayer[] } {
  const pinners = valuePinners(placeholders);
  if (!pinners.length) return { pins: layered, layers: [] };

  const seen: Record<string, string>[] = [layered];
  let prev = layered;
  let prevLayers: PinLayer[] = [];
  for (;;) {
    const laid: Record<string, string> = {};
    const layers: PinLayer[] = [];
    for (const ph of pinners) {
      const values = ph.values ?? [];
      const pinsOn = { ...prev, ...laid, ...layered };
      // An Object holds every value at once, so each one's pins apply; a choice holds the one it reads as.
      const held = placeholderIsChoice(ph)
        ? values.filter((v) => v.text === effectiveValue(ph, pinsOn, rolls))
        : values;
      for (const v of held) {
        layPins(laid, v.pins, byId, { layers, source: { kind: 'value', placeholderId: ph.id, valueId: v.id } });
      }
    }
    const next = { ...laid, ...layered };
    if (sameMap(next, prev)) return { pins: prev, layers };
    const repeat = seen.findIndex((s) => sameMap(s, next));
    if (repeat >= 0) {
      const states = [...seen.slice(repeat), next];
      const placeholderIds = [...new Set(states.slice(1).flatMap((s, i) => differingKeys(s, states[i])))].sort();
      const readAs = (state: Record<string, string>) => Object.fromEntries(placeholderIds.map((id) => {
        const ph = byId.get(id);
        return [id, (ph ? effectiveValue(ph, state, rolls) : state[id] ?? rolls?.world?.[id]) ?? ''];
      }));
      onFinding?.({ kind: 'value-pin-cycle', placeholderIds, loop: states.slice(0, -1).map(readAs) });
      return { pins: prev, layers: prevLayers };
    }
    seen.push(next);
    prev = next;
    prevLayers = layers;
  }
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

/** Whether `pin` names its value by an id `ph` no longer carries — what deleting the value leaves behind.
 *  Play falls back to the pin's text, so the pin still forces something; it just stopped following the list. */
export function hasDeadValueId(pin: PlaceholderPin, ph: Placeholder | undefined): boolean {
  return !!ph && !!pin.valueId && !(ph.values ?? []).some((v) => v.id === pin.valueId);
}

// ---- The editor's view: every pin aimed at one placeholder, and who wins among them ----

/** Where a pin lives. Enough to find the row again and, for a source with a name, to open it. */
export type PinSourceRef =
  | { kind: 'trait'; id: string }
  | { kind: 'location'; id: string }
  | { kind: 'descriptor'; statId: string; descriptorId: string | number }
  | { kind: 'value'; placeholderId: string; valueId: string };

export type PinSourceKind = PinSourceRef['kind'];

/** The ref shape one kind speaks in. */
type SourceOf<K extends PinSourceKind> = Extract<PinSourceRef, { kind: K }>;

/** One pin as the editor lists it. */
export interface PinRow {
  source: PinSourceRef;
  pin: PlaceholderPin;
  /** The source's authored name, chips kept, for a surface that draws them: a trait's or location's own
   *  name, a band's stat, a value's placeholder. */
  name: string;
  /** The row as a plain-text surface reads it: `Trait: Sworn`, `Location: Fen`, `Hunger ≤ 20`,
   *  `Region = Northern`. */
  label: string;
}

/** The world as the pin editors read it. Only `placeholders` is required; a mock or a partial world may
 *  carry any subset of the rest. */
export interface PinEditorWorld {
  traits?: readonly Trait[];
  traitGroups?: readonly TraitGroup[];
  locations?: readonly GameLocation[];
  stats?: readonly Stat[];
  placeholders: readonly Placeholder[];
  placeholderOwners?: PlaceholderOwners;
  /** The world's placeholder folders, so a pin picker heads its rows the way every other picker does. */
  placeholderGroups?: readonly PlaceholderGroup[];
  placementLetters?: PlacementLetters;
}

type PinList = readonly PlaceholderPin[];
/** What a write does to a source's pin list; null leaves the world untouched. */
type PinListChange = (pins: PinList) => PinList | null;

/** One source of one kind, with everything the surfaces read off it. */
interface PinSourceEntry<K extends PinSourceKind> {
  source: SourceOf<K>;
  /** The source's own authored name, chips kept. */
  name: string;
  /** The row as a plain-text surface reads it. */
  label: string;
  /** How the Add picker lists it — a band adds its description. */
  option: string;
  pins?: PinList;
}

/**
 * Everything one kind of pin source contributes. A new source is a row here plus its own editor: the
 * collector, the Bench's rules and the Pins section read this rather than switching on the kind.
 * Declaration order in {@link PIN_SOURCE_KINDS} is the precedence between kinds, and a source's position
 * in `sources` is the precedence within one — later lays last, so later wins.
 */
interface PinSourceSpec<K extends PinSourceKind> {
  /** What the Add picker calls this kind. */
  label: string;
  /** What the picker says where the world holds none of them. */
  empty: string;
  /** Every source of this kind, in the order its list is authored. */
  sources(world: PinEditorWorld): PinSourceEntry<K>[];
  /** One source as a string — a Select value, a React key. Distinct for distinct refs. */
  key(source: SourceOf<K>): string;
  same(a: SourceOf<K>, b: SourceOf<K>): boolean;
  /** True when two sources of this kind can never be in force at once, so neither is the other's rival. */
  neverTogether(world: PinEditorWorld, a: SourceOf<K>, b: SourceOf<K>): boolean;
  /** The record the source sits on — what a finding opens, and what a write is handed back on. */
  ownerId(source: SourceOf<K>): string;
  /** The world with this source's pin list rewritten. The same world when the source is not there or the
   *  change declined; otherwise only the record on the path to the list is a new object. */
  write<W extends PinEditorWorld>(world: W, source: SourceOf<K>, change: PinListChange): W;
}

const PIN_SOURCE_KINDS: { [K in PinSourceKind]: PinSourceSpec<K> } = {
  descriptor: {
    label: 'Stat Descriptor',
    empty: 'No stat descriptors to pin from.',
    sources(world) {
      const name = labeler(world);
      return (world.stats ?? []).flatMap((stat) => (stat.descriptors ?? []).map((band) => {
        const label = name.band(stat, band);
        return {
          source: { kind: 'descriptor' as const, statId: stat.id, descriptorId: band.id },
          name: stat.name,
          label,
          option: band.description ? `${label}: ${name.text(band.description)}` : label,
          pins: band.placeholderPins,
        };
      }));
    },
    key: (s) => `descriptor:${s.statId}:${JSON.stringify(s.descriptorId)}`,
    same: (a, b) => a.statId === b.statId && a.descriptorId === b.descriptorId,
    // One stat sits in one band at a time.
    neverTogether: (_world, a, b) => a.statId === b.statId,
    ownerId: (s) => s.statId,
    write: (world, source, change) => {
      const stats = mapOne(world.stats, (s) => s.id === source.statId, (s) => {
        const descriptors = mapOne(s.descriptors, (d) => d.id === source.descriptorId, (d) => rewritten(d, 'placeholderPins', change));
        return descriptors ? { ...s, descriptors } : null;
      });
      return stats ? { ...world, stats } : world;
    },
  },
  location: {
    label: 'Location',
    empty: 'No locations to pin from.',
    sources(world) {
      const name = labeler(world);
      return (world.locations ?? []).map((location) => ({
        source: { kind: 'location' as const, id: location.id },
        name: location.name,
        label: `Location: ${name.text(location.name)}`,
        option: name.text(location.name),
        pins: location.placeholderPins,
      }));
    },
    key: (s) => `location:${s.id}`,
    same: (a, b) => a.id === b.id,
    // The player stands in one place.
    neverTogether: () => true,
    ownerId: (s) => s.id,
    write: (world, source, change) => {
      const locations = mapOne(world.locations, (l) => l.id === source.id, (l) => rewritten(l, 'placeholderPins', change));
      return locations ? { ...world, locations } : world;
    },
  },
  trait: {
    label: 'Trait',
    empty: 'No traits to pin from.',
    sources(world) {
      const name = labeler(world);
      const { traits = [], traitGroups = [] } = world;
      return inAuthoredOrder(traits, traitOrderIndex(traits, traitGroups)).map((trait) => ({
        source: { kind: 'trait' as const, id: trait.id },
        name: trait.name,
        label: `Trait: ${name.text(trait.name)}`,
        option: name.text(trait.name),
        pins: trait.placeholderPins,
      }));
    },
    key: (s) => `trait:${s.id}`,
    same: (a, b) => a.id === b.id,
    neverTogether: (world, a, b) => {
      const trait = (world.traits ?? []).find((t) => t.id === a.id);
      return !!trait && exclusiveSiblings(trait, world.traits ?? [], world.traitGroups ?? []).includes(b.id);
    },
    ownerId: (s) => s.id,
    write: (world, source, change) => {
      const traits = mapOne(world.traits, (t) => t.id === source.id, (t) => rewritten(t, 'placeholderPins', change));
      return traits ? { ...world, traits } : world;
    },
  },
  value: {
    label: 'Placeholder Value',
    empty: 'No other placeholder values to pin from.',
    sources(world) {
      const name = labeler(world);
      return world.placeholders.flatMap((ph) => (ph.values ?? []).map((value) => {
        const label = name.value(ph, value);
        return {
          source: { kind: 'value' as const, placeholderId: ph.id, valueId: value.id },
          name: ph.name,
          label,
          option: label,
          pins: value.pins,
        };
      }));
    },
    key: (s) => `value:${s.placeholderId}:${s.valueId}`,
    same: (a, b) => a.placeholderId === b.placeholderId && a.valueId === b.valueId,
    // A Wildcard reads as one of its values; an Object holds them all, so those two can both be in force.
    neverTogether: (world, a, b) => {
      if (a.placeholderId !== b.placeholderId) return false;
      const ph = world.placeholders.find((p) => p.id === a.placeholderId);
      return !!ph && placeholderIsChoice(ph);
    },
    ownerId: (s) => s.placeholderId,
    write: (world, source, change) => {
      const placeholders = mapOne(world.placeholders, (p) => p.id === source.placeholderId, (p) => {
        const values = mapOne(p.values, (v) => v.id === source.valueId, (v) => rewritten(v, 'pins', change));
        return values ? { ...p, values } : null;
      });
      return placeholders ? { ...world, placeholders } : world;
    },
  },
};

/** Kinds strongest first — the order {@link PIN_SOURCE_KINDS} declares them in. */
const KINDS_BY_RANK = Object.keys(PIN_SOURCE_KINDS) as PinSourceKind[];

/** Lower is stronger: a descriptor, then a location, then a trait, then a value pin. */
const KIND_RANK = Object.fromEntries(KINDS_BY_RANK.map((kind, i) => [kind, i])) as Record<PinSourceKind, number>;

/** The row for a ref's kind. The kind is a union at every call site, so the widening the switches used to
 *  spell out happens here, once; each spec's own methods are written against its own ref shape. */
const specOf = (source: PinSourceRef): PinSourceSpec<PinSourceKind> =>
  PIN_SOURCE_KINDS[source.kind] as PinSourceSpec<PinSourceKind>;

const specFor = (kind: PinSourceKind): PinSourceSpec<PinSourceKind> =>
  PIN_SOURCE_KINDS[kind] as PinSourceSpec<PinSourceKind>;

/** The kinds a pin can be written on, strongest first — what the Add picker lists. */
export const PIN_KINDS: ReadonlyArray<{ kind: PinSourceKind; label: string; empty: string }> =
  KINDS_BY_RANK.map((kind) => ({ kind, label: specFor(kind).label, empty: specFor(kind).empty }));

export function sameSource(a: PinSourceRef, b: PinSourceRef): boolean {
  return a.kind === b.kind && specOf(a).same(a, b);
}

/** A source ref as one string — a Select value, a React key. Distinct for distinct refs, band ids of
 *  either type included. */
export function pinSourceKey(source: PinSourceRef): string {
  return specOf(source).key(source);
}

/** The record a pin sits on: the trait, the location, the stat, the placeholder. What a finding opens and
 *  what a write hands back. */
export function pinSourceOwnerId(source: PinSourceRef): string {
  return specOf(source).ownerId(source);
}

/**
 * Every pin any source aims at `placeholderId`, strongest kind first and in authored order within a kind.
 * The rows are read-only views; the pin itself still lives on its source.
 */
export function pinsTargeting(world: PinEditorWorld, placeholderId: string): PinRow[] {
  return allPinRows(world).filter((row) => row.pin.placeholderId === placeholderId);
}

/** Every pin every source carries, strongest kind first and in authored order within a kind — what a pass
 *  over the whole world reads, empty and broken rows included. */
export function allPinRows(world: PinEditorWorld): PinRow[] {
  return KINDS_BY_RANK.flatMap((kind) => specFor(kind).sources(world).flatMap((entry) =>
    (entry.pins ?? []).map((pin): PinRow => ({ source: entry.source, pin, name: entry.name, label: entry.label }))));
}

/** The spellings every pin surface shares: chips labeled, a band as `Hunger ≤ 20`, a value as
 *  `Region = Northern`. */
function labeler(world: PinEditorWorld) {
  const { placeholders, placeholderOwners: owners, placementLetters: letters } = world;
  const text = (s: string) => labelPlaceholders(s, placeholders, { letters, owners });
  return {
    text,
    band: (stat: Stat, band: StatDescriptor) =>
      `${text(stat.name)} ≤ ${band.threshold}${thresholdUnitOf(stat) === 'percent' ? '%' : ''}`,
    value: (ph: Placeholder, value: PlaceholderValue) =>
      `${placeholderDisplayName(ph.id, placeholders, { letters, owners })} = ${placeholderValueLine(text(value.text))}`,
  };
}

/** What a pin editor says under a row: the other pins that can be in force beside this source, and the one
 *  the precedence rules pick. */
export interface PinConflict {
  /** Strongest kind first. */
  rivals: PinRow[];
  /** The rival that wins, or null when the source being edited does. */
  winner: PinRow | null;
  /** How it was decided: by kind (a band outranks a location, a location a trait, a trait a value pin), or
   *  by order within one kind (the lowest in its list wins). */
  rule: 'kind' | 'order';
}

/**
 * The competition for `placeholderId` as seen from `source`. Pins that can never be in force together are
 * no competition and are left out: two locations, two bands of one stat, two values of one Wildcard,
 * exclusive trait siblings. Null when nothing else can claim the placeholder.
 */
export function pinConflict(world: PinEditorWorld, placeholderId: string, source: PinSourceRef): PinConflict | null {
  const rows = pinsTargeting(world, placeholderId);
  const self = rows.find((r) => sameSource(r.source, source)) ?? null;
  const rivals = rows.filter((r) => !sameSource(r.source, source)
    && !(r.source.kind === source.kind && specOf(source).neverTogether(world, source, r.source)));
  if (!rivals.length) return null;

  // Within a kind, the later in its list lays its pin last and so wins — the same order `collectPins`
  // walks. Only rows of one kind are ever compared this way, so each kind's index is built when needed.
  const indexes = new Map<PinSourceKind, ReadonlyMap<string, number>>();
  const inKind = (s: PinSourceRef): number => {
    let index = indexes.get(s.kind);
    if (!index) {
      index = new Map(specFor(s.kind).sources(world).map((entry, i) => [pinSourceKey(entry.source), i]));
      indexes.set(s.kind, index);
    }
    return index.get(pinSourceKey(s)) ?? -1;
  };
  const beats = (a: PinSourceRef, b: PinSourceRef): boolean =>
    KIND_RANK[a.kind] !== KIND_RANK[b.kind] ? KIND_RANK[a.kind] < KIND_RANK[b.kind] : inKind(a) > inKind(b);

  let strongest = rivals[0];
  for (const r of rivals.slice(1)) if (beats(r.source, strongest.source)) strongest = r;
  const winner = beats(strongest.source, self?.source ?? source) ? strongest : null;
  // The rule is read from the source's side: what decided between the winner and the source, or, when the
  // source wins, between it and the strongest rival.
  const loser = winner ? source : strongest.source;
  const rule = (winner?.source ?? source).kind === loser.kind ? 'order' : 'kind';
  return { rivals, winner, rule };
}

// ---- Writing a pin back to its source ----

/** Two pins are the same row when they aim one placeholder at one value, id and all. */
export function samePin(a: PlaceholderPin, b: PlaceholderPin): boolean {
  return a.placeholderId === b.placeholderId && a.value === b.value && a.valueId === b.valueId;
}

/** Where `pin` sits in `pins`: the object itself when the list holds it — a `PinRow` hands back the stored
 *  pin, so two fresh empty pins on one source stay two rows — else the first reading the same. */
function indexOfPin(pins: PinList, pin: PlaceholderPin): number {
  const byRef = pins.indexOf(pin);
  return byRef >= 0 ? byRef : pins.findIndex((p) => samePin(p, pin));
}

/** `holder` with its pin list under `field` rewritten; an emptied list is dropped, so a source that pins
 *  nothing stores nothing. Null when the change declined. */
function rewritten<T extends { [P in K]?: PlaceholderPin[] }, K extends 'placeholderPins' | 'pins'>(
  holder: T, field: K, change: PinListChange,
): T | null {
  const next = change(holder[field] ?? []);
  if (!next) return null;
  const { [field]: _drop, ...rest } = holder;
  return { ...rest, ...(next.length ? { [field]: [...next] } : {}) } as T;
}

/** `list` with the one item `match` picks replaced by `change`'s result; null when nothing matched or the
 *  change declined, so the caller can hand back the record it was given. */
function mapOne<T>(list: readonly T[] | undefined, match: (item: T) => boolean, change: (item: T) => T | null): T[] | null {
  const i = list?.findIndex(match) ?? -1;
  if (!list || i < 0) return null;
  const next = change(list[i]);
  return next ? list.map((item, j) => (j === i ? next : item)) : null;
}

/** The world with `pin` appended to `source`'s list. */
export function addPinAt<W extends PinEditorWorld>(world: W, source: PinSourceRef, pin: PlaceholderPin): W {
  return specOf(source).write(world, source, (pins) => [...pins, pin]);
}

/** The world with the row on `source` that reads as `pin` replaced by `next`. A source may carry several
 *  pins on one placeholder, so the pin itself picks the row. */
export function updatePinAt<W extends PinEditorWorld>(world: W, source: PinSourceRef, pin: PlaceholderPin, next: PlaceholderPin): W {
  return specOf(source).write(world, source, (pins) => {
    const i = indexOfPin(pins, pin);
    return i < 0 ? null : pins.map((p, j) => (j === i ? next : p));
  });
}

/** The world with the row on `source` that reads as `pin` removed. */
export function removePinAt<W extends PinEditorWorld>(world: W, source: PinSourceRef, pin: PlaceholderPin): W {
  return specOf(source).write(world, source, (pins) => {
    const i = indexOfPin(pins, pin);
    return i < 0 ? null : pins.filter((_, j) => j !== i);
  });
}

/** One source a pin can be written on, as the add and re-aim pickers list it. */
export interface PinSourceOption {
  source: PinSourceRef;
  label: string;
}

/**
 * Every source of `kind` a pin on `placeholderId` may live on, in the order its list is authored: a trait or
 * location by name, a band as `Hunger ≤ 20: Starving`, a value as `Region = Northern`. The placeholder's own
 * values are left out — a value cannot pin its own placeholder.
 */
export function pinSourcesOfKind(world: PinEditorWorld, kind: PinSourceKind, placeholderId: string): PinSourceOption[] {
  return specFor(kind).sources(world)
    .filter((entry) => !(entry.source.kind === 'value' && entry.source.placeholderId === placeholderId))
    .map((entry) => ({ source: entry.source, label: entry.option }));
}
