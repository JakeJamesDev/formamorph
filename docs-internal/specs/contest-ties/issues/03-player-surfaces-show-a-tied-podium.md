# 03: Player Surfaces Show a Tied Podium

Status: ready-for-human
Base: d1785716
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: high

**Parent:** [Contest Ties](../spec.md)

**What to build:** Every surface that reads a podium shows a shared place correctly. The work depends only on the DTO contract in the spec (same shape, repeated `place` values, array order is the display order), so it does not wait for the server. The dev event sample gets a shared place, which makes every surface reachable through the dev router.

One shared helper returns the 1st-place worlds. The four one-line surfaces use it: the contest bar status line, the event banner, the acknowledge modal title, and the admin Events tab one-liner. With one 1st-place world their text does not change. With two or more they show a count, "N worlds tied for 1st". The contest bar keeps its "· N more placed" suffix, where N counts the worlds below 1st place.

The podium band becomes a flat wrapping row. Each card has its own plate, cards follow the array order, and keys use the world id with an index fallback. The decided-contest entry order pins the podium in array order and adds publish time as the tiebreaker for the like-count sort. Place lookup by world and the place badges need no change; confirm that with a test over a tied podium.

- [x] The four one-line surfaces read as before for one winner and show the count for a tie
- [x] The band renders every placed world with the right metal plate, at any count, with no duplicate-key warning
- [x] The band wraps at mobile width with no horizontal scroll
- [x] A decided contest's entry list starts with the podium in array order; entries with equal likes keep a stable order
- [x] Card and details badges show "1st Place" with the gold treatment for each tied world, and a local copy still gets its badge
- [x] The dev event sample includes a shared place
- [x] New copy follows the help-copy pattern and title case rules
- [x] UI verified through the dev router with static evidence, in both themes
- [x] Changelog In-Progress entry added; four gates green, test run time stated

## Comments

**Handover (commit `3a06ed47`, follow-up on the review):** shipped on `main`.

Gates, all run in the same turn: `typecheck` 0 errors, `lint` 0 errors (one pre-existing
`react-refresh` warning in an untouched file), `test` 720 files / 11,856 passed / 3 skipped in
**104.7 s**, `build` 20.4 s. Two teardown errors surfaced under full-suite concurrency in
`src/components/library/LibraryGroupFlow.test.tsx`, which is not in this diff and passes alone.

Verified in the dev router at 1280×800 and at 375 px, in both themes: the band's two gold plates and
one bronze, the bar's `2 worlds tied for 1st · 1 more placed`, the banner's
`Results announced — 2 worlds tied for 1st`, the poster's `2 Worlds Tied for 1st`, and the admin row's
`2 worlds tied for 1st (+1 more)` beside the untied `1st Place: The Long Thaw — sedgewright (+2 more)`.
At 375 px the three cards stack, each 326 px wide, and `scrollWidth === clientWidth === 375`.

Every new guard was mutation-tested: nine mutations, each one red in the test written for it, sources
restored and the anchors re-checked. Coverage on the changed modules: 100 % statements and lines,
94.4–100 % branches. The one uncovered new branch is a podium that carries placements but no 1st place,
which the server's ranking rule makes unreachable.

**Two notes for whoever picks this up:**

1. `parseServerDate` throws on a missing timestamp, and the catalog row is untyped, so the new
   publish-time tiebreaker guards with a `typeof` check at its own call site. Whether the shared helper
   should accept a missing value is filed as its own task, not fixed here.
2. The changelog line about the Podium dialog in commit `3a06ed47` belongs to ticket 04. It was swept
   along by staging the shared changelog file, which the implement protocol says to leave alone.
