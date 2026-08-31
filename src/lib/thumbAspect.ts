/**
 * The one place thumbnail framing lives. Every surface that draws a library or listing thumbnail —
 * tiles, drag ghost, folder mosaics, detailed and community cards, modals, list rows — takes its
 * frame ratio and its crop from here, so a thumbnail reads the same wherever it appears.
 */

/** The shape a thumbnail's frame takes: wide scene art, or tall character art. */
export type ThumbAspect = 'landscape' | 'portrait';

/** Width-to-height per aspect, for grids that size their cells in JS. */
export const THUMB_RATIO: Record<ThumbAspect, number> = {
  landscape: 16 / 9,
  portrait: 2 / 3,
};

/** The same frames as classes, for surfaces that size in CSS. */
export const THUMB_FRAME: Record<ThumbAspect, string> = {
  landscape: 'aspect-video',
  portrait: 'aspect-[2/3]',
};

/**
 * How a thumbnail fills a cropping frame: covered, and anchored to the top when the art is expected
 * to be a portrait — the face is the part worth keeping — centered otherwise.
 */
export const thumbFit = (content: ThumbAspect): string =>
  content === 'portrait' ? 'object-cover object-top' : 'object-cover';
