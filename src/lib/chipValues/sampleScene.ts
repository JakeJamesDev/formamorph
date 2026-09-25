import type { Entity, GameLocation, Stat, Trait, WorldOverview } from '@/types';
import type { ResolvedPersona } from '../persona';
import { authoredChipScene, type AuthoredWorld } from './authoredScene';
import type { ChipScene } from './chipScene';

// Generic on purpose, so no one takes the preview for their own world. Code-only, never in the library.

const overview: WorldOverview = {
  name: 'Sample Coast',
  description: '',
  author: '',
  thumbnail: null,
  bgm: null,
  systemPrompt: 'A quiet stretch of coast where the tide leaves more behind than it takes. People here trade in salvage and rumor, and nobody asks where either came from.',
  use3DModel: false,
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

const wren: Entity = {
  id: 'wren', name: 'Wren', locations: ['landing'],
  aiDescription: 'The lamp-keeper, gray-haired and unhurried, who has watched this shore longer than anyone will admit. Carries a hooked pole she uses for everything but its purpose.',
  aiSummary: 'The unhurried lamp-keeper.',
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
};
const harrow: Entity = {
  id: 'harrow', name: 'Harrow', locations: ['sample-town'],
  aiDescription: 'The man who sells maps in Sample Town, and is not currently at his stall.',
  aiSummary: 'The map-seller, absent from his stall.',
};

const stat = (id: string, name: string, value: number, description: string, bands: [number, string][]): Stat => ({
  id, name, type: 'number', description, min: 0, max: 100, value, regen: 0,
  descriptors: bands.map(([threshold, word], i) => ({ id: `${id}-${i}`, threshold, description: word })),
});

const trait = (id: string, name: string, aiDescription: string): Trait => ({
  id, name, aiDescription, isDefault: true, statChanges: [],
});

/** The sample world the Settings preview renders when no game runs. */
const SAMPLE_WORLD: AuthoredWorld = {
  worldOverview: overview,
  stats: [
    stat('health', 'Health', 82, 'How much punishment the body still has in it.', [[30, 'Badly hurt'], [90, 'Bruised'], [100, 'Unhurt']]),
    stat('resolve', 'Resolve', 40, 'The will to keep going when it stops being sensible.', [[25, 'Breaking'], [50, 'Fraying'], [100, 'Steady']]),
    stat('standing', 'Standing', 15, 'How the coast reckons the traveler.', [[20, 'A stranger'], [60, 'Known'], [100, 'Trusted']]),
  ],
  locations: [boathouse, tidePools, landing, causeway, sampleTown],
  entities: [wren, gull, bell, harrow],
  traits: [
    trait('light-sleeper', 'Light Sleeper', 'Wakes at the smallest sound, and is never quite rested.'),
    trait('salvagers-eye', "Salvager's Eye", 'Spots the worth in a heap of junk, and rarely says so out loud.'),
  ],
  dictionaries: [{
    id: 'sample-lore', name: 'Sample Lore', entries: [
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
};

/** The sample world's lore books, for a reader that takes the dictionary beside the scene. */
export const sampleDictionaries = () => SAMPLE_WORLD.dictionaries ?? [];

/** The player the sample plays: a library persona, so no known-person line. */
const persona: ResolvedPersona = {
  source: 'library',
  entity: {
    id: 'traveler', name: 'Traveler', pronouns: 'they/them',
    aiDescription: 'Salt-stained and slow to speak, carrying a map they no longer trust.',
    aiSummary: 'A quiet, salt-stained wanderer.',
  },
};

/**
 * The sample world as a Chip Scene: its authored opening, plus the player state a world alone lacks — a
 * persona, notes, a clock, and Wren as the one character who has spoken.
 */
export function sampleChipScene(): ChipScene {
  return {
    ...authoredChipScene(SAMPLE_WORLD),
    persona,
    inSceneIds: [wren.id],
    notes: 'Traveler is looking for the person who sold them a false map.',
    // Day 3, evening on the default calendar.
    time: { elapsed: 58 },
  };
}
