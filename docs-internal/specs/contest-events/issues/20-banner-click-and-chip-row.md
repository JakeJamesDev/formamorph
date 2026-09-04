# Spec — Banner Repeat-Click Fix + Chip Fold-Into-Top-Bar

Status: ready-for-agent
Type: task
Assembled: 2026-08-21 (from a grilling session on two player-reported banner issues)
Repo: **formamorph** (client only)

## Problem Statement

Two player-facing defects in the event banner. First, the View Entries action works exactly once:
every click routes through MainMenu's `openEvent` (`MainMenu.tsx:1280`), which sets
`communityTab: 'contest'` + opens the browser — but once the browser is open with that state
already set, both setStates are identity no-ops, React bails, and the tab-apply effect
(`CommunityCreationsBrowser.tsx:235`, deps `[open, initialTab]`) never refires. The banner
instance *inside* the browser header is therefore dead after first use: switch to another tab,
click View Entries (or the dismissed chip), nothing happens. The main-menu path only recovers
because closing the browser clears `communityTab` (`MainMenu.tsx:2515`).

Second, a dismissed banner collapses to a small chip that keeps a dedicated full-width row of its
own (`EventBanner.tsx:67`, right-aligned `flex justify-end px-4 pb-2`) — a mostly-empty reserved
row for a tiny badge, on both surfaces (main menu and the Community Creations header).

## Solution

The in-browser banner drives the browser's own tab state: its `onOpenEvent` is wrapped so a
contest event calls `setBrowseTab('contest')` directly — state the browser owns, so every click
works. MainMenu's `openEvent` path is untouched for the main-menu banner and the ack modal.

The dedicated chip row is deleted on both surfaces. All dismissed chips — contest and
announcement alike, side by side when both are dismissed — fold into each surface's existing top
row: the main menu's fixed top bar center cell (trailing the action buttons; next to the
hamburger on mobile, same treatment at every breakpoint) and the browser's header toolbar
(appended after the sort control, wrapping with it).

## User Stories

1. As a player browsing another tab in Community Creations, I want View Entries to take me to the contest tab every time, so that the button never silently dies after first use.
2. As a player who dismissed the contest banner in the browser, I want the chip to reopen the contest tab every time too, so that the collapsed form keeps the same guarantee.
3. As a player who dismissed a banner, I want no reserved empty row left behind, so that dismissing actually reclaims the space.
4. As a player on the main menu, I want the dismissed chip centered in the top bar I already have, so that the event stays reachable without costing a row.
5. As a player in Community Creations, I want the dismissed chip in the header toolbar, so that the header stack shrinks to what's actually showing.
6. As a player with a contest and an announcement both dismissed, I want both chips side by side in that same spot, so that the two kinds behave identically.
7. As a player who clicks a dismissed announcement chip, I want the card to re-expand in its normal banner position, so that the existing re-open behavior survives the move.

## Implementation Decisions

- **Bug 1 fix (chosen: browser sets its own tab)**: CommunityCreationsBrowser passes its banner a
  wrapped handler — contest events call `setBrowseTab('contest')` directly; anything else falls
  through to the host `onOpenEvent`. Rejected alternatives: a request-object nonce from MainMenu
  (indirection for a problem only the in-browser instance has) and an ack callback clearing
  `communityTab` after apply (two extra wiring points).
- **Chip placement, main menu**: chips join the fixed top bar's center cell after the action
  buttons — the cell already sits at true viewport center. On mobile they sit in the middle
  region beside the hamburger; the chip title already truncates (`max-w-[14rem]`) and may
  tighten further. One behavior at every breakpoint.
- **Chip placement, browser**: one more toolbar item appended after the sort control in the
  wrapping header row. True centering is impossible in a wrapping toolbar; appended-and-wrapping
  was chosen over the filter-bar row (hidden inside the mobile collapsible).
- **Component split**: EventBanner separates into a cards surface and a chips cluster, since the
  two now render in different DOM locations. Dismissed state lifts out of the per-card
  `useState` so dismissing a card shows its chip elsewhere immediately — backed by the existing
  `eventSeenStore` keying (`event.id:phase`), which is unchanged.
- **Click behaviors unchanged**: contest chip opens the contest tab (via the same wrapped
  handler in-browser); announcement chip re-expands its card, which reappears in the normal
  banner position.
- **The main-menu banner card row** stays where it is; only the dismissed form moves. When every
  event is dismissed, the in-flow banner row renders nothing.

## Testing Decisions

- Seam: the existing Vitest + RTL harness (`EventBanner.test.tsx`, the CommunityCreationsBrowser
  event/contest test files). Existing dismissed-row assertions update to the new structure.
- New regression tests, each proven against the reinstated bug: View Entries from the in-browser
  banner lands on the contest tab after navigating away (the dead-click repro); the dismissed
  chip in-browser does the same; dismissing a card renders its chip in the host slot and removes
  the dedicated row.
- The contest E2E flow (`npm run test:e2e`) re-run; updated if it touches the dismissed chip or
  View Entries placement.
- Time the suite and report the number.

## Out of Scope

- Any change to `eventSeenStore` keying or the phase-keyed re-announce behavior.
- The acknowledge modal — its Open action routes through `openEvent` from the main menu, where
  the existing path works.
- Server changes of any kind.

## Further Notes

- Decisions provenance: 2026-08-21 grilling session, two rounds, all recommended options
  accepted (fix approach; both surfaces; fold into existing top bars; all chips side by side;
  same treatment on mobile; this ticket).
- Changelog: 👤 Fixed entries for both defects in the In-Progress bucket.
