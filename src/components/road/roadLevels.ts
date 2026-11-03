import { useCallback } from 'react';
import type { MascotAssetName } from '@/lib/formaquestion/mascot';
import { useTierPrice, useTierTitle } from '@/lib/tierNames';
import type { SupporterTier } from '@/types';

/** One level of support, as the scene draws it. */
export interface RoadLevel {
  readonly tier: SupporterTier;
  /** The name until the server gives one, so the levels can always be told apart. */
  readonly fallbackName: string;
  /** Story moments the light reaches, newest first. */
  readonly lit: number;
  /** The fire's width in stage units. */
  readonly fireWidth: number;
  /** The light's radius in stage units. */
  readonly lightRadius: number;
  readonly line: string;
  /** Morphie's layers over her base, bottom first. */
  readonly look: readonly MascotAssetName[];
  readonly perks: (name: (tier: SupporterTier) => string) => readonly string[];
}

const NO_WAVE: MascotAssetName = 'arms-no-wave';

const sharedPerks = (badge: string): readonly string[] => [
  'Supporter-only Mascots',
  `A ${badge} badge and name color, and a place on the Supporters wall`,
];

export const ROAD_LEVELS: readonly RoadLevel[] = [
  {
    tier: 'supporter',
    fallbackName: 'Spark',
    lit: 3,
    fireWidth: 76,
    lightRadius: 210,
    line: 'Room for your world and a long story',
    look: [NO_WAVE, 'arms-no-thinking', 'mouth-small-o'],
    perks: (name) => ['A weekly allowance of turns', 'Formamorph AI, ready to play with no setup', ...sharedPerks(name('supporter'))],
  },
  {
    tier: 'supporter_plus',
    fallbackName: 'Flame',
    lit: 7,
    fireWidth: 150,
    lightRadius: 400,
    line: 'More turns, and room for a large world and a much longer story',
    look: [NO_WAVE, 'arms-thinking', 'eyes-wide', 'mouth-small-o'],
    perks: (name) => [
      'More turns each week',
      `Formamorph AI, with twice ${name('supporter')}'s memory, so a large world still has room for your story`,
      ...sharedPerks(name('supporter_plus')),
    ],
  },
  {
    tier: 'supporter_top',
    fallbackName: 'Beacon',
    lit: 12,
    fireWidth: 196,
    lightRadius: 900,
    line: 'The most turns, and room for the largest worlds and the longest stories',
    look: [NO_WAVE, 'arms-no-thinking', 'eyes-heart', 'mouth-open'],
    perks: (name) => [
      'The most turns each week',
      `Formamorph AI, with four times ${name('supporter')}'s memory, for the largest worlds and the longest stories`,
      ...sharedPerks(name('supporter_top')),
    ],
  },
];

/** True of every level, because a larger window holds more summaries of older turns, not more whole turns. */
export const ROAD_SHARED_LINE = 'Every level keeps the latest scenes word for word';

export const DEFAULT_ROAD_TIER: SupporterTier = 'supporter_plus';

export const roadLevel = (tier: SupporterTier): RoadLevel => ROAD_LEVELS.find((level) => level.tier === tier) ?? ROAD_LEVELS[0];

/** One Emberwatch moment from the same prompt: real replies, unedited. */
export const ROAD_SAMPLES = {
  action: "I press him on what he means by the \"unseen thing.\"",
  demo: {
    label: 'Demo AI',
    text: "\"What is that unseen thing you speak of?\" you ask, pushing through the deliberate vagueness of his answer. You cannot accept technical compromise when the stakes are everything; you need to know what the thing was being persuaded into accepting.\n\nBlackwell hesitates again, the silence stretching thin and loud in the small space between the map and your combined scrutiny. He clearly knows this question is the pivot point—the place where engineering gives way to theology, and where his comfort as a captain ends.\n\nHe rubs the bridge of his nose, a brief, almost frustrated movement that you catch out of the corner of your eye. He knows the answer lies beyond the purview of the engineering logs; it resides in the founders' buried philosophy.\n\nHe glances back at the map, but his eyes are unfocused, seeing through the drawn lines to the foundation beneath.\n\n\"The unseen thing,\" he repeats slowly, choosing his words with painstaking care, \"is the *humility* required by the thing to accept its own insignificance against the vastness of what it once was.\"\n\nHe taps the inscription one last time, a definitive, heavy press that sinks the weight of his words into the brittle paper.\n\n\"It means the acceptance of its own small scale again. The quiet that comes when the king remembers he is merely dust under the mountain.\"",
  },
  hosted: {
    label: 'Formamorph AI',
    text: "\"The 'unseen thing'—what exactly do you mean by that?\" you ask, your voice sharpening with a scholar's demand for precision. You don't want riddles or poetic metaphors when the fate of the keep hangs on a technicality; you want the definition of the catalyst.\n\nBlackwell stiffens, his finger finally lifting from the map as if the paper had suddenly become hot. He looks at you, and for the first time, you see a flicker of genuine hesitation in the veteran soldier's eyes. He is not merely discussing a blueprint anymore; he is discussing a price.\n\nHe steps back from the table, creating a sliver of distance between you and the secrets of the founders. He crosses his arms, his lean frame casting a long shadow across the parchment.\n\n\"I mean that the machine cannot operate on its own,\" he says, his voice regaining its hardness. \"The resonance requires a focus. A tether. The 'unseen thing' is the presence of a living will to guide the transition—someone to stand at the center of that pressure and hold the door shut while the lock turns.\"\n\nHe lets out a short, mirthless huff of a laugh.\n\n\"The founders didn't write it plainly because they knew no one would volunteer for the role. It requires a sacrifice of presence, a willingness to be the bridge between the waking world and the deep sleep.\"",
  },
} as const;

/** A tier-to-name function: the server's name, else the level's own. */
export function useRoadLevelName(): (tier: SupporterTier) => string {
  const title = useTierTitle();
  return useCallback((tier) => title(tier) ?? roadLevel(tier).fallbackName, [title]);
}

const dollars = (cents: number): string => `$${cents % 100 === 0 ? cents / 100 : (cents / 100).toFixed(2)}`;

/** A tier-to-text function for the monthly price, null when the server gave no price. */
export function useRoadLevelPrice(): (tier: SupporterTier) => string | null {
  const price = useTierPrice();
  return useCallback((tier) => {
    const cents = price(tier);
    return cents === null ? null : `${dollars(cents)} a month`;
  }, [price]);
}
