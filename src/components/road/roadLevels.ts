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
    line: 'Keeps your recent scenes in mind',
    look: [NO_WAVE, 'arms-no-thinking', 'mouth-small-o'],
    perks: (name) => ['Formamorph AI, ready to play with no setup', 'A weekly AI allowance', ...sharedPerks(name('supporter'))],
  },
  {
    tier: 'supporter_plus',
    fallbackName: 'Flame',
    lit: 7,
    fireWidth: 150,
    lightRadius: 400,
    line: 'Keeps whole chapters in mind',
    look: [NO_WAVE, 'arms-thinking', 'eyes-wide', 'mouth-small-o'],
    perks: (name) => [
      `Formamorph AI, with twice ${name('supporter')}'s memory, so it keeps more of your story in mind`,
      'A larger weekly AI allowance',
      ...sharedPerks(name('supporter_plus')),
    ],
  },
  {
    tier: 'supporter_top',
    fallbackName: 'Beacon',
    lit: 12,
    fireWidth: 196,
    lightRadius: 900,
    line: 'Keeps the long road behind you in mind',
    look: [NO_WAVE, 'arms-no-thinking', 'eyes-heart', 'mouth-open'],
    perks: (name) => [
      `Formamorph AI, with four times ${name('supporter')}'s memory, for long stories`,
      'Our largest weekly AI allowance',
      ...sharedPerks(name('supporter_top')),
    ],
  },
];

export const DEFAULT_ROAD_TIER: SupporterTier = 'supporter_plus';

export const roadLevel = (tier: SupporterTier): RoadLevel => ROAD_LEVELS.find((level) => level.tier === tier) ?? ROAD_LEVELS[0];

/** The side-by-side block's text, placeholders for now. */
export const ROAD_SAMPLES = {
  demo: { label: 'Demo AI', text: 'A sample from the Demo AI goes here.' },
  hosted: { label: 'Formamorph AI', text: 'A sample from Formamorph AI goes here.' },
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
