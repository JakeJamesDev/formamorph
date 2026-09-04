# Spec — Contest Build Review Fixes

Status: ready-for-agent
Type: task
Assembled: 2026-08-21 (from the two-axis code review of the client contest build, commits 36aae90..a34b558)
Repo: **formamorph** (client only — no server changes; the withdraw route already exists from ticket 11)

## Problem Statement

The contest/events client build shipped with gaps a player will actually hit: a player who
launches the app after a contest deadline never sees the "judging has begun" poster (it only
reaches sessions that happened to be polling when the window closed); an author who wants to
withdraw their entry has no button anywhere — even though the publish card's copy tells them to
"withdraw it first"; and if two events run at once, only the first ever surfaces as a banner.
Alongside these, the review found standards drift: newly coined British spellings, a fixture
builder copy-pasted across seven test files, a winner predicate written two subtly different
ways with nothing marking the difference as deliberate, and several smaller cleanups. Finally,
several shipped behaviors (all kept deliberately) aren't in the spec, so the spec no longer
describes the build.

## Solution

Close the three player-facing gaps: the end-phase poster becomes reachable by sourcing ended
contests from the contests feed and showing the poster to anyone while the contest is in judging
(once a winner is picked it stops — winner news travels via the broadcast and the pinned badge);
a Withdraw action appears on the publish modal's already-entered card and on the author's own
entry card in the contest tab, both calling the existing withdraw route; the banner stacks one
card per active event, each dismissing to its own chip, and the contest banner's body becomes
clickable. Clean up the standards drift (American English for new coinage, one shared test
fixture module, named winner predicates, small refactors). Amend the parent spec so the kept
scope-creep behaviors and the archive-selector threshold are documented.

## User Stories

1. As a player who launches the app after a contest deadline, I want the end-of-contest poster shown once, so that I know judging has begun even though I wasn't online at the transition.
2. As a player who already acknowledged the end poster, I want it to stay acknowledged, so that the reachability fix doesn't re-show anything.
3. As a player joining after the winner is picked, I want no stale "judging has begun" poster, so that old news doesn't interrupt me — the winner broadcast and badge carry the outcome.
4. As an author, I want a Withdraw button on the publish modal's already-entered card, so that the card's own "withdraw it first" advice is actionable in place.
5. As an author, I want a Withdraw action on my own entry's card in the contest tab, so that leaving a contest doesn't require starting a publish I don't intend to finish.
6. As an author, I want a confirmation step before withdrawing, so that one mis-click doesn't remove my entry.
7. As an author whose entry was picked winner, I want the withdraw attempt to explain the refusal, so that the server's 409 isn't a silent failure.
8. As an author who just withdrew, I want the publish card and contest tab to reflect it immediately, so that I can re-enter or move on without a reload.
9. As a player, I want one banner per active event stacked on the main menu and in Community Creations, so that a running announcement never hides a running contest (or vice versa).
10. As a player, I want each stacked banner to dismiss to its own chip, so that dismissing one event doesn't dismiss them all.
11. As a player, I want clicking anywhere on the contest banner card to open the contest tab, so that the whole card is the target, not just the View Entries button.
12. As a user of the app, I want new user-facing labels spelled in American English (canceled), so that the app's voice is consistent.
13. As a maintainer, I want the internal event-state vocabulary spelled canceled before it spreads, so that renaming stays cheap.
14. As a maintainer, I want one shared ServerEvent test fixture module, so that adding a field means one edit, not seven.
15. As a maintainer, I want the two "has a winner" checks expressed as named predicates, so that their field asymmetry reads as deliberate or gets unified.
16. As a maintainer, I want the repeated dev-fixture loading effect behind one hook, so that the pattern can't drift between its four call sites.
17. As a maintainer, I want the browser-filter identifiers renamed to match their tab-keyed reality, so that names stop describing the pre-refactor world.
18. As a maintainer, I want the event form's draft built without the cast-and-delete, so that the type system describes what is actually sent.
19. As a maintainer, I want the event form using the shared Label component, so that form chrome matches the rest of the app.
20. As a maintainer, I want the day-in-milliseconds literal named once, so that the magic number stops multiplying.
21. As a user of the app, I want button labels in AP title case, so that the established style rule holds.
22. As a future build session, I want the parent spec amended with the kept behaviors (chip status marker, announcement chip re-expand, winner band, judging by-likes order, focus-refetch floor, archive-selector threshold), so that the spec describes the build.

## Implementation Decisions

- **End poster reachability**: the acknowledge modal's event source widens from active-only to
  active plus ended-and-in-judging contests (ended, no winner, not cancelled), sourced from the
  already-fetched contests feed — no new endpoint, no new poll. The seen-store keying (event id +
  phase, per-device localStorage) is unchanged; the end phase simply becomes reachable. Winner
  pick or cancel ends eligibility. Announcements keep start-phase only.
- **Withdraw**: both surfaces call the existing server withdraw route (owner-or-moderator,
  audited server-side). A confirm dialog guards it. The picked-winner 409 surfaces as an
  explanatory toast. On success both the publish preflight state and the contests feed refresh.
  No new server work.
- **Banner stacking**: the banner component renders every active event, each with independent
  dismiss-to-chip state (already keyed per event in the store). Contest card body becomes a
  click target opening the contest tab; the announcement card body opens its modal. Order:
  contest first, then announcements by start time.
- **Spelling**: every newly coined identifier, state value, and user-facing label uses
  *canceled/canceling*. The API field `cancelledAt` stays as-is (matches the server contract —
  the documented external-spelling exception). The admin event-state union value is internal and
  unpersisted, so the rename is mechanical.
- **Shared fixtures**: one test-support module exports the ServerEvent builder, the day/offset
  helpers, and the matchMedia stub; the seven test files import it. Test behavior unchanged.
- **Winner predicates**: introduce named helpers — one answering "has a winner been picked"
  (world/name fields) and one answering "has the winner been announced" (message field) — and
  route the three existing checks through them. If the build session finds the message-field
  variant was accidental rather than announcement-specific, unify on the pick predicate and say
  so in the ticket comments.
- **Dev fixtures**: one hook owning the flag-checked dynamic import of the dev sample module,
  used by the four current call sites; stays DEV-gated and tree-shaken.
- **Renames**: the community-browser filter internals rename from kind-keyed to tab-keyed names,
  matching the BrowseTab refactor that already happened.
- **Event form**: build the request body conditionally (started events omit the immutable start
  field) instead of deleting through a cast; swap raw labels for the shared Label component.
- **Constants/labels**: a named day-in-ms constant replaces the repeated literal; "Contest
  rules" and any other new non-sentence labels move to AP title case.
- **Spec amendment**: the parent spec gains the kept behaviors as documented decisions — the
  chip's status marker, the announcement chip re-expanding its card, the winner band in the
  contest bar, judging-phase by-likes ordering, the 60-second focus-refetch floor, the E2E
  request-pinning setup, and the archive selector appearing once more than one contest exists in
  total (a lone archive must stay reachable while a contest runs).

## Testing Decisions

- A good test asserts external behavior at the highest existing seam — what a rendered component
  observes through its props and mocked services — never call order or private state.
- **Seam: the existing Vitest + RTL component harness with service-layer mocks** (the same
  harness the contest build's seven test files already use — prior art is those files
  themselves). New assertions extend the existing files: end poster shown for a judging contest
  to a fresh session / suppressed after winner pick / suppressed when acknowledged; withdraw
  flow from both surfaces including the confirm step, the 409 path, and the post-withdraw state
  refresh; stacked banners with independent chips; card-body click targets.
- The shared fixture extraction is proven by the suite staying green with the seven local
  builders deleted — no new tests for test-support code.
- Predicate helpers get direct unit coverage only if the asymmetry survives; if unified, the
  existing component tests already cover the behavior.
- **Drift guards**: no new views or modals expected; if the withdraw confirm lands as a new
  routed dialog, it gets its dev-router entry per the standing convention.
- The Playwright flow is untouched (withdraw is deliberately not E2E'd — the component seam plus
  the server's existing route tests cover it).
- Time the suite and report the number; investigate any gap between total and per-test sums.

## Out of Scope

- A third winner-phase poster for late arrivals — winner news travels via broadcast + badge.
- Any server change — the withdraw route, audit rows, and 409s all exist.
- Reverting any of the kept scope-creep behaviors.
- Re-litigating the archive-selector threshold — kept and documented.
- The E2E suite's registration/pinning extras — kept as-is.

## Further Notes

- Findings provenance: the 2026-08-21 two-axis review (Standards + Spec) of commits
  36aae90..a34b558 against the parent spec; review findings live in the session, decisions
  (all four recommended options accepted) in the ticket above.
- The spelling fix should land early in the build — it touches identifiers other fixes edit.
