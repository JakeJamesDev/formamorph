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

/** A typed scene's cards: the game shot's dimmed card behind, and the panel in front, which fits its text inside `padding`. */
export const TYPED_CARDS: Record<Layout, { back: CardPose; panel: Omit<CardPose, 'height'>; padding: number }> = {
  wide: {
    back: { width: 1440, height: 810, x: -90, y: -90, tilt: [-10, -6], lean: 3 },
    panel: { width: 1180, x: 170, y: 250, tilt: [-8, -4], lean: 2 },
    padding: 64,
  },
  tall: {
    back: { width: 840, height: 1493, x: 0, y: -170, tilt: [-6, -3], lean: 3 },
    panel: { width: 920, x: 0, y: 560, tilt: [-5, -2], lean: 2 },
    padding: 56,
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

/** Where a frame shot's caption pills sit. */
export const CAPTION_PLACE: Record<Layout, CSSProperties> = {
  wide: { left: 120, bottom: 110, alignItems: 'flex-start' },
  tall: { left: 60, right: 60, bottom: 170, alignItems: 'center' },
};

/** The two cards of a stack, one above the other (tall) or side by side (wide), each with its own pill. */
export const STACK_CARDS: Record<Layout, readonly [CardPose, CardPose]> = {
  wide: [
    { width: 840, height: 630, x: -450, y: -40, tilt: [10, 6], lean: 3 },
    { width: 840, height: 630, x: 450, y: 20, tilt: [-10, -6], lean: 3 },
  ],
  tall: [
    { width: 960, height: 760, x: 0, y: -440, tilt: [-7, -4], lean: 4 },
    { width: 960, height: 760, x: 0, y: 420, tilt: [7, 4], lean: 2 },
  ],
};

/** Where each stack card's pill sits. */
export const STACK_PLACE: Record<Layout, readonly [CSSProperties, CSSProperties]> = {
  wide: [
    { left: 80, bottom: 150, alignItems: 'flex-start' },
    { right: 80, bottom: 110, alignItems: 'flex-end' },
  ],
  tall: [
    { left: 60, right: 60, top: 820, alignItems: 'center' },
    { left: 60, right: 60, bottom: 90, alignItems: 'center' },
  ],
};
