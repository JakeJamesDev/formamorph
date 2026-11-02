import type { CSSProperties } from 'react';
import type { Layout } from './layout';
import type { CardPose } from './parts/GlassCard';

/** Where the cards of one scene sit: the subject card in front, the dimmed depth card behind it. */
export type CardPair = { front: CardPose; depth: CardPose };

/** A frame shot's two cards, per layout. Wide cards are 16:9; tall cards fill the width at 3:4. */
export const FRAME_CARDS: Record<Layout, CardPair> = {
  wide: {
    front: { width: 1360, height: 765, x: 150, y: -40, tilt: [-12, -6], lean: 3 },
    depth: { width: 1170, height: 658, x: -190, y: -140, tilt: [-18, -12], lean: 4 },
  },
  tall: {
    front: { width: 960, height: 1280, x: 0, y: -110, tilt: [-8, -4], lean: 3 },
    depth: { width: 820, height: 1093, x: -70, y: -330, tilt: [-14, -10], lean: 4 },
  },
};

/** The end card's two dimmed cards behind the wordmark: the library and the game. */
export const TITLE_CARDS: Record<Layout, readonly [CardPose, CardPose]> = {
  wide: [
    { width: 960, height: 540, x: -500, y: -200, tilt: [16, 12], lean: 4 },
    { width: 960, height: 540, x: 500, y: 230, tilt: [-16, -12], lean: 4 },
  ],
  tall: [
    { width: 860, height: 484, x: -110, y: -560, tilt: [10, 7], lean: 4 },
    { width: 860, height: 484, x: 110, y: 600, tilt: [-10, -7], lean: 4 },
  ],
};

/** A tall pill column's sides: inside the text margin (ruling Q70), with room for a pill's spring overshoot. */
const TALL_PILLS: CSSProperties = { left: 82, right: 82, alignItems: 'center' };

/** Where a frame shot's caption pills sit. */
export const CAPTION_PLACE: Record<Layout, CSSProperties> = {
  wide: { left: 120, bottom: 110, alignItems: 'flex-start' },
  tall: { ...TALL_PILLS, bottom: 170 },
};

/** The two cards of a stack, one above the other (tall) or side by side (wide), each with its own pill. */
export const STACK_CARDS: Record<Layout, readonly [CardPose, CardPose]> = {
  wide: [
    { width: 840, height: 630, x: -450, y: -40, tilt: [10, 6], lean: 3 },
    { width: 840, height: 630, x: 450, y: 20, tilt: [-10, -6], lean: 3 },
  ],
  tall: [
    { width: 960, height: 760, x: 0, y: -460, tilt: [-7, -4], lean: 4 },
    { width: 960, height: 760, x: 0, y: 385, tilt: [7, 4], lean: 2 },
  ],
};

/**
 * A growing stack's placement in a layout: each card, offset on the one before, a cascade (wide) or a column (tall),
 * and where each pill sits, on its card's bottom edge. A turn card's `panel` sits below it, never over it (ruling Q31),
 * and fits its text inside `padding`.
 */
export type StackPoses = Record<Layout, { cards: readonly CardPose[]; places: readonly CSSProperties[]; panel?: { pose: CardPose; padding: number } }>;

/** The turn card, then the stats card on it. */
export const TURN_STACK: StackPoses = {
  wide: {
    cards: [
      { width: 1200, height: 675, x: -280, y: -150, tilt: [-5, -3], lean: 2 },
      { width: 1200, height: 675, x: 290, y: 60, tilt: [-5, -3], lean: 2 },
    ],
    places: [{}, { right: 110, top: 855, alignItems: 'flex-end' }],
    panel: { pose: { width: 1100, height: 280, x: -280, y: 332, tilt: [-5, -3], lean: 2 }, padding: 40 },
  },
  tall: {
    cards: [
      { width: 900, height: 1200, x: 0, y: -280, tilt: [-4, -2], lean: 2 },
      { width: 960, height: 760, x: 0, y: 376, tilt: [4, 2], lean: 2 },
    ],
    places: [{}, { ...TALL_PILLS, top: 1683 }],
    // The caption line wraps to two lines at this width, and the panel's exit drift stays inside the margin.
    panel: { pose: { width: 790, height: 340, x: 0, y: 530, tilt: [-4, -2], lean: 2 }, padding: 44 },
  },
};

/** The entity card, then the chat card on it. The tall chat card is squarer, so the whole column fits. */
export const ENTITY_STACK: StackPoses = {
  wide: {
    cards: [
      { width: 1200, height: 675, x: -280, y: -150, tilt: [-5, -3], lean: 2 },
      { width: 1200, height: 675, x: 290, y: 60, tilt: [-5, -3], lean: 2 },
    ],
    places: [
      { left: 120, top: 703, alignItems: 'flex-start' },
      { right: 110, top: 855, alignItems: 'flex-end' },
    ],
  },
  tall: {
    cards: [
      { width: 960, height: 760, x: 0, y: -500, tilt: [-4, -2], lean: 2 },
      { width: 960, height: 900, x: 0, y: 326, tilt: [4, 2], lean: 2 },
    ],
    places: [
      { ...TALL_PILLS, top: 820 },
      { ...TALL_PILLS, top: 1683 },
    ],
  },
};

/** The build stack: map, profile, travel, traits, inventory. Inventory shows a narrow panel, so it is narrower. */
export const BUILD_STACK: StackPoses = {
  wide: {
    cards: [
      { width: 1060, height: 596, x: -370, y: -212, tilt: [-5, -3], lean: 2 },
      { width: 1060, height: 596, x: -220, y: -130, tilt: [-5, -3], lean: 2 },
      { width: 1060, height: 596, x: -70, y: -48, tilt: [-5, -3], lean: 2 },
      { width: 1060, height: 596, x: 80, y: 34, tilt: [-5, -3], lean: 2 },
      { width: 690, height: 596, x: 575, y: 28, tilt: [-5, -3], lean: 2 },
    ],
    places: [
      { left: 100, top: 602, alignItems: 'flex-start' },
      { left: 250, top: 684, alignItems: 'flex-start' },
      { left: 400, top: 766, alignItems: 'flex-start' },
      // Its long caption fits one line only when it grows leftward.
      { right: 350, top: 848, alignItems: 'flex-end' },
      { right: 60, top: 855, alignItems: 'flex-end' },
    ],
  },
  tall: {
    cards: [
      { width: 900, height: 506, x: -40, y: -677, tilt: [-4, -2], lean: 2 },
      { width: 900, height: 506, x: 40, y: -387, tilt: [4, 2], lean: 2 },
      { width: 900, height: 506, x: -40, y: -97, tilt: [-4, -2], lean: 2 },
      { width: 900, height: 506, x: 40, y: 193, tilt: [4, 2], lean: 2 },
      { width: 620, height: 560, x: 110, y: 390, tilt: [4, 2], lean: 2 },
    ],
    places: [
      { ...TALL_PILLS, top: 516 },
      { ...TALL_PILLS, top: 806 },
      { ...TALL_PILLS, top: 1096 },
      { ...TALL_PILLS, top: 1386 },
      { ...TALL_PILLS, top: 1618 },
    ],
  },
};

/** Where each stack card's pill sits. */
export const STACK_PLACE: Record<Layout, readonly [CSSProperties, CSSProperties]> = {
  wide: [
    { left: 80, bottom: 150, alignItems: 'flex-start' },
    { right: 80, bottom: 110, alignItems: 'flex-end' },
  ],
  tall: [
    { ...TALL_PILLS, top: 800 },
    { ...TALL_PILLS, bottom: 137 },
  ],
};
