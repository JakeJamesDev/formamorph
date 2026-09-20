# 03: Player Surfaces Show a Tied Podium

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: high

**Parent:** [Contest Ties](../spec.md)

**What to build:** Every surface that reads a podium shows a shared place correctly. The work depends only on the DTO contract in the spec (same shape, repeated `place` values, array order is the display order), so it does not wait for the server. The dev event sample gets a shared place, which makes every surface reachable through the dev router.

One shared helper returns the 1st-place worlds. The four one-line surfaces use it: the contest bar status line, the event banner, the acknowledge modal title, and the admin Events tab one-liner. With one 1st-place world their text does not change. With two or more they show a count, "N worlds tied for 1st". The contest bar keeps its "· N more placed" suffix, where N counts the worlds below 1st place.

The podium band becomes a flat wrapping row. Each card has its own plate, cards follow the array order, and keys use the world id with an index fallback. The decided-contest entry order pins the podium in array order and adds publish time as the tiebreaker for the like-count sort. Place lookup by world and the place badges need no change; confirm that with a test over a tied podium.

- [ ] The four one-line surfaces read as before for one winner and show the count for a tie
- [ ] The band renders every placed world with the right metal plate, at any count, with no duplicate-key warning
- [ ] The band wraps at mobile width with no horizontal scroll
- [ ] A decided contest's entry list starts with the podium in array order; entries with equal likes keep a stable order
- [ ] Card and details badges show "1st Place" with the gold treatment for each tied world, and a local copy still gets its badge
- [ ] The dev event sample includes a shared place
- [ ] New copy follows the help-copy pattern and title case rules
- [ ] UI verified through the dev router with static evidence, in both themes
- [ ] Changelog In-Progress entry added; four gates green, test run time stated
