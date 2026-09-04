# AI Context Find Bar

Status: ready-for-human

## Problem Statement

The AI Context viewer's search rewrites the text it searches. Typing a term replaces the document with a
line-filtered digest: matching lines survive, everything else collapses to `...`, and the whole view falls
back to a different rendering. Three things break at once. The viewer loses its own chrome (the System
Prompt / Messages regions and chat stagger disappear), the dictionary highlights vanish (their offsets
index the real text, which is no longer on screen), and the term itself is never marked — the player finds
the line, then re-scans it by eye. Worst, there is no way to see the surrounding context of a hit: the
filter shows the line and nothing else, and clearing the search loses the place.

## Solution

Search becomes navigation instead of filtering — the browser's Ctrl+F model, validated in a two-round
prototype (find bar won round 1; fold + hit rail won round 2). The document is never rewritten. Hits are
marked amber in place, layered over the dictionary highlights. A counter and prev/next controls step
through the hits, scrolling each into view. Requests with no hits fold shut with a quiet "no matches" tag,
so the turn's shape stays visible without noise. An overview ruler lives inside the scroll bar itself: one
tick per visible hit, the current one emphasized, clickable to jump — the modern editor pattern. Full
surrounding context is free, because the reader is always inside the real document.

## User Stories

1. As a world author, I want my search term marked in place in the request text, so that I see the hit inside its surrounding sentences instead of a bare line.
2. As a world author, I want a hit counter ("3 of 11") while searching, so that I know how much of the turn mentions my term.
3. As a world author, I want next/previous controls in the search field, so that I can step through every mention in order.
4. As a world author, I want Enter and Shift+Enter to step forward and back, so that I can navigate without leaving the keyboard.
5. As a world author, I want the current hit visually distinct from the other hits and scrolled to the center of the view, so that I never lose which mention I am on.
6. As a world author, I want dictionary highlights to stay visible while I search, so that I can see whether my term sits inside an entry's activated text.
7. As a world author, I want the viewer to keep its normal layout (regions, chat stagger, fonts) while searching, so that search feels like the same popup, not a different one.
8. As a world author, I want requests with no hits folded shut and labeled "no matches", so that I can ignore them without them disappearing.
9. As a world author, I want to open a folded no-match request by clicking it, so that folding is a hint, not a wall.
10. As a world author, I want my own collapse/expand choices restored when I clear the search, so that searching does not wreck how I had arranged the view.
11. As a world author, I want navigation to a hit inside a collapsed section to expand that section, so that stepping through hits never lands on nothing.
12. As a world author, I want an overview ruler inside the scroll bar showing every hit as a tick, so that I can see how hits distribute across a long request before scrolling.
13. As a world author, I want to click a tick to jump to that hit, so that I can go straight to a cluster instead of stepping one hit at a time.
14. As a world author, I want the current hit's tick emphasized, so that the ruler doubles as a position indicator.
15. As a world author, I want the scroll bar (and its ticks) to stay visible while a search is active, so that the overview does not vanish when my pointer leaves.
16. As a world author, I want ticks to reposition when I collapse or expand sections, so that the ruler never points at the wrong place.
17. As a world author, I want hits in the Raw Output marked and navigable too, so that I can trace a term from the input into the model's reply.
18. As a world author, I want multiple space-separated terms to each be marked, so that I can look for several names at once.
19. As a world author, I want matching to stay case-insensitive, so that "maren" finds "Maren".
20. As a world author, I want "0 of 0" and no marks when nothing matches, so that an empty result is stated rather than shown as an empty page.
21. As a world author, I want Collapse All to keep working during a search, so that searching does not disable the rest of the toolbar.
22. As a world author, I want switching turns with the pager to keep my query and restart at the first hit, so that I can chase a term across turns.
23. As a world author, I want clearing the search to leave me where I was scrolled, so that I can read onward from the last hit I visited.
24. As a player reading on a small screen, I want the find controls to fit inside the existing search field, so that the compacted header gains no new row.
25. As a player with reduced-motion preferences, I want hit jumps to be instant rather than animated scrolls, so that navigation does not trigger motion I opted out of.

## Implementation Decisions

- **The line filter is deleted, not bypassed.** One render path exists for searching and not searching;
  the anatomy layout is never skipped because of a search. The search-only fallback rendering and the
  "Collapse All disabled while searching" rule go with it.
- **Marks compose in the segment pipeline.** A new pure module owns find-term marking: it takes the
  segments the dictionary highlighter already produces and splits them further on term boundaries, so a
  find mark can sit on, inside, or across a dictionary chip without either system knowing about the other.
  It also owns hit ordering and the ruler's fraction math. Rendering stays in the viewer.
- **Hit identity is positional.** Hits are numbered in document order during segmentation. The current-hit
  index is viewer state; a render effect scrolls the current hit's element into view (`block: 'center'`,
  instant — no smooth scrolling, which also respects reduced motion).
- **Find controls live inside the existing search input** (count + up/down buttons on the right edge),
  keeping the compacted single-row toolbar. Enter / Shift+Enter mirror the buttons. The placeholder drops
  the "lines" wording.
- **Folding is a derived overlay, not persisted state.** While a search is active, a request group with
  zero hits renders collapsed with a "· no matches" suffix; the user's stored collapse map is neither read
  for nor written by this rule, so clearing the search restores their own arrangement exactly. Manual
  toggles on a folded group still work. Navigating to a hit inside a collapsed section (or group) expands
  it for real.
- **Hits inside collapsed sections stay in the count.** The counter reflects the turn, not the viewport;
  navigation expands whatever hides the target. Ticks are drawn for visible hits only and redraw after any
  expansion, collapse, or content resize.
- **The overview ruler extends the shared scroll bar.** The scroll area component gains an optional marks
  layer: an array of `{ fraction, current }` rendered as absolutely positioned ticks inside the Radix
  scroll bar track, with a select callback. Tick geometry (from the prototype):
  `fraction = markOffsetTop / scrollHeight`, clamped into the track. A tick's pointerdown stops
  propagation so the Radix track-click-to-scroll does not swallow the jump. While a search is active the
  scroll area sets the Radix `type="always"` so the bar and its ticks cannot auto-hide; without a search it
  reverts to the shared default.
- **Ticks recompute** on collapse/expand, on hit-set changes, and on viewport resize (resize observer on
  the viewport content). The existing viewport ref on the shared scroll area is the measuring handle.
- **Search semantics are unchanged**: current turn only, request input and raw output, case-insensitive,
  space-separated terms, each term marked independently (OR).
- **Find marks are visually distinct from dictionary chips**: a single accent (amber family) with a
  stronger face for the current hit, in both themes; dictionary chips keep their per-entry palette. Find
  marks are inert — no popover — so they never fight the chips' reason popovers.
- No changes to capture, export, prompts, or any AI call. Display only.

## Testing Decisions

- Good tests here assert external behavior: what gets marked, in what order, at what fraction — never the
  internal segment representation or React state.
- **The pure find module is the main seam**: term splitting over pre-segmented text (plain and chip
  segments), hit ordering across blocks, empty/no-match results, fraction math including the clamp.
  Prior art: the world search module's tests and the dictionary utilities' match-location tests.
- **The scroll bar marks layer gets a small render test**: given fractions, ticks render at the expected
  offsets; the current tick is distinguishable; clicking a tick fires the select callback. Prior art: the
  Radix-in-jsdom notes and existing component tests around portaled Radix primitives.
- **The viewer wiring is not unit-tested** (it lives in the GameViewer monolith): state, scroll-to, the
  derived fold, and `type="always"` switching are verified live through the dev-route
  (`#dev?view=gameViewer&modal=aiContext`) and recorded as a named gap. New guards in the pure module are
  mutation-tested (reintroduce the bug, watch the right test fail, restore).

## Out of Scope

- The results-index view (prototype variant C) — rejected in round 1.
- Cross-turn search and search over the memory summary block.
- Match options (case-sensitive, whole word, regex) — the editor find bar has them; this one stays simple
  until asked for.
- Replace, in any form.
- Seeding captured turns into the white-room fixture (a verification enabler, tracked separately).
- Any change to dictionary activation, hydration marking, or what gets captured per turn.

## Further Notes

- The two prototype rounds live in the throwaway prototype file next to the game components; it should move
  to a throwaway branch once implementation lands, per the prototype skill's capture rule.
- The compacted header (title folded into the toolbar) is already shipped; the find controls must not
  reintroduce a second toolbar row.
- The viewer already renders verbatim (`plain` anatomy rendering, shipped); this spec depends on that —
  find marks compose with dictionary chips only, never with provenance tint.

## Comments

**Implemented (commit `Find Instead Of Filter In The AI Context`).**

- New pure module `src/lib/findMarks.ts` + tests: term parsing, hit location, per-block numbering,
  segment splitting (including a hit across a segment edge), and the ruler's fraction math. Four guards
  mutation-tested.
- `ScrollArea` gained `marks` / `onMarkSelect`; ticks render in the Radix track, with a render test.
- `RequestAnatomyView.renderText` now receives the run's `start` offset, and `anatomyRegions` moved to
  `src/lib/requestAnatomy.ts` so the viewer numbers blocks in the order the anatomy draws them.
- The line filter and the "Collapse All disabled while searching" rule are deleted.

**Verified live** through `#dev?view=gameViewer&fixture=whiteRoom&modal=aiContext`, driving a real turn
against a throwaway mock endpoint: marks + counter (24 hits), stepping and Enter/Shift+Enter, tick
positions and tick jumps, the derived "no matches" fold with its hand-open, hits inside a collapsed
section staying counted, navigation expanding what hides a hit, and a cleared query restoring both the
reader's collapse map and the scroll position.

**Named gaps** (as this spec anticipated):

1. Pager behavior (query kept, restart at the first hit) is unverified live — a second turn would not
   capture through the mock. The reset effect is keyed on `debugPage`, the same path proven for a query
   change.
2. Find marks composing with dictionary chips is unverified live — the white-room fixture has no
   dictionary entries. Covered by the pure module's tests.
3. Both gaps close by seeding captured turns into the white-room fixture, which this spec put out of scope.

## Comments

- Prototype (both rounds) captured on branch `prototype/ai-context-search` (commit a426764) and removed
  from main, per the prototype skill's capture rule.
