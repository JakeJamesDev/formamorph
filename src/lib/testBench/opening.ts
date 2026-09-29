/**
 * The Opening instrument's data: what a fresh game as the lens PC actually looks like — every stat settled
 * at its real turn-one value, the traits and pins in force, the wildcard rolls with their true odds, and the
 * first prompt exactly as the model receives it.
 *
 * Everything is computed by the game's own machinery: stats settle through `traitRuntime` (the same seeding,
 * clamping and bound derivation a new game runs), chips resolve through `resolvePlaceholders` with the
 * active traits' pins, and the first prompt is `buildNarrationPrompt` over the authored scene's chip values — the
 * assembly a real opening turn performs. A second implementation of any of these could disagree with play,
 * which would make the instrument a liar.
 *
 * Prompts and generation settings are global settings the editor cannot read, so the shipped defaults stand
 * in for them — the AI Context instrument's precedent.
 *
 * Pure and world-shaped: no React, no storage, no world mutation.
 */
import { defaultNarrationUserPrompt, defaultSystemPrompt } from '@/components/game/GamePrompts';
import { copyLookup, readerFor, type CopyLookup } from '@/lib/blueprints';
import { bearerPriming } from '@/lib/ownedTraitsInPlay';
import { allPlaceholders } from '@/lib/placeholderHomes';
import { DEFAULT_MAX_TOKENS } from '@/contexts/settingsDefaults';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { chipValues } from '@/lib/chipValues/chipValues';
import { estimateTokens } from '@/lib/memoryUtils';
import { newGamePool } from '@/lib/newGameOpening';
import {
  collectPlaceholderPlacements, decodePlaceholderToken, describePlaceholders, lonePlaceholderToken,
  placeholderChances, primeRolls, resolveEntityText, resolvePlaceholders,
  type PlaceholderPick,
} from '@/lib/placeholders';
import { DEFAULT_OPENING, openingOwner, openingsEnabled, poolChances, poolKey } from '@/lib/openings';
import { renderPromptTemplate } from '@/lib/promptTemplate';
import { activeDescriptor } from '@/lib/statContext';
import { allPinTexts, collectPins, valuePinRollChips } from '@/lib/placeholderPins';
import { activeStatEnabled, enabledStats } from '@/lib/traitEffects';
import { acquireTrait, seedStatBases, type TraitRuntimeState } from '@/lib/traitRuntime';
import { buildNarrationPrompt } from '@/lib/turnPipeline/narrationPrompt';
import { startingLocations } from '@/lib/startingLocation';
import type {
  Entity, GameLocation, Opening, PlaceholderRolls, PlayerStat, Stat, StatDescriptor, ThresholdUnit, Trait,
} from '@/types';
import { lensActiveTraits, lensPinTraits, resolveLensText, type BenchLens } from './lens';
import { bearerWorldOf, chipBearingTexts, type RuleWorld } from './rules';
import { scannedEntries } from './triggers';

/** The instrument reads the whole authored world — the first prompt pulls from every slice. */
export type OpeningWorld = RuleWorld;

/** One stat as a fresh game holds it at the top of turn one. */
export interface OpeningStat {
  id: string;
  name: string;
  type: Stat['type'];
  /** The effective bounds after the active traits — the range the slider scrubs. */
  min: number;
  max: number;
  /** The settled starting value: seeded, trait deltas applied, clamped — the real turn-one number. */
  value: number;
  /** What the active traits moved the start by, clamp included; 0 when they left it alone. */
  traitShift: number;
  /** The band the starting value lands on — what the AI is told. Null when no band covers it. */
  descriptor: string | null;
  /** The authored bands; the slider re-bands against them via `activeDescriptor`. */
  descriptors: StatDescriptor[];
  /** Which unit those thresholds are in — carried so the slider bands exactly as play does. */
  thresholdUnit?: ThresholdUnit;
  /** Bands exist but none covers the starting value — the AI is told no status (the contradiction class). */
  uncovered: boolean;
}

/** One trait in force at game start, with what it imposes. */
export interface OpeningTrait {
  id: string;
  name: string;
  isPc: boolean;
  pins: { placeholder: string; value: string }[];
  toggles: { stat: string; enabled: boolean }[];
}

/** One option in a wildcard's pool, as the row prints it. A value that is exactly one chip of another
 *  placeholder is not drawn until the roll lands on it, so it reads as that placeholder's name — marked, so
 *  the row can draw it in that placeholder's color — rather than as text invented for a branch that did
 *  not fire. */
export interface OpeningPoolOption {
  value: string;
  /** Chance of being drawn, as a percentage. */
  chance: number;
  /** The placeholder this option references, when it is one. */
  reference?: string;
}

/** One wildcard a fresh game rolls: its draws, each value's true odds, and the repeat risk. */
export interface OpeningRollGroup {
  placeholderId: string;
  name: string;
  /** Each value's chance of being drawn, in value order. */
  chances: OpeningPoolOption[];
  /** An active trait's pin masking every chip of this placeholder — then the rolls below never show. */
  pinnedValue?: string;
  /** The one shared roll World-mode chips read. */
  worldValue?: string;
  /** The per-placement rolls of Unique-mode chips, in placement order. */
  uniqueValues: string[];
  /** Chance at least two of the unique placements draw the same value — independent draws repeat. */
  collisionChance?: number;
}

/** One row of the opening pool at the chosen start, resolved as the player would meet it. */
export interface OpeningPoolRow {
  /** The Openings module's key for the row: owner plus opening id. */
  key: string;
  /** The entity that owns the row, or null for the world's and a location's own. */
  ownerName: string | null;
  /** The location that owns the row, on a location's rows only. */
  locationName: string | null;
  /** A Self row: the played entity's own opening. */
  self: boolean;
  /** Whether the row opens as a Player Action or as Narration. */
  kind: Opening['kind'];
  /** The row's text with chips and the user macro resolved. */
  text: string;
  /** Chance of being drawn from this pool, as a percentage. */
  chance: number;
}

/** Everything the Opening instrument shows for one lens. */
export interface OpeningData {
  pcName: string | null;
  location: GameLocation | null;
  locationName: string;
  /** How many places the fresh game might start at — above 1, play picks one at random. */
  startPool: number;
  /** The places the fresh game might start at, for the author to pick one. */
  starts: { id: string; name: string }[];
  /** The world's personas the author can play as; None is always there. */
  personas: { id: string; name: string }[];
  /** The persona shown, or null for None. */
  personaId: string | null;
  /** The rows a fresh game at `location` draws from, in pool order. */
  pool: OpeningPoolRow[];
  /** The pool row shown, or null when the pool is empty and play opens on the default. */
  selectedKey: string | null;
  /** The opening shown, resolved. */
  opening: Pick<Opening, 'kind' | 'text'>;
  /** The world's openings switch. */
  openingsEnabled: boolean;
  stats: OpeningStat[];
  /** Stats the world holds but this opening switches off, named as the stat list names them. */
  disabledStats: string[];
  traits: OpeningTrait[];
  rolls: OpeningRollGroup[];
  /** The narration system prompt of turn one, as the shipped default prompts and settings assemble it.
   *  Empty for an Opening Narration, which sends no narration request. */
  system: string;
  /** The opening user turn — the cue, framed as play frames it. Empty for an Opening Narration. */
  user: string;
  totalTokens: number;
}

/** What the instrument reads while it has nothing to assemble — a Bench closed, or closed on another tab. */
export const EMPTY_OPENING: OpeningData = {
  pcName: null, location: null, locationName: '', startPool: 0, starts: [], personas: [], personaId: null, pool: [], selectedKey: null,
  opening: { kind: DEFAULT_OPENING.kind, text: '' }, openingsEnabled: true,
  stats: [], disabledStats: [], traits: [], rolls: [], system: '', user: '', totalTokens: 0,
};

/** What a fresh game as the lens PC stands on at turn one: the traits in force, the stats they settle, and
 *  the starting location — the three sources the opening pins come from. */
interface OpeningStart {
  active: Trait[];
  settled: PlayerStat[];
  seeded: PlayerStat[];
  /** The random pool play draws the start from. */
  pool: GameLocation[];
  /** The author's chosen member of `pool`, or its first. */
  location: GameLocation | null;
}

function openingStart(world: OpeningWorld, lens: BenchLens, startLocationId?: string | null): OpeningStart {
  const active = lensActiveTraits(world, lens);
  const locations = world.locations ?? [];
  const flagged = startingLocations(locations);
  const pool = flagged.length > 0 ? flagged : locations;
  const location = pool.find((l) => l.id === startLocationId) ?? pool[0] ?? null;
  return { active, ...settleOpeningStats(world, active), pool, location };
}

/** The pins the fresh game opens under, from every source — the active traits (a default trait's pin binds
 *  every playthrough, not just the lens PC's) and the cast's owned defaults, the starting location, the band each settled stat lands in,
 *  and the value pins those and `rolls` settle — through the same collector Enter World runs. */
const openingPins = (world: OpeningWorld, start: OpeningStart, rolls: PlaceholderRolls): Record<string, string> =>
  collectPins({
    traits: lensPinTraits(world, start.active), location: start.location, stats: start.settled,
    placeholders: allPlaceholders(world), rolls,
  });

/** Every text any source pins a placeholder to — walked beside the rolls, exactly as Enter World walks them. */
const openingPinTexts = (world: OpeningWorld): Record<string, string[]> =>
  allPinTexts({
    traits: world.traits, entities: world.entities, locations: world.locations, stats: world.stats, placeholders: allPlaceholders(world),
  });

/**
 * Roll every wildcard placement a fresh game would prime, keeping whatever `existing` already holds — the
 * exact pass Enter World runs, over the same field list and the same pins.
 */
export function primeOpeningRolls(
  world: OpeningWorld,
  existing: PlaceholderRolls = {},
  pick?: PlaceholderPick,
): PlaceholderRolls {
  const placeholders = allPlaceholders(world);
  const pinTexts = openingPinTexts(world);
  const rolled = primeRolls(placeholders, [...chipBearingTexts(world), ...valuePinRollChips(placeholders)], existing, pick, pinTexts);
  // Each bearer's trait text again through its copies, as Enter World primes it.
  return bearerPriming(bearerWorldOf(world), [], world.placeholders ?? []).copyTexts
    .reduce((rolls, { texts, copies }) => primeRolls(placeholders, texts, rolls, pick, pinTexts, copies), rolled);
}

/**
 * Draw fresh values for every unpinned placeholder, leaving pinned ones' frozen rolls alone — a pin masks
 * its roll for as long as the trait is active, so rerolling underneath it would change nothing visible and
 * silently lose the value the pin is hiding.
 */
export function rerollOpeningRolls(
  world: OpeningWorld,
  lens: BenchLens,
  previous: PlaceholderRolls,
  pick?: PlaceholderPick,
  startLocationId?: string | null,
): PlaceholderRolls {
  // Rolls are what is being redrawn, so a pin that only holds because of a roll is no reason to keep one;
  // value pins count here only where a source above them, or a sole value, fixes the pinner.
  const pins = openingPins(world, openingStart(world, lens, startLocationId), {});
  const placeholders = allPlaceholders(world);
  const texts = [...chipBearingTexts(world), ...valuePinRollChips(placeholders)];
  const pinTexts = openingPinTexts(world);
  // A pin's own chips are placements too, so a pinned one keeps its roll like any other.
  const { unique } = collectPlaceholderPlacements([...texts, ...Object.values(pinTexts).flat()]);
  const placementOwner = new Map(unique.map((u) => [u.placementId, u.id]));
  const keep = (entries: Record<string, string> | undefined, ownerOf: (key: string) => string | undefined) =>
    Object.fromEntries(Object.entries(entries ?? {}).filter(([key]) => {
      const owner = ownerOf(key);
      return owner != null && pins[owner] != null;
    }));
  // A Unique roll under a nested chip is keyed by its placement chain, whose last step is the placeholder's
  // own id; only a chain root is keyed by the bare placement id.
  const uniqueOwner = (key: string) => {
    const tail = key.slice(key.lastIndexOf('/') + 1);
    return tail === key ? placementOwner.get(key) : tail;
  };
  return primeRolls(placeholders, texts, {
    world: keep(previous.world, (id) => id),
    unique: keep(previous.unique, uniqueOwner),
  }, pick, pinTexts);
}

/** Chance that `draws` independent picks over `chances` (fractions summing to 1) repeat a value:
 *  1 − draws!·e₍draws₎(p), the elementary symmetric polynomial giving P(all distinct). */
function collisionChance(chances: number[], draws: number): number {
  const distinct = Array<number>(draws + 1).fill(0);
  distinct[0] = 1;
  for (const p of chances) {
    for (let k = draws; k >= 1; k--) distinct[k] += distinct[k - 1] * p;
  }
  let factorial = 1;
  for (let i = 2; i <= draws; i++) factorial *= i;
  return Math.min(1, Math.max(0, 1 - factorial * distinct[draws]));
}

/** The fresh game's starting stats: seeded exactly as a new game seeds them, then every active trait
 *  acquired in authored order — bounds derived, deltas applied, clamps allowed to bite. */
function settleOpeningStats(world: OpeningWorld, active: Trait[]): { settled: PlayerStat[]; seeded: PlayerStat[] } {
  const seeded = seedStatBases((world.stats ?? []).map((stat) => {
    const value = stat.value || stat.min || 0;
    return { ...stat, value, starting: stat.starting ?? value };
  }));
  let state: TraitRuntimeState = { stats: seeded, traits: [], disabledTraitIds: [], appliedValues: {} };
  for (const trait of active) {
    state = acquireTrait(state, trait, { traits: world.traits ?? [], groups: world.traitGroups ?? [] }).state;
  }
  return { settled: state.stats, seeded };
}

/** Every stat a fresh game as the lens PC starts with, settled, including any the PC switches off. */
export function settledOpeningStats(world: OpeningWorld, lens: BenchLens): PlayerStat[] {
  return settleOpeningStats(world, lensActiveTraits(world, lens)).settled;
}

/** What the author picked to look at: the persona, a start from the start pool and a row from its opening
 *  pool. */
export interface OpeningChoice {
  /** A world persona's id. Absent or unknown reads as None. */
  personaId?: string | null;
  startLocationId?: string | null;
  openingKey?: string | null;
}

/**
 * Everything the Opening instrument shows for `lens` and the frozen `rolls`. Only the lens PC matters here —
 * a fresh game begins at a starting location, wherever the lens is standing. `choice` picks the start and
 * the opening; each falls back to the first.
 */
export function buildOpening(
  world: OpeningWorld,
  lens: BenchLens,
  rolls: PlaceholderRolls,
  choice: OpeningChoice = {},
): OpeningData {
  const placeholders = allPlaceholders(world);
  const start = openingStart(world, lens, choice.startLocationId);
  const { active, settled, seeded, location } = start;
  const pins = openingPins(world, start, rolls);
  const resolve = (text: string, copies?: CopyLookup) => resolvePlaceholders(text, { placeholders, rolls, pins, copies });
  // Each cast entity's trait text reads its own copies.
  const blueprints = { placeholders: world.placeholders ?? [], entities: world.entities ?? [] };
  const resolveEntity = (entity: Entity, text: string) => resolveEntityText(entity, text, {
    placeholders, rolls, pins, copies: copyLookup(blueprints, readerFor(undefined, entity, false)),
  });

  const seededValue = new Map(seeded.map((stat) => [stat.id, stat.value]));
  const enabled = activeStatEnabled(world.stats ?? [], active);
  const liveStats = enabledStats(settled, enabled);

  const stats = liveStats.map((stat): OpeningStat => {
    const descriptor = activeDescriptor(stat, stat.value);
    const descriptors = stat.descriptors ?? [];
    return {
      id: stat.id,
      name: resolve(stat.name),
      type: stat.type,
      min: stat.min,
      max: stat.max,
      value: stat.value,
      traitShift: stat.value - (seededValue.get(stat.id) ?? stat.value),
      descriptor: descriptor?.description ?? null,
      descriptors,
      thresholdUnit: stat.thresholdUnit,
      uncovered: descriptors.length > 0 && !descriptor,
    };
  });

  const placeholderName = new Map(placeholders.map((p) => [p.id, p.name || p.id]));
  const statName = new Map((world.stats ?? []).map((s) => [s.id, s.name || s.id]));
  const traits = active.map((trait): OpeningTrait => ({
    id: trait.id,
    name: resolveLensText(trait.name, placeholders, pins, lens.copies),
    isPc: trait.id === lens.pc?.id,
    // A pin's text is chip-capable, so it reads through the same rolls as everything else here.
    pins: (trait.placeholderPins ?? [])
      .filter((pin) => pin.placeholderId && pin.value)
      .map((pin) => ({ placeholder: placeholderName.get(pin.placeholderId) ?? pin.placeholderId, value: resolve(pin.value) })),
    toggles: (trait.statToggles ?? []).map((toggle) => ({
      stat: statName.get(toggle.statId) ?? toggle.statId,
      enabled: toggle.enabled,
    })),
  }));

  // A pool option as the row prints it. Only the drawn value resolves; an option the roll passed over reads
  // as the placeholder it references, or as its own text described, so no branch shows invented text.
  const poolOption = (text: string, chance: number): OpeningPoolOption => {
    const lone = lonePlaceholderToken(text);
    const ref = lone ? decodePlaceholderToken(lone)?.id : undefined;
    const target = ref ? placeholderName.get(ref) : undefined;
    if (ref && target) return { value: target, chance, reference: ref };
    return { value: describePlaceholders(text, placeholders), chance };
  };

  // The wildcards a fresh game rolls, in placeholder order: every placement the priming pass covers.
  const { worldIds, unique } = collectPlaceholderPlacements(chipBearingTexts(world));
  const rollGroups = placeholders.flatMap((ph): OpeningRollGroup[] => {
    if (ph.values.length < 2) return [];
    const uniquePlacements = unique.filter((u) => u.id === ph.id);
    if (!worldIds.has(ph.id) && uniquePlacements.length === 0) return [];
    const chances = placeholderChances(ph);
    const pinned = pins[ph.id];
    const worldValue = rolls.world?.[ph.id];
    // A stored roll is the value's own text, chips and all; what the row shows is what play would show.
    return [{
      placeholderId: ph.id,
      name: ph.name || ph.id,
      chances: ph.values.map((value) => poolOption(value.text, chances[value.id])),
      ...(pinned != null ? { pinnedValue: resolve(pinned) } : {}),
      ...(worldIds.has(ph.id) ? { worldValue: worldValue != null ? resolve(worldValue) : undefined } : {}),
      uniqueValues: uniquePlacements.flatMap((u) => {
        const value = rolls.unique?.[u.placementId];
        return value != null ? [resolve(value)] : [];
      }),
      ...(uniquePlacements.length >= 2 && pinned == null
        ? { collisionChance: collisionChance(ph.values.map((v) => chances[v.id] / 100), uniquePlacements.length) * 100 }
        : {}),
    }];
  });

  // The turn-one assembly, through the game's own builders: the chip values of this opening's scene, the
  // narration prompt over them with the real lore scan, and the cue framed as the opening user turn.
  // The scene has no notes and no clock yet, so both chips read as the uniform "none".
  const ctx = chipValues(authoredChipScene(world, {
    location,
    activeTraitIds: active.map((t) => t.id),
    stats: liveStats,
    resolve,
    resolveEntity,
  }));
  // The opening pool for this persona at this start, as new-game play reads it. The Bench has no library, so
  // the persona is a world entity or None; picked library entities are a player choice.
  const worldEntities = world.entities ?? [];
  const personas = worldEntities.filter((e) => e.persona && !e.customPersona);
  const personaId = personas.find((e) => e.id === choice.personaId)?.id ?? null;
  const { persona, cast, customPersona, pool: entries } = newGamePool({
    pick: { ref: personaId ? { source: 'world', entityId: personaId } : { source: 'none' } },
    worldEntities, overview: world.worldOverview, locations: world.locations ?? [], startingLocationId: location?.id, picked: [],
  });
  const chances = poolChances(entries);
  const entityName = new Map([...cast, persona?.entity, customPersona].flatMap((e) => (e ? [[e.id, e.name] as const] : [])));
  const locationName = new Map((world.locations ?? []).map((l) => [l.id, l.name]));
  // The Player Name chip names the played entity: the persona, or the Custom Persona entity under None. A
  // world with neither reads "you".
  const player = { name: persona ? resolve(persona.entity.name) : undefined, kind: 'opening' as const };
  const openingText = (text: string, owner: Entity | null = null) =>
    resolveEntityText(owner, text, { placeholders, rolls, pins, player });
  const pool = entries.map((entry, i): OpeningPoolRow => ({
    key: poolKey(entry),
    ownerName: entry.ownerId == null ? null : resolve(entityName.get(entry.ownerId) ?? entry.ownerId),
    locationName: entry.locationId == null ? null : resolve(locationName.get(entry.locationId) ?? entry.locationId),
    self: !!entry.opening.self,
    kind: entry.opening.kind,
    text: openingText(entry.opening.text, openingOwner(entry.ownerId, cast, persona, customPersona)),
    chance: chances[i],
  }));
  const chosen = pool.find((row) => row.key === choice.openingKey) ?? pool[0] ?? null;
  const opening = chosen
    ? { kind: chosen.kind, text: chosen.text }
    : { kind: DEFAULT_OPENING.kind, text: openingText(DEFAULT_OPENING.text) };

  // An Opening Narration is page one: play shows it and sends no narration request.
  const narrated = opening.kind === 'narration';
  const cue = opening.text;
  const system = narrated ? '' : buildNarrationPrompt({
    template: defaultSystemPrompt,
    ctx,
    action: cue,
    history: [],
    dictionary: scannedEntries(world),
    actionVec: null,
    semanticLore: false,
    embedVectors: new Map(),
    language: 'English',
    paragraphLimit: 'auto',
    maxTokens: DEFAULT_MAX_TOKENS,
    markdownOutput: true,
    sectionStyle: 'markdown',
    resolvePH: resolve,
  }).prompt;
  const user = narrated ? '' : renderPromptTemplate(defaultNarrationUserPrompt, { '<PLAYER ACTION>': cue });

  return {
    pcName: lens.pc ? resolveLensText(lens.pc.name, placeholders, pins, lens.copies) : null,
    location,
    locationName: location ? resolve(location.name) : '',
    startPool: start.pool.length,
    starts: start.pool.map((l) => ({ id: l.id, name: resolve(l.name) })),
    personas: personas.map((e) => ({ id: e.id, name: resolve(e.name) })),
    personaId,
    pool,
    selectedKey: chosen?.key ?? null,
    opening,
    openingsEnabled: openingsEnabled(world.worldOverview, world.entities),
    stats,
    disabledStats: (world.stats ?? [])
      .filter((stat) => !enabled[stat.id])
      .map((stat) => resolve(stat.name || stat.id)),
    traits,
    rolls: rollGroups,
    system,
    user,
    totalTokens: estimateTokens(system.length + user.length),
  };
}
