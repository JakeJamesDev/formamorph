/**
 * The Opening instrument's data: what a fresh game as the lens PC actually looks like — every stat settled
 * at its real turn-one value, the traits and pins in force, the wildcard rolls with their true odds, and the
 * first prompt exactly as the model receives it.
 *
 * Everything is computed by the game's own machinery: stats settle through `traitRuntime` (the same seeding,
 * clamping and bound derivation a new game runs), chips resolve through `resolvePlaceholders` with the
 * active traits' pins, and the first prompt is `buildNarrationPrompt` over `authoredPreviewValues` — the
 * assembly a real opening turn performs. A second implementation of any of these could disagree with play,
 * which would make the instrument a liar.
 *
 * Prompts and generation settings are global settings the editor cannot read, so the shipped defaults stand
 * in for them — the AI Context instrument's precedent.
 *
 * Pure and world-shaped: no React, no storage, no world mutation.
 */
import {
  defaultNarrationUserPrompt, defaultSystemPrompt, OPENING_SCENE_CUE,
} from '@/components/game/GamePrompts';
import { DEFAULT_MAX_TOKENS } from '@/contexts/settingsDefaults';
import { authoredPreviewValues } from '@/lib/authoredPreviewValues';
import { estimateTokens } from '@/lib/memoryUtils';
import {
  collectPlaceholderPlacements, placeholderChances, primeRolls, resolvePlaceholders,
  type PlaceholderPick,
} from '@/lib/placeholders';
import { NONE_PLACEHOLDER } from '@/lib/promptFallbacks';
import { renderPromptTemplate } from '@/lib/promptTemplate';
import { activeDescriptor } from '@/lib/statContext';
import { activePlaceholderPins, activeStatEnabled, enabledStats } from '@/lib/traitEffects';
import { acquireTrait, seedStatBases, type TraitRuntimeState } from '@/lib/traitRuntime';
import { buildNarrationPrompt } from '@/lib/turnPipeline/narrationPrompt';
import { startingLocations } from '@/lib/startingLocation';
import type { GameLocation, PlaceholderRolls, PlayerStat, Stat, StatDescriptor, Trait } from '@/types';
import { lensActiveTraits, resolveLensText, type BenchLens } from './lens';
import { chipBearingTexts, type RuleWorld } from './rules';
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

/** One wildcard a fresh game rolls: its draws, each value's true odds, and the repeat risk. */
export interface OpeningRollGroup {
  placeholderId: string;
  name: string;
  /** Each value's chance of being drawn, in value order, as percentages. */
  chances: { value: string; chance: number }[];
  /** An active trait's pin masking every chip of this placeholder — then the rolls below never show. */
  pinnedValue?: string;
  /** The one shared roll World-mode chips read. */
  worldValue?: string;
  /** The per-placement rolls of Unique-mode chips, in placement order. */
  uniqueValues: string[];
  /** Chance at least two of the unique placements draw the same value — independent draws repeat. */
  collisionChance?: number;
}

/** Everything the Opening instrument shows for one lens. */
export interface OpeningData {
  pcName: string | null;
  location: GameLocation | null;
  locationName: string;
  /** How many places the fresh game might start at — above 1, play picks one at random. */
  startPool: number;
  stats: OpeningStat[];
  /** Stats the world holds but this opening switches off, named as the stat list names them. */
  disabledStats: string[];
  traits: OpeningTrait[];
  rolls: OpeningRollGroup[];
  /** The narration system prompt of turn one, as the shipped default prompts and settings assemble it. */
  system: string;
  /** The opening user turn — the cue, framed as play frames it. */
  user: string;
  totalTokens: number;
}

/** What the instrument reads while it has nothing to assemble — a Bench closed, or closed on another tab. */
export const EMPTY_OPENING: OpeningData = {
  pcName: null, location: null, locationName: '', startPool: 0,
  stats: [], disabledStats: [], traits: [], rolls: [], system: '', user: '', totalTokens: 0,
};

/** The pins every active trait imposes — the fresh game's, not just the lens PC's, because a default
 *  trait's pin binds every playthrough. */
const openingPins = (world: OpeningWorld, lens: BenchLens): Record<string, string> =>
  activePlaceholderPins(lensActiveTraits(world, lens));

/**
 * Roll every wildcard placement a fresh game would prime, keeping whatever `existing` already holds — the
 * exact pass Enter World runs, over the same field list.
 */
export function primeOpeningRolls(
  world: OpeningWorld,
  existing: PlaceholderRolls = {},
  pick?: PlaceholderPick,
): PlaceholderRolls {
  return primeRolls(world.placeholders ?? [], chipBearingTexts(world), existing, pick);
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
): PlaceholderRolls {
  const pins = openingPins(world, lens);
  const texts = chipBearingTexts(world);
  const { unique } = collectPlaceholderPlacements(texts);
  const placementOwner = new Map(unique.map((u) => [u.placementId, u.id]));
  const keep = (entries: Record<string, string> | undefined, ownerOf: (key: string) => string | undefined) =>
    Object.fromEntries(Object.entries(entries ?? {}).filter(([key]) => {
      const owner = ownerOf(key);
      return owner != null && pins[owner] != null;
    }));
  return primeRolls(world.placeholders ?? [], texts, {
    world: keep(previous.world, (id) => id),
    unique: keep(previous.unique, (placementId) => placementOwner.get(placementId)),
  }, pick);
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

/**
 * Everything the Opening instrument shows for `lens` and the frozen `rolls`. Only the lens PC matters here —
 * a fresh game always begins at the world's starting location, wherever the lens is standing.
 */
export function buildOpening(world: OpeningWorld, lens: BenchLens, rolls: PlaceholderRolls): OpeningData {
  const placeholders = world.placeholders ?? [];
  const locations = world.locations ?? [];
  const active = lensActiveTraits(world, lens);
  const pins = openingPins(world, lens);
  const resolve = (text: string) => resolvePlaceholders(text, { placeholders, rolls, pins });

  // The random pool play draws the start from; shown deterministically as its first member.
  const flagged = startingLocations(locations);
  const pool = flagged.length > 0 ? flagged : locations;
  const location = pool[0] ?? null;

  const { settled, seeded } = settleOpeningStats(world, active);
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
      uncovered: descriptors.length > 0 && !descriptor,
    };
  });

  const placeholderName = new Map(placeholders.map((p) => [p.id, p.name || p.id]));
  const statName = new Map((world.stats ?? []).map((s) => [s.id, s.name || s.id]));
  const traits = active.map((trait): OpeningTrait => ({
    id: trait.id,
    name: resolveLensText(trait.name, placeholders, pins),
    isPc: trait.id === lens.pc?.id,
    pins: (trait.placeholderPins ?? [])
      .filter((pin) => pin.placeholderId && pin.value)
      .map((pin) => ({ placeholder: placeholderName.get(pin.placeholderId) ?? pin.placeholderId, value: pin.value })),
    toggles: (trait.statToggles ?? []).map((toggle) => ({
      stat: statName.get(toggle.statId) ?? toggle.statId,
      enabled: toggle.enabled,
    })),
  }));

  // The wildcards a fresh game rolls, in placeholder order: every placement the priming pass covers.
  const { worldIds, unique } = collectPlaceholderPlacements(chipBearingTexts(world));
  const rollGroups = placeholders.flatMap((ph): OpeningRollGroup[] => {
    if (ph.values.length < 2) return [];
    const uniquePlacements = unique.filter((u) => u.id === ph.id);
    if (!worldIds.has(ph.id) && uniquePlacements.length === 0) return [];
    const chances = placeholderChances(ph);
    const pinned = pins[ph.id];
    return [{
      placeholderId: ph.id,
      name: ph.name || ph.id,
      chances: ph.values.map((value) => ({ value, chance: chances[value] })),
      ...(pinned != null ? { pinnedValue: pinned } : {}),
      ...(worldIds.has(ph.id) ? { worldValue: rolls.world?.[ph.id] } : {}),
      uniqueValues: uniquePlacements.flatMap((u) => {
        const value = rolls.unique?.[u.placementId];
        return value != null ? [value] : [];
      }),
      ...(uniquePlacements.length >= 2 && pinned == null
        ? { collisionChance: collisionChance(ph.values.map((v) => chances[v] / 100), uniquePlacements.length) * 100 }
        : {}),
    }];
  });

  // The turn-one assembly, through the game's own builders: the preview values scoped to this opening, the
  // narration prompt over them with the real lore scan, and the cue framed as the opening user turn.
  // <NOTES> and <TIME> are turn-state a fresh game does not have yet, so both read as the uniform "none".
  const ctx = {
    ...authoredPreviewValues(world, {
      location,
      activeTraitIds: active.map((t) => t.id),
      stats: liveStats,
      resolve,
    }),
    '<NOTES>': NONE_PLACEHOLDER,
    '<TIME>': NONE_PLACEHOLDER,
  };
  const { prompt: system } = buildNarrationPrompt({
    template: defaultSystemPrompt,
    ctx,
    action: OPENING_SCENE_CUE,
    playerNotes: '',
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
  });
  const user = renderPromptTemplate(defaultNarrationUserPrompt, { '<PLAYER ACTION>': OPENING_SCENE_CUE });

  return {
    pcName: lens.pc ? resolveLensText(lens.pc.name, placeholders, pins) : null,
    location,
    locationName: location ? resolve(location.name) : '',
    startPool: pool.length,
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
