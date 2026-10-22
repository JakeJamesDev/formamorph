import type { Entity, GameLocation, Placeholder, Stat, Trait, WorldOverview } from '@/types';
import type { ResolvedPersona } from '../persona';
import { authoredChipScene, type AuthoredWorld } from './authoredScene';
import { ownerStatParts } from '../statContext';
import { seedNewGameStats } from '../traitRuntime';
import type { ChipScene } from './chipScene';

// Generic on purpose, so no one takes the preview for their own world. Code-only, never in the library.

const overview: WorldOverview = {
  name: 'Sample Coast',
  description: '',
  author: '',
  thumbnail: null,
  bgm: null,
  systemPrompt: 'A quiet stretch of coast where the tide leaves more behind than it takes. People here trade in salvage and rumor, and nobody asks where either came from.',
  tags: [],
};

// The Landing's children come first: destination order follows the order each parent first appears.
const boathouse: GameLocation = {
  id: 'boathouse', name: 'The Boathouse', parentId: 'landing',
  aiDescription: 'Low, tar-black, its door open on darkness.',
  aiSummary: 'A dark, tar-black shed.',
};
const tidePools: GameLocation = {
  id: 'tide-pools', name: 'The Tide Pools', parentId: 'landing',
  aiDescription: 'Shallow basins the ebb has left standing.',
  aiSummary: 'Shallow basins.',
};
const landing: GameLocation = {
  id: 'landing', name: 'The Landing', parentId: 'sample-town', isStarting: true,
  aiDescription: 'A crescent of wet stone below the town, littered with rope and broken crates. One lamp burns at the head of the stair. The water is further out than it should be.',
  aiSummary: 'A stone shore below the town, lamplit, the tide well out.',
};
const causeway: GameLocation = {
  id: 'causeway', name: 'The Causeway', parentId: 'sample-town',
  aiDescription: 'A spit of stone that floods at high tide.',
  aiSummary: 'A stone path, flooded at high tide.',
};
const sampleTown: GameLocation = {
  id: 'sample-town', name: 'Sample Town',
  aiDescription: "A settlement of perhaps two hundred, built up the slope in terraces so no house stands directly above another's chimney.",
  aiSummary: 'A small terraced settlement above the water.',
};

/** A one-value placeholder, which reads the same on every draw. */
const fixed = (id: string, name: string, text: string): Placeholder => ({ id, name, values: [{ id: `${id}-1`, text }] });

const stat = (id: string, name: string, value: number, description: string, bands: [number, string][]): Stat => ({
  id, name, type: 'number', description, min: 0, max: 100, value, regen: 0,
  descriptors: bands.map(([threshold, word], i) => ({ id: `${id}-${i}`, threshold, description: word })),
});

const trait = (id: string, name: string, aiDescription: string): Trait => ({
  id, name, aiDescription, isDefault: true, statChanges: [],
});

// Wren owns one stat and one trait, so the Entities chip's Only With and Include rows show lines in the sample.
const wren: Entity = {
  id: 'wren', name: 'Wren', locations: ['landing'], placeholders: [fixed('wren-pole', 'Pole', 'a hooked ash pole')],
  aiDescription: 'The lamp-keeper, gray-haired and unhurried, who has watched this shore longer than anyone will admit. Carries a hooked pole she uses for everything but its purpose.',
  aiSummary: 'The unhurried lamp-keeper.',
  traits: [trait('wren-night-watch', 'Night Watch', 'Keeps the lamp lit through the dark hours, whatever the weather.')],
  stats: [stat('wren-patience', 'Patience', 70, 'How long she waits on a stranger before she speaks.', [[30, 'Short'], [80, 'Measured'], [100, 'Endless']])],
};
const gull: Entity = {
  id: 'gull', name: 'a gull', locations: ['landing'],
  aiDescription: 'Too fat to be wild, waiting on the post as if owed something.',
  aiSummary: 'Fat, waiting, owed something.',
};
const bell: Entity = {
  id: 'bell', name: 'Bell', locations: ['boathouse'],
  aiDescription: 'A boat-mender working by feel in the dark of the boathouse, talking to the hull.',
  aiSummary: 'A boat-mender working in the dark.',
  traits: [trait('bell-by-touch', 'By Touch', 'Reads a hull with his fingers, and needs no light to find a leak.')],
  stats: [stat('bell-focus', 'Focus', 60, 'How steady his hands stay on a repair.', [[30, 'Scattered'], [80, 'Steady'], [100, 'Absorbed']])],
};
const harrow: Entity = {
  id: 'harrow', name: 'Harrow', locations: ['sample-town'],
  aiDescription: 'The man who sells maps in Sample Town, and is not currently at his stall.',
  aiSummary: 'The map-seller, absent from his stall.',
  traits: [trait('harrow-no-questions', 'No Questions', 'Sells a map to anyone, and never asks where it will be used.')],
  stats: [stat('harrow-eagerness', 'Eagerness', 45, 'How badly he wants the next sale.', [[30, 'Idle'], [70, 'Keen'], [100, 'Desperate']])],
};

// Known In the whole town, so the Known scope lists her at the Landing while she stands on the Causeway.
const ossery: Entity = {
  id: 'ossery', name: 'Mother Ossery', locations: ['causeway'], knownIn: ['sample-town'],
  aiDescription: 'The toll-keeper of the causeway, who has outlived three harbormasters and buried two of them.',
  aiSummary: 'The causeway toll-keeper everyone in town knows of.',
  traits: [trait('ossery-long-memory', 'Long Memory', 'Remembers every unpaid toll, and who it was owed by.')],
  stats: [stat('ossery-temper', 'Temper', 35, 'How close she is to closing the gate.', [[30, 'Calm'], [70, 'Short'], [100, 'Furious']])],
};

/** The sample world the Settings preview renders when no game runs. */
const SAMPLE_WORLD: AuthoredWorld = {
  worldOverview: overview,
  stats: [
    stat('health', 'Health', 82, 'How much punishment the body still has in it.', [[30, 'Badly hurt'], [90, 'Bruised'], [100, 'Unhurt']]),
    stat('resolve', 'Resolve', 40, 'The will to keep going when it stops being sensible.', [[25, 'Breaking'], [50, 'Fraying'], [100, 'Steady']]),
    stat('standing', 'Standing', 15, 'How the coast reckons the traveler.', [[20, 'A stranger'], [60, 'Known'], [100, 'Trusted']]),
  ],
  locations: [boathouse, tidePools, landing, causeway, sampleTown],
  entities: [wren, gull, bell, harrow, ossery],
  traits: [
    trait('light-sleeper', 'Light Sleeper', 'Wakes at the smallest sound, and is never quite rested.'),
    trait('salvagers-eye', "Salvager's Eye", 'Spots the worth in a heap of junk, and rarely says so out loud.'),
  ],
  dictionaries: [{
    id: 'sample-lore', name: 'Sample Lore', placeholders: [fixed('glass-color', 'Glass Color', 'sea green')], entries: [
      {
        id: 'salt-glass', name: 'Salt Glass', key: ['salt glass'],
        value: 'The green-tinted glass the tide grinds smooth. Locals string it over doorways; nobody agrees on what it wards off.',
      },
      {
        id: 'long-ebb', name: 'The Long Ebb', key: ['ebb'], position: 'before',
        value: 'The season when the water pulls back past the old pilings and the wrecks show. It is happening now.',
      },
    ],
  }],
  placeholders: [fixed('weather', 'Weather', 'a thin gray drizzle'), fixed('tide', 'Tide', 'far out and turning')],
};

/** The sample world's dictionaries, for a reader that takes them beside the scene. */
export const sampleDictionaries = () => SAMPLE_WORLD.dictionaries ?? [];

/** The sample world as authored, for a reader that builds its own state from it. */
export const sampleWorld = (): AuthoredWorld => SAMPLE_WORLD;

/** The player the sample plays: a library persona, so no known-person line. It owns one trait and one
 *  stat, so the preview shows the block as an authored persona fills it. */
const travelerTrait = trait('false-map', 'False Map', 'Carries a chart that lies, and knows which parts.');
const travelerStat = stat('nerve', 'Nerve', 55, 'How steady the hands stay when the water rises.', [[30, 'Shaking'], [70, 'Steady'], [100, 'Unshakable']]);
const persona: ResolvedPersona = {
  source: 'library',
  entity: {
    id: 'traveler', name: 'Traveler', pronouns: 'they/them',
    aiDescription: 'Salt-stained and slow to speak, carrying a map they no longer trust.',
    aiSummary: 'A quiet, salt-stained wanderer.',
    traits: [travelerTrait],
    stats: [travelerStat],
  },
};

/** The library persona the sample plays. */
export const samplePersona = (): Entity => persona.entity;

/**
 * The sample world as a Chip Scene: its authored opening, plus the player state a world alone lacks — a
 * persona with its own trait and stat, notes, a clock, and Wren as the one character who has spoken.
 */
export function sampleChipScene(): ChipScene {
  const authored = authoredChipScene(SAMPLE_WORLD);
  const travelerStats = seedNewGameStats([travelerStat]);
  return {
    ...authored,
    persona,
    playerName: persona.entity.name,
    ownedTraits: { ...authored.ownedTraits, [persona.entity.id]: [travelerTrait.id] },
    ownedStats: { ...authored.ownedStats, [persona.entity.id]: travelerStats },
    playedStats: ownerStatParts([persona.entity], { [persona.entity.id]: travelerStats }),
    inSceneIds: [wren.id],
    notes: 'Traveler is looking for the person who sold them a false map.',
    // Day 3, evening on the default calendar.
    time: { elapsed: 58 },
  };
}
