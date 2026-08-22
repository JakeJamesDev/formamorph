/**
 * How a podium step reads, and what color it wears.
 *
 * One place for both, because a place is a label and a metal together — a surface that names second place
 * without silvering it, or silvers a step without saying which, is half an answer. Everything that shows
 * a placement reads from here: the badge, the podium band, the dialog's slots and the admin summary.
 */
import type { ContestPlace } from '@/types';

/** The three steps, in the order they read. */
export const PLACES: ContestPlace[] = [1, 2, 3];

/** The ordinal a place is named by. */
export const PLACE_LABELS: Record<ContestPlace, string> = {
  1: '1st Place',
  2: '2nd Place',
  3: '3rd Place',
};

/** The metal each place is colored by, as the theme's own tokens. */
export const PLACE_COLORS: Record<ContestPlace, string> = {
  1: 'text-gold',
  2: 'text-silver',
  3: 'text-bronze',
};

/** The tinted plate a place wears where a badge needs a background rather than ink alone. */
export const PLACE_PLATES: Record<ContestPlace, string> = {
  1: 'border-gold/50 bg-gold/10',
  2: 'border-silver/50 bg-silver/10',
  3: 'border-bronze/50 bg-bronze/10',
};
