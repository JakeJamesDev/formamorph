import { describe, it, expect } from 'vitest';
import {
  canToggleTie, clearRow, cyclePodium, fitsPodium, orderTiedRows, placementsFrom, placesOf, podiumLines,
  rowsFromPlacements, toggleTie,
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
    { name: 'a tie for 1st', built: rows('a', 'b=', 'c'), places: [1, 1, 2] },
    { name: 'a tie for 1st over a full podium', built: rows('a', 'b=', 'c', 'd'), places: [1, 1, 2, 3] },
    { name: 'two shared places', built: rows('a', 'b=', 'c', 'd=', 'e'), places: [1, 1, 2, 2, 3] },
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

  it('cannot build a gap, whatever the flags', () => {
    // The shape holds the rule: a row shares the place above it or takes the next one. Every flag
    // spelling of up to five rows is walked, so 1, 1, 3 has nowhere to come from.
    for (let length = 1; length <= 5; length++) {
      for (let flags = 0; flags < 2 ** length; flags++) {
        const built = Array.from({ length }, (_, at) => `w${at}${(flags >> at) & 1 ? '=' : ''}`);
        const places = placesOf(rows(...built));

        expect(places[0]).toBe(1);
        places.slice(1).forEach((place, at) => {
          expect([places[at], places[at] + 1]).toContain(place);
        });
      }
    }
  });
});

describe('what the podium holds', () => {
  it.each([
    { built: rows('a', 'b=', 'c'), fits: true },
    { built: rows('a', 'b=', 'c='), fits: true },
    { built: rows('a', 'b', 'c', 'd=', 'e='), fits: true },
    { built: rows('a', 'b=', 'c=', 'd='), fits: true },
    { built: rows('a', 'b=', 'c=', 'd'), fits: true },
    { built: rows('a', 'b=', 'c', 'd'), fits: true },
    { built: rows('a', 'b', 'c', 'd'), fits: false },
    { built: rows('a', 'b=', 'c', 'd', 'e'), fits: false },
    { built: rows('a', 'b', 'c', 'd', 'e='), fits: false },
  ])('reads $built as fits=$fits', ({ built, fits }) => {
    expect(fitsPodium(built)).toBe(fits);
  });
});

describe('clicking an entry', () => {
  it('appends an unplaced world at the next place', () => {
    expect(spell(cyclePodium(rows('a'), 'b'))).toEqual(['a', 'b']);
  });

  it('appends untied while the last row is above 3rd place, however many rows there are', () => {
    // A tie takes no place away: two worlds on 1st are followed by 2nd, then 3rd.
    const second = cyclePodium(rows('a', 'b='), 'c');
    expect(spell(second)).toEqual(['a', 'b=', 'c']);
    expect(placesOf(second)).toEqual([1, 1, 2]);

    const third = cyclePodium(second, 'd');
    expect(spell(third)).toEqual(['a', 'b=', 'c', 'd']);
    expect(placesOf(third)).toEqual([1, 1, 2, 3]);

    expect(placesOf(cyclePodium(rows('a', 'b=', 'c='), 'd'))).toEqual([1, 1, 1, 2]);
  });

  it('joins tied when the last row already holds 3rd place', () => {
    // A further world cannot take 4th, so it shares the bottom step instead — which is how every podium
    // the ranking rule accepts stays reachable by clicking.
    expect(spell(cyclePodium(rows('a', 'b', 'c'), 'd'))).toEqual(['a', 'b', 'c', 'd=']);

    const joined = cyclePodium(rows('a', 'b=', 'c', 'd'), 'e');
    expect(spell(joined)).toEqual(['a', 'b=', 'c', 'd', 'e=']);
    expect(placesOf(joined)).toEqual([1, 1, 2, 3, 3]);
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
    // podium's shape: 1, 2, 3 before and 1, 2, 3 after.
    const traded = cyclePodium(rows('a', 'b', 'c'), 'a');
    expect(spell(traded)).toEqual(['b', 'a', 'c']);
    expect(placesOf(traded)).toEqual([1, 2, 3]);
  });

  it('steps a world down to the next place rather than inside the place it already shares', () => {
    // `orderTiedRows` keeps a shared place in publish order, so a trade within one would be sorted
    // straight back and the click would do nothing. The step is to the next place down.
    const traded = cyclePodium(rows('a', 'b=', 'c'), 'a');
    expect(spell(traded)).toEqual(['c', 'b=', 'a']);
    expect(placesOf(traded)).toEqual([1, 1, 2]);
  });

  it('takes a world on the bottom place off, even with a row still under it', () => {
    // The bottom place has nowhere below it, so every world sharing it cycles off rather than trading.
    // The survivor keeps 2nd place rather than being promoted into a shared 1st.
    const left = cyclePodium(rows('a', 'b', 'c='), 'b');
    expect(spell(left)).toEqual(['a', 'c']);
    expect(placesOf(left)).toEqual([1, 2]);
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
    expect(placesOf(tied)).toEqual([1, 1, 2]);
  });

  it('breaks a tie again', () => {
    expect(spell(toggleTie(rows('a', 'b=', 'c'), 1))).toEqual(['a', 'b', 'c']);
  });

  it('refuses a break that would push a row past the podium', () => {
    // Two worlds share 3rd. Untie the last and it is 4th, which is no place at all — so the podium is
    // left as it stands and the way out is to clear the row.
    const shared = rows('a', 'b', 'c', 'd=');
    expect(toggleTie(shared, 3)).toBe(shared);
  });

  it('refuses a break higher up that would push a row below it past the podium', () => {
    // 1, 1, 2, 3 with the tie for 1st broken is 1, 2, 3, 4: the row refused is not the one toggled.
    const full = rows('a', 'b=', 'c', 'd');
    expect(toggleTie(full, 1)).toBe(full);
  });

  it('breaks a tie whenever every row still has a place', () => {
    // Four worlds share 1st. Untie the last and it takes 2nd: a tie took no place away, so there is room.
    const broken = toggleTie(rows('a', 'b=', 'c=', 'd='), 3);
    expect(spell(broken)).toEqual(['a', 'b=', 'c=', 'd']);
    expect(placesOf(broken)).toEqual([1, 1, 1, 2]);
  });

  it('takes the rows still chained to a broken tie down with it', () => {
    // Four sharing 1st, and the third breaks away: it takes 2nd, and the fourth, still tied, shares it.
    const broken = toggleTie(rows('a', 'b=', 'c=', 'd='), 2);
    expect(spell(broken)).toEqual(['a', 'b=', 'c', 'd=']);
    expect(placesOf(broken)).toEqual([1, 1, 2, 2]);
  });

  it('leaves the first row alone, which has nothing to tie with', () => {
    expect(spell(toggleTie(rows('a', 'b'), 0))).toEqual(['a', 'b']);
  });
});

describe('seeding from a published podium', () => {
  it('sets the flag where two neighbors share a place', () => {
    const seeded = rowsFromPlacements([
      placement(1, 'a'), placement(1, 'b'), placement(2, 'c'), placement(3, 'd'),
    ]);
    expect(spell(seeded)).toEqual(['a', 'b=', 'c', 'd']);
    expect(placesOf(seeded)).toEqual([1, 1, 2, 3]);
  });

  it('leaves a podium with no ties flat', () => {
    expect(spell(rowsFromPlacements([placement(1, 'a'), placement(2, 'b')]))).toEqual(['a', 'b']);
  });

  it('drops a placement whose listing is gone and never starts on a flag', () => {
    // The snapshot survives a deletion but the id does not. Saving is refused separately; the draft
    // must still read as a podium rather than as one that begins tied with nothing.
    expect(spell(rowsFromPlacements([placement(1, null), placement(1, 'b')]))).toEqual(['b']);
  });

  it('does not seat a survivor tied with the deleted row above it', () => {
    // A published 1, 2, 2 whose silver was deleted leaves one world on 1st and one on 2nd. Reading the
    // flag off the published neighbor rather than the last kept one would open the dialog showing both
    // on 1st — a place neither world holds, on a podium nobody edited.
    const seeded = rowsFromPlacements([placement(1, 'a'), placement(2, null), placement(2, 'c')]);

    expect(spell(seeded)).toEqual(['a', 'c']);
    expect(placesOf(seeded)).toEqual([1, 2]);
  });

  it('keeps a tie whose own partner survived the deletion', () => {
    // The guard above must not drop every flag: 1, 1, 2 with the silver deleted is still a tie for 1st.
    const seeded = rowsFromPlacements([placement(1, 'a'), placement(1, 'b'), placement(2, null)]);

    expect(spell(seeded)).toEqual(['a', 'b=']);
    expect(placesOf(seeded)).toEqual([1, 1]);
  });
});

describe('the podium as lines', () => {
  it('gathers the worlds that share a place onto one line', () => {
    expect(podiumLines(rows('a', 'b=', 'c'))).toEqual([
      { place: 1, worldIds: ['a', 'b'] },
      { place: 2, worldIds: ['c'] },
    ]);
  });

  it('gives a podium with no ties one line each', () => {
    expect(podiumLines(rows('a', 'b', 'c'))).toEqual([
      { place: 1, worldIds: ['a'] },
      { place: 2, worldIds: ['b'] },
      { place: 3, worldIds: ['c'] },
    ]);
  });

  it('has nothing to say about an empty podium', () => {
    expect(podiumLines(rows())).toEqual([]);
  });
});

describe('whether the toggle is available', () => {
  it('follows what the toggle would do', () => {
    // One answer, two readings: the checkbox asks before, the mutator refuses after. They must agree,
    // or a checkbox offers a change that then does nothing.
    const cases = [
      rows('a', 'b', 'c'), rows('a', 'b=', 'c='), rows('a', 'b=', 'c', 'd'), rows('a', 'b', 'c', 'd='),
    ];
    cases.forEach((podium) => {
      podium.forEach((_, index) => {
        expect(canToggleTie(podium, index)).toBe(toggleTie(podium, index) !== podium);
      });
    });
  });

  it('says no on the first row and past the end', () => {
    expect(canToggleTie(rows('a', 'b'), 0)).toBe(false);
    expect(canToggleTie(rows('a', 'b'), 2)).toBe(false);
  });

  it('says no where breaking the tie would leave the row with no place', () => {
    expect(canToggleTie(rows('a', 'b', 'c', 'd='), 3)).toBe(false);
    expect(canToggleTie(rows('a', 'b=', 'c', 'd'), 1)).toBe(false);
    expect(canToggleTie(rows('a', 'b=', 'c=', 'd='), 3)).toBe(true);
  });
});

describe('clearing a row out of a shared place', () => {
  it('leaves the survivors of a shared place on that place', () => {
    // 1, 2, 2 with the first 2nd place gone is 1, 2 — not 1, 1. A removal takes one world off; it must
    // not hand another a place nobody awarded it.
    const left = clearRow(rows('a', 'b', 'c='), 1);
    expect(spell(left)).toEqual(['a', 'c']);
    expect(placesOf(left)).toEqual([1, 2]);
  });

  it('leaves the survivor of a shared 1st on 1st, with the row below deriving again', () => {
    const left = clearRow(rows('a', 'b=', 'c'), 0);
    expect(spell(left)).toEqual(['b', 'c']);
    expect(placesOf(left)).toEqual([1, 2]);
  });

  it('changes no other flag when the row removed only shared a place', () => {
    // The guard above must fire on the row that opened the run, not on every removal.
    const left = clearRow(rows('a', 'b=', 'c='), 1);
    expect(spell(left)).toEqual(['a', 'c=']);
    expect(placesOf(left)).toEqual([1, 1]);
  });

  it('changes no flag when the row removed opened nothing', () => {
    expect(spell(clearRow(rows('a', 'b', 'c'), 1))).toEqual(['a', 'c']);
  });

  it('changes no flag when the removed row is the last one', () => {
    expect(spell(clearRow(rows('a', 'b=', 'c'), 2))).toEqual(['a', 'b=']);
  });
});

describe('the order inside a shared place', () => {
  /** A publish-time reader over a few named worlds. Anything else reads as unknown, which sorts last. */
  const published = (times: Record<string, number>) =>
    (worldId: string) => times[worldId] ?? Number.MAX_SAFE_INTEGER;

  it('puts the earliest published first inside each shared place', () => {
    const ordered = orderTiedRows(rows('a', 'b=', 'c='), published({ a: 300, b: 100, c: 200 }));
    expect(spell(ordered)).toEqual(['b', 'c=', 'a=']);
  });

  it('leaves the flags and the places exactly where they were', () => {
    // The flag belongs to the row, so moving ids inside a run must not change the podium's shape.
    const ordered = orderTiedRows(rows('a', 'b=', 'c'), published({ a: 300, b: 100, c: 200 }));
    expect(spell(ordered)).toEqual(['b', 'a=', 'c']);
    expect(placesOf(ordered)).toEqual([1, 1, 2]);
  });

  it('never moves a world across a place', () => {
    // The earliest-published world of all three sits on the bottom step. Sorting the whole list rather
    // than each run would hand it 1st place, off an order nobody chose.
    const ordered = orderTiedRows(rows('a', 'b=', 'c'), published({ a: 300, b: 200, c: 100 }));
    expect(spell(ordered)).toEqual(['b', 'a=', 'c']);
  });

  it('sorts each shared place on its own', () => {
    const ordered = orderTiedRows(rows('a', 'b=', 'c', 'd='), published({ a: 300, b: 100, c: 900, d: 400 }));
    expect(spell(ordered)).toEqual(['b', 'a=', 'd', 'c=']);
  });

  it('sorts a world with no stamp last, keeping the ones with none in the order they were in', () => {
    const ordered = orderTiedRows(rows('a', 'b=', 'c=', 'd='), published({ c: 500 }));
    expect(spell(ordered)).toEqual(['c', 'a=', 'b=', 'd=']);
  });

  it('changes nothing on a podium where no place is shared', () => {
    const plain = rows('a', 'b', 'c');
    expect(spell(orderTiedRows(plain, published({ a: 300, b: 200, c: 100 })))).toEqual(['a', 'b', 'c']);
  });

  it('is settled after one pass, so a second action cannot reshuffle the list', () => {
    const once = orderTiedRows(rows('a', 'b=', 'c='), published({ a: 300, b: 100, c: 200 }));
    expect(spell(orderTiedRows(once, published({ a: 300, b: 100, c: 200 })))).toEqual(spell(once));
  });

  it('leaves the rows it was given alone', () => {
    const given = rows('a', 'b=');
    orderTiedRows(given, published({ a: 300, b: 100 }));
    expect(spell(given)).toEqual(['a', 'b=']);
  });
});

describe('the request body', () => {
  it('carries a repeated place, one row per world', () => {
    expect(placementsFrom(rows('a', 'b=', 'c'))).toEqual([
      { place: 1, worldId: 'a' },
      { place: 1, worldId: 'b' },
      { place: 2, worldId: 'c' },
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
