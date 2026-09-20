import { describe, it, expect } from 'vitest';
import {
  clearRow, cyclePodium, fitsPodium, placementsFrom, placesOf, rowsFromPlacements, toggleTie,
} from './podiumRanking';
import type { PodiumRow } from './podiumRanking';
import type { EventPlacement } from '@/types';

/** A podium written as the flags a reader can see: `a` joins, `a=` joins tied with the row above. */
const rows = (...spec: string[]): PodiumRow[] => spec.map((entry) => ({
  worldId: entry.replace('=', ''),
  tiedWithAbove: entry.endsWith('='),
}));

/** The flag spelling above, read back off a podium. */
const spell = (podium: PodiumRow[]): string[] =>
  podium.map((row) => `${row.worldId}${row.tiedWithAbove ? '=' : ''}`);

const placement = (place: number, worldId: string | null): EventPlacement => ({
  place: place as EventPlacement['place'],
  worldId,
  worldName: worldId ?? 'The Long Thaw',
  authorName: 'sedgewright',
});

describe('deriving the places', () => {
  // The spec's example table, read as the rows a judge builds rather than as stored places. The server
  // validator answers the same table; the two must agree or a dialog stages what the server refuses.
  it.each([
    { name: 'a plain podium', built: rows('a', 'b', 'c'), places: [1, 2, 3] },
    { name: 'a tie for 1st', built: rows('a', 'b=', 'c'), places: [1, 1, 3] },
    { name: 'three sharing 1st', built: rows('a', 'b=', 'c='), places: [1, 1, 1] },
    { name: 'a tie for 2nd', built: rows('a', 'b', 'c='), places: [1, 2, 2] },
    { name: 'a tie for 3rd', built: rows('a', 'b', 'c', 'd='), places: [1, 2, 3, 3] },
    { name: 'three sharing 3rd', built: rows('a', 'b', 'c', 'd=', 'e='), places: [1, 2, 3, 3, 3] },
    { name: 'five sharing 1st', built: rows('a', 'b=', 'c=', 'd=', 'e='), places: [1, 1, 1, 1, 1] },
    { name: 'nothing staged', built: rows(), places: [] },
  ])('derives $name as $places', ({ built, places }) => {
    expect(placesOf(built)).toEqual(places);
  });

  it('reads the first row as 1st even when its flag is set', () => {
    // Nothing above it to share with, so a flag left behind by a clear cannot stage a podium starting
    // at 2nd — which is the one shape the ranking rule has no repair for.
    expect(placesOf(rows('a=', 'b'))).toEqual([1, 2]);
  });

  it('cannot spell 1, 1, 2 at all', () => {
    // The shape holds the rule: a row either shares the place above it or takes its own index. There is
    // no third option, so dense ranking has nowhere to come from.
    expect(placesOf(rows('a', 'b=', 'c'))).not.toEqual([1, 1, 2]);
    expect(placesOf(rows('a', 'b', 'c'))).not.toEqual([1, 1, 2]);
  });
});

describe('what the podium holds', () => {
  it.each([
    { built: rows('a', 'b=', 'c'), fits: true },
    { built: rows('a', 'b=', 'c='), fits: true },
    { built: rows('a', 'b', 'c', 'd=', 'e='), fits: true },
    { built: rows('a', 'b=', 'c=', 'd='), fits: true },
    { built: rows('a', 'b', 'c', 'd'), fits: false },
    { built: rows('a', 'b=', 'c=', 'd'), fits: false },
    { built: rows('a', 'b', 'c', 'd', 'e='), fits: false },
  ])('reads $built as fits=$fits', ({ built, fits }) => {
    expect(fitsPodium(built)).toBe(fits);
  });
});

describe('clicking an entry', () => {
  it('appends an unplaced world at the next place', () => {
    expect(spell(cyclePodium(rows('a'), 'b'))).toEqual(['a', 'b']);
  });

  it('joins tied when its own place would be past the podium', () => {
    // A fourth world cannot take 4th, so the click that used to do nothing now shares the bottom step
    // instead — which is how every podium the ranking rule accepts stays reachable by clicking.
    expect(spell(cyclePodium(rows('a', 'b=', 'c='), 'd'))).toEqual(['a', 'b=', 'c=', 'd=']);
    expect(spell(cyclePodium(rows('a', 'b', 'c'), 'd'))).toEqual(['a', 'b', 'c', 'd=']);
    expect(spell(cyclePodium(rows('a', 'b=', 'c'), 'd'))).toEqual(['a', 'b=', 'c', 'd=']);
  });

  it('never stages a place past the podium, however many join', () => {
    // No limit applies to how many worlds share a place, so a click always lands somewhere — but never
    // on a 4th place.
    let podium = rows('a', 'b', 'c');
    ['d', 'e', 'f', 'g'].forEach((worldId) => { podium = cyclePodium(podium, worldId); });

    expect(placesOf(podium)).toEqual([1, 2, 3, 3, 3, 3, 3]);
    expect(fitsPodium(podium)).toBe(true);
  });

  it('trades a placed world with the row below, leaving the flags where they are', () => {
    // The flag belongs to the row, not to the world in it, so a trade moves the names and keeps the
    // podium's shape: 1, 1, 3 before and 1, 1, 3 after.
    const traded = cyclePodium(rows('a', 'b=', 'c'), 'a');
    expect(spell(traded)).toEqual(['b', 'a=', 'c']);
    expect(placesOf(traded)).toEqual([1, 1, 3]);
  });

  it('takes the bottom row off the podium', () => {
    expect(spell(cyclePodium(rows('a', 'b=', 'c'), 'c'))).toEqual(['a', 'b=']);
  });

  it('clears the first row of its flag when the row above it leaves', () => {
    expect(spell(cyclePodium(rows('a', 'b='), 'b'))).toEqual(['a']);
    expect(spell(clearRow(rows('a', 'b=', 'c'), 0))).toEqual(['b', 'c']);
  });
});

describe('the tie toggle', () => {
  it('makes a tie and derives every later place again', () => {
    const tied = toggleTie(rows('a', 'b', 'c'), 1);
    expect(spell(tied)).toEqual(['a', 'b=', 'c']);
    expect(placesOf(tied)).toEqual([1, 1, 3]);
  });

  it('breaks a tie again', () => {
    expect(spell(toggleTie(rows('a', 'b=', 'c'), 1))).toEqual(['a', 'b', 'c']);
  });

  it('refuses a break that would push a row past the podium', () => {
    // Four worlds share 1st. Untie the last and it is 4th, which is no place at all — so the podium is
    // left as it stands and the way out is to clear the row.
    const four = rows('a', 'b=', 'c=', 'd=');
    expect(spell(toggleTie(four, 3))).toEqual(spell(four));
    expect(spell(toggleTie(rows('a', 'b', 'c', 'd='), 3))).toEqual(['a', 'b', 'c', 'd=']);
  });

  it('takes the rows still chained to a broken tie down with it', () => {
    // Four sharing 1st, and the third breaks away: it takes 3rd, and the fourth, still tied, shares it.
    const broken = toggleTie(rows('a', 'b=', 'c=', 'd='), 2);
    expect(spell(broken)).toEqual(['a', 'b=', 'c', 'd=']);
    expect(placesOf(broken)).toEqual([1, 1, 3, 3]);
  });

  it('leaves the first row alone, which has nothing to tie with', () => {
    expect(spell(toggleTie(rows('a', 'b'), 0))).toEqual(['a', 'b']);
  });
});

describe('seeding from a published podium', () => {
  it('sets the flag where two neighbors share a place', () => {
    const seeded = rowsFromPlacements([placement(1, 'a'), placement(1, 'b'), placement(3, 'c')]);
    expect(spell(seeded)).toEqual(['a', 'b=', 'c']);
    expect(placesOf(seeded)).toEqual([1, 1, 3]);
  });

  it('leaves a podium with no ties flat', () => {
    expect(spell(rowsFromPlacements([placement(1, 'a'), placement(2, 'b')]))).toEqual(['a', 'b']);
  });

  it('drops a placement whose listing is gone and never starts on a flag', () => {
    // The snapshot survives a deletion but the id does not. Saving is refused separately; the draft
    // must still read as a podium rather than as one that begins tied with nothing.
    expect(spell(rowsFromPlacements([placement(1, null), placement(1, 'b')]))).toEqual(['b']);
  });
});

describe('the request body', () => {
  it('carries a repeated place, one row per world', () => {
    expect(placementsFrom(rows('a', 'b=', 'c'))).toEqual([
      { place: 1, worldId: 'a' },
      { place: 1, worldId: 'b' },
      { place: 3, worldId: 'c' },
    ]);
  });

  it('carries a plain podium as it always did', () => {
    expect(placementsFrom(rows('a', 'b', 'c'))).toEqual([
      { place: 1, worldId: 'a' },
      { place: 2, worldId: 'b' },
      { place: 3, worldId: 'c' },
    ]);
  });
});
