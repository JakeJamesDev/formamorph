/**
 * Dense ranking for a contest podium being staged.
 *
 * A podium is an ordered list of rows, each either taking the next step or sharing the one above it. That
 * shape is the rule: places are read off the list rather than typed in, so 1, 1, 3 has nowhere to come
 * from and a judge cannot stage a podium the server would refuse. The server validator answers the same
 * example table — the two must agree, or the dialog stages what the save then rejects.
 */
import { PLACES } from './placeLabels';
import type { ContestPlace, EventPlacement } from '@/types';

/** One step of the podium being staged. */
export interface PodiumRow {
  worldId: string;
  /** Shares the place of the row above. Always false on the first row, which has nothing above it. */
  tiedWithAbove: boolean;
}

/** One world's place as the save sends it. */
export interface PodiumPlacement {
  place: ContestPlace;
  worldId: string;
}

/** The lowest step the podium holds. A derived place past it is not a place. */
const LAST_PLACE = PLACES.length;

/** The first row never shares a place, whatever a clear left behind. */
const normalize = (rows: PodiumRow[]): PodiumRow[] =>
  rows.length > 0 && rows[0].tiedWithAbove
    ? [{ ...rows[0], tiedWithAbove: false }, ...rows.slice(1)]
    : rows;

/**
 * Each row's place by dense ranking.
 *
 * A row that shares the place above takes that place; any other row takes the next place down. A tie
 * takes no place away — two worlds on 1st leave the third on 2nd — so the judge, not the rule, decides
 * how many winners a contest has.
 *
 * @returns One place per row, in row order. A value past the last step means the row has no place.
 */
export function placesOf(rows: PodiumRow[]): number[] {
  const places: number[] = [];
  rows.forEach((row, index) => {
    if (index === 0) places.push(1);
    else places.push(row.tiedWithAbove ? places[index - 1] : places[index - 1] + 1);
  });
  return places;
}

/** Whether every row derives a place the podium actually holds. */
export function fitsPodium(rows: PodiumRow[]): boolean {
  return placesOf(rows).every((place) => place <= LAST_PLACE);
}

/**
 * Each row's place, as a place rather than a number.
 *
 * The one narrowing in the module, so the assertion is made once and argued once: every mutator here
 * refuses a result that does not fit, so a draft assembled through them only ever derives 1, 2 or 3.
 * `placesOf` stays wide because the guards are what test it, and a guard needs to see the 4 it refuses.
 */
export function podiumPlacesOf(rows: PodiumRow[]): ContestPlace[] {
  return placesOf(rows) as ContestPlace[];
}

/**
 * The podium after this row is cleared, with everything below it closing up.
 *
 * The survivors of a shared place keep that place rather than joining the one above it. A row's flag
 * reads against whatever ends up over it, so removing the row that opened a run would hand the run to
 * the place above — clearing the first of two 2nd places would promote the other to a shared 1st, off a
 * removal that was meant to take one world off. The next row opens the run instead. Removing a row that
 * only shared a run leaves every other flag alone.
 */
export function clearRow(rows: PodiumRow[], index: number): PodiumRow[] {
  const removed = rows[index];
  const under = rows[index + 1];
  const kept = rows.filter((_, at) => at !== index);

  if (removed && under && !removed.tiedWithAbove && under.tiedWithAbove) {
    kept[index] = { ...kept[index], tiedWithAbove: false };
  }

  return normalize(kept);
}

/**
 * The podium after this world's card is clicked.
 *
 * Clicking cycles. An unplaced world joins at the bottom; a placed one trades with the row below it; and
 * one already on the bottom row leaves. That keeps the whole assembly on one click, and a mistake is
 * undone by clicking again rather than by hunting for a control.
 *
 * A world joins tied when its own step would be past the podium, so every podium the ranking rule accepts
 * is reachable by clicking — a world that follows 3rd place shares it, but it can never take a 4th place.
 * No limit applies to how many worlds share a step, so a click always lands.
 *
 * The step down is to the next place, not to the next row: worlds that share a place are kept in publish
 * order by `orderTiedRows`, so a trade inside one would be sorted straight back and the click would do
 * nothing. A world on the bottom place leaves instead, which is the bottom row's move.
 *
 * The flag belongs to the row rather than to the world sitting in it, so a trade moves two names and
 * leaves the podium's shape alone.
 */
export function cyclePodium(rows: PodiumRow[], worldId: string): PodiumRow[] {
  const at = rows.findIndex((row) => row.worldId === worldId);
  if (at === -1) {
    const alone = [...rows, { worldId, tiedWithAbove: false }];
    return fitsPodium(alone) ? alone : [...rows, { worldId, tiedWithAbove: true }];
  }

  const below = runEnd(placesOf(rows), at) + 1;
  if (below >= rows.length) return clearRow(rows, at);

  const next = [...rows];
  next[at] = { ...next[at], worldId: next[below].worldId };
  next[below] = { ...next[below], worldId: rows[at].worldId };
  return next;
}

/** The last row of the run of rows sharing this row's place. Tied rows are always neighbors. */
const runEnd = (places: number[], at: number): number => {
  let end = at;
  while (end + 1 < places.length && places[end + 1] === places[at]) end++;
  return end;
};

/**
 * The podium with the worlds inside each shared place put in publish order, earliest first.
 *
 * The server sorts a shared place by publish time before it stores the positions, so a dialog left in
 * click order would show an order the save then changes. Moving ids inside a run is safe because the tie
 * flag belongs to the row rather than to the world in it — the shape is untouched.
 *
 * The sort is stable, so worlds the caller reads as level keep the order they were in and bad data never
 * reshuffles the list.
 *
 * @param publishedAt - Reads one world's publish time in milliseconds; what "unknown" means is the
 *   caller's to decide
 */
export function orderTiedRows(
  rows: PodiumRow[],
  publishedAt: (worldId: string) => number,
): PodiumRow[] {
  const places = placesOf(rows);
  const out = [...rows];

  let start = 0;
  while (start < rows.length) {
    const end = runEnd(places, start);
    rows.slice(start, end + 1)
      .map((row) => row.worldId)
      .sort((a, b) => publishedAt(a) - publishedAt(b))
      .forEach((id, offset) => { out[start + offset] = { ...out[start + offset], worldId: id }; });
    start = end + 1;
  }

  return out;
}

/**
 * The podium after this row's tie flag is flipped.
 *
 * Breaking a tie pushes the row, and every row below it, down a step — which can land one of them past
 * the podium. That is refused rather than staged, so the list never holds a row with no place; the way out
 * of a tie with nowhere to go is to clear the row.
 *
 * @returns The new podium, or the one given when the result would not fit
 */
export function toggleTie(rows: PodiumRow[], index: number): PodiumRow[] {
  const next = flipped(rows, index);
  return next && fitsPodium(next) ? next : rows;
}

/** Whether this row's tie flag can be flipped at all — what the checkbox reads to know it is available. */
export function canToggleTie(rows: PodiumRow[], index: number): boolean {
  const next = flipped(rows, index);
  return Boolean(next && fitsPodium(next));
}

/** This podium with one row's flag flipped, or null where there is no flag to flip. */
const flipped = (rows: PodiumRow[], index: number): PodiumRow[] | null => {
  if (index <= 0 || index >= rows.length) return null;
  const next = [...rows];
  next[index] = { ...next[index], tiedWithAbove: !next[index].tiedWithAbove };
  return next;
};

/**
 * The rows a published podium seeds, so an edit opens on the ties it already announced.
 *
 * A placement whose listing has since been deleted carries no id to stage, so it is dropped here. Saving
 * over one is refused separately: the point of dropping it is that the draft still reads as a podium.
 *
 * The flag is read against the last placement actually kept, not the one before it in the published
 * list. A podium of 1, 2, 2 whose silver was deleted would otherwise seat its survivor tied with a row
 * that is gone, and the dialog would open showing a 1st place neither world holds.
 */
export function rowsFromPlacements(placements: EventPlacement[]): PodiumRow[] {
  const rows: PodiumRow[] = [];
  let above: ContestPlace | null = null;

  placements.forEach((placement) => {
    if (!placement.worldId) return;
    rows.push({ worldId: placement.worldId, tiedWithAbove: placement.place === above });
    above = placement.place;
  });

  return normalize(rows);
}

/** One line of the podium: a place, and the rows that share it. Tied rows are always neighbors. */
export interface PodiumLine {
  place: ContestPlace;
  worldIds: string[];
}

/**
 * The podium gathered a line per place, which is how the results broadcast writes it.
 *
 * Walked rather than grouped by key: the rows are already in place order, so a row either opens a new
 * line or joins the one above it.
 */
export function podiumLines(rows: PodiumRow[]): PodiumLine[] {
  const places = podiumPlacesOf(rows);
  const lines: PodiumLine[] = [];

  rows.forEach((row, index) => {
    const open = lines[lines.length - 1];
    if (open && open.place === places[index]) open.worldIds.push(row.worldId);
    else lines.push({ place: places[index], worldIds: [row.worldId] });
  });

  return lines;
}

/** The podium as the announce and edit routes take it: one entry per world, with places repeating. */
export function placementsFrom(rows: PodiumRow[]): PodiumPlacement[] {
  const places = podiumPlacesOf(rows);
  return rows.map((row, index) => ({ place: places[index], worldId: row.worldId }));
}
