# 13 — Bench Popover + embedded placement

Status: done
Status note: (commit 9f2af7c)

## Problem Statement

Opening the Test Bench is all-or-nothing: the flask button pops out a full third panel (mobile: a
covering Drawer). An author with one or two World Doctor findings pays the whole panel — layout
reflow, a resize handle, four Instruments — just to read two lines and click Fix. And the dock is
the *only* desktop placement: there is no way to give the Bench the editor's own list-panel space
while keeping the detail pane for landing on items.

## Solution

Three chromes for one Test Bench (glossary terms in `CONTEXT.md`):

1. **Bench Popover** — the flask's first stop. A popover anchored to the flask hosting the full
   World Doctor findings list (fixes, dismissals, stat-code check included). Small worlds get
   triaged entirely here.
2. **Embedded placement** — the full panel rendered inside the editor's first panel, replacing the
   tab strip + add/search bar + list while the editor header, footer, and the live detail panel
   stay. Finding clicks land visibly in the detail panel beside the Bench.
3. **Docked placement** — the existing third panel, kept. A header toggle switches placements; the
   last-used placement is remembered and is what the popover's "Open Test Bench" button opens.

Mobile keeps its Drawer as the full panel, reached through the same popover.

## User Stories

1. As an author, I want the flask button to open a compact popover first, so that a couple of findings don't cost me a full panel.
2. As an author, I want the popover to show the same grouped findings list as the panel (severity sections, New markers, Fix/Fix All, dismiss, restore, Mark All Seen, Advanced-only fold, stat-code check), so that nothing forces me into the panel for routine triage.
3. As an author, I want to click an item name in the popover and have the editor navigate to it while the popover stays open, so that I can work down the list without reopening it per finding.
4. As an author, I want closing the popover to mark the list seen, so that the badge quiets by the same rule as closing the panel.
5. As an author, I want a compact "Open Test Bench" button in the popover, so that deeper work (Triggers, AI Context, Opening, the lens) is one click away.
6. As an author, I want the full panel to open embedded in the editor's first panel by default, so that the Bench gets real width without a third column.
7. As an author, I want the detail panel to stay live beside the embedded Bench, so that clicking a finding's item visibly opens it next to the list I'm triaging.
8. As an author, I want the embedded Bench to keep the editor header and footer, so that Save, mode toggle, and Find stay reachable mid-triage.
9. As an author, I want a close control inside the embedded Bench, so that I can get back to the tabs without hunting for the flask.
10. As an author, I want a Pop Out control on the embedded Bench, so that I can move it to the side panel when I want the editor list and the Bench at once.
11. As an author, I want an Embed control on the docked Bench, so that the move works in both directions.
12. As an author, I want my last placement remembered across sessions, so that "Open Test Bench" reopens the Bench the way I use it.
13. As an author, I want the flask to close whatever Bench surface is open (popover, embedded, docked, Drawer), so that one button toggles the feature.
14. As a mobile author, I want the same popover for quick triage, so that small fixes don't require the full-height Drawer.
15. As a mobile author, I want the popover's "Open Test Bench" to open the Drawer, so that the full panel still works the way it did.
16. As a mobile author, I want an item click from the Drawer to keep closing it, so that navigation isn't hidden under a covering sheet.
17. As an author, I want the badge's loud-new / muted-total behavior unchanged, so that a still badge keeps meaning "nothing changed since you looked".
18. As an author with no findings, I want the popover to show the "No Problems Found · N rules checked" state, so that a clean world reads as verified, not broken.
19. As a keyboard/screen-reader author, I want the flask's aria state and labels to reflect the popover and panel being open, so that the toggle is legible without sight.
20. As a developer, I want the `bench=` dev route to keep opening the full panel on a named Instrument, so that verification and the drift guard keep working.
21. As a developer, I want the expensive Instrument builds (AI Context, Opening, semantics) to stay gated on the full panel being open, so that the popover stays as cheap as the badge.

## Implementation Decisions

All settled in the grilling session (2026-08-17) and validated by the working prototype:

- **Flask toggle semantics:** nothing open → open popover; popover open → close popover; any full
  panel open → close it. `aria-pressed` reflects popover-or-panel open.
- **Popover content = the whole World Doctor Instrument, unchanged.** The Issues list component is
  extracted/exported and reused; no forked layout. The lens bar and other Instruments are
  panel-only.
- **Item clicks never close a desktop surface.** Popover and embedded both stay open on navigation
  (mobile Drawer keeps closing). No click feedback beyond the navigation itself — in embedded
  placement the detail panel showing the item *is* the feedback.
- **Seen-state:** closing the popover calls the same mark-all-seen path as closing the panel.
  Opening the panel *from* the popover skips the mark (the list stays in front of the author).
- **Placement** is a two-value enum (`embedded` default, `docked`), persisted in localStorage as a
  global preference (not per-world), read by the popover's "Open Test Bench" and by the dev route.
- **Embedded placement** swaps the first panel's tab strip + add/search bar + list for the Bench;
  editor tab/search/selection state persists untouched behind it. The Bench header gains the
  placement toggle; its existing close control exits. The Bench drops its own container padding
  when embedded so its chrome aligns exactly where the tab strip sat (prototype finding).
- **Popover mechanics (prototype findings):** the flask is a Radix *anchor*, not a trigger, so its
  own onClick owns the toggle; an interact-outside guard ignores clicks on the anchor to prevent
  close-then-reopen flicker. Content renders non-portaled (the editor lives in a modal Dialog whose
  scroll lock swallows wheel on portaled content). The findings list scrolls in a native
  max-height wrapper because the Instrument's own ScrollArea can't resolve `h-full` against a
  max-height-only parent.
- **Unchanged:** badge math, seen/dismissed storage shape, all rule/fix/lens/opening seams, the
  `bench=` dev-route ledger and drift guard, ADR 0005 (computation, never model judgment).
- No export-shape impact; all new state is Bench-local (localStorage).

## Testing Decisions

- **One seam: the existing WorldEditor bench harness** (real editor, real providers, real flask
  clicks). Good tests assert author-visible behavior — what's in the DOM after a click — never hook
  internals. Prior art: the quick-fix and stat-code-check view tests that already drive this
  harness.
- Harness coverage: flask opens popover with findings; item click navigates while popover stays;
  popover close quiets the badge (loud → muted); "Open Test Bench" embeds — editor tabs gone,
  detail pane still present; placement toggle docks and the third panel appears; placement survives
  close/reopen (localStorage observable in jsdom); flask closes an open panel; mobile flag routes
  the full panel to the Drawer and item clicks close it.
- The harness's "open the bench" helper changes meaning (flask now opens the popover) — update it
  to go through the popover explicitly rather than teaching tests a fiction.
- The presentational panel test covers only the placement-toggle chrome (label/icon per placement,
  absence in the Drawer).
- Guards must bite: for the seen-state and placement-memory tests, reinstate-the-bug proof per the
  test bar (e.g. drop the mark-seen call, watch the badge test fail).
- jsdom notes: pointer-capture stub already exists for Radix; the popover renders inline
  (non-portaled), so no portal queries needed.

## Out of Scope

- Per-item seen marking, lens bar or other Instruments in the popover, popover-open persistence.
- An embedded placement on mobile (Drawer stays the mobile full panel).
- Any change to rules, fixes, seen/dismissed storage shape, or Instrument internals.
- Removing the dock.

## Further Notes

- Vocabulary lives in `CONTEXT.md` (Test Bench, Bench Popover, World Doctor, Instrument).
- A validated prototype of the full design currently sits as an uncommitted diff in the working
  tree (marked `PROTOTYPE (bench-popover)`), verified live 2026-08-17. Capture it to a
  `prototype/bench-popover` branch when implementation starts; the real build rewrites it properly
  (persistence, tests, the harness update) rather than promoting it as-is.
- Changelog: user-facing entry in the In-Progress 👤 bucket when built.
