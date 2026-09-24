/**
 * How a podium step reads, and what color it wears.
 *
 * One place for both, because a place is a label and a metal together — a surface that names second place
 * without silvering it, or silvers a step without saying which, is half an answer. Everything that shows
 * a placement reads from here: the badge, the podium band, the dialog's slots and the admin summary.
 *
 * The wording a shared place takes lives here too, for the same reason: a count that four surfaces each
 * phrase for themselves is four accounts of one result.
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

/**
 * The ordinals the results broadcast writes, which are not the ones a badge wears.
 *
 * The server spells them out in the message it posts. The dialog's preview mirrors that wording rather
 * than the plate's, because its whole job is to show the message before it is sent.
 */
export const BROADCAST_PLACE_LABELS: Record<ContestPlace, string> = {
  1: 'First place',
  2: 'Second place',
  3: 'Third place',
};

/**
 * How a shared 1st place reads where a status line would otherwise name the winner.
 *
 * A count rather than the names: the surfaces that read this are one line each, and a line that lists
 * every tied world pushes whatever it sits above off the screen.
 *
 * @param count - How many worlds took 1st
 */
export const tiedForFirstLine = (count: number): string => `${count} worlds tied for 1st`;

/** The same result as a heading, which takes title case. */
export const tiedForFirstTitle = (count: number): string => `${count} Worlds Tied for 1st`;

/** The metal each place is colored by, as the theme's own tokens. */
export const PLACE_COLORS: Record<ContestPlace, string> = {
  1: 'text-gold',
  2: 'text-silver',
  3: 'text-bronze',
};

/** The metal a `.place-chip` tints, sheens and inks itself with. */
export const PLACE_CHIPS: Record<ContestPlace, string> = {
  1: '[--place:var(--gold)]',
  2: '[--place:var(--silver)]',
  3: '[--place:var(--bronze)]',
};

/** The tinted plate a place wears where a badge needs a background rather than ink alone. */
export const PLACE_PLATES: Record<ContestPlace, string> = {
  1: 'border-gold/50 bg-gold/10',
  2: 'border-silver/50 bg-silver/10',
  3: 'border-bronze/50 bg-bronze/10',
};
