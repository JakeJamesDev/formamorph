# Contest Podium — First, Second, and Third Place

Status: done

## Problem Statement

A contest can currently crown exactly one winner. Real contests have runners-up worth celebrating: authors who placed second or third get no recognition, and players browsing the community can't see which worlds nearly won. The single write-once winner also makes the results moment brittle — one pick instantly announces, decides the contest, and unlocks entries, with no way to correct a mistake or add places later.

## Solution

Contests award a podium of up to three places — 1st (gold), 2nd (silver), 3rd (bronze). An admin assembles the podium in a dialog and hits Announce Results, which publishes all assigned places at once: one broadcast naming the podium, the contest flips to decided, and the entry lock lifts. Placed worlds carry metal-colored place badges everywhere worlds are shown, with identical treatment across surfaces. Announced podiums remain editable by admins (silently, audited). Nothing about this feature has shipped, so the existing single-winner schema and API are replaced outright — no legacy mirroring.

## User Stories

1. As a contest entrant, I want my world to be awardable 2nd or 3rd place, so that a strong showing is recognized even when I don't win.
2. As a player browsing community creations, I want to see gold, silver, and bronze badges on placed worlds, so that I can find the contest's best entries at a glance.
3. As a player, I want place badges to read "1st Place — {contest}", "2nd Place — {contest}", "3rd Place — {contest}", so that the placement and which contest it came from are both unambiguous.
4. As a player, I want the badges to use gold, silver, and bronze metal colors, so that the place is readable by color alone.
5. As a player, I want the badges legible in both light and dark themes, so that no theme makes silver or bronze unreadable.
6. As a player, I want a world that placed in multiple contests to show one badge line per placement, so that a decorated world's full record is visible.
7. As a player viewing a world's details (community or local library), I want its placements shown the same way as on its card, so that the presentation is consistent.
8. As a player with a downloaded copy of a placed world, I want the badge on my local library card too, so that I know I own a podium world.
9. As a player viewing a decided contest in the archive, I want a podium band listing all announced places in order, so that the results read like results.
10. As a player viewing the contest archive's status line, I want decided contests summarized by their results rather than "Won by …" singular, so that podium contests aren't misdescribed.
11. As a player, I want the results broadcast to name every announced place, so that one message tells me the full outcome.
12. As a player, I want contest entry lists ordered gold, silver, bronze, then the rest, so that placed entries lead.
13. As a player who is offline, I want no stale placement badges invented from a persisted cache, so that what I see is always current-or-nothing (existing behavior, preserved).
14. As an admin, I want a podium dialog that lets me assign 1st, 2nd, and 3rd from the contest's entries, so that I can judge the whole contest in one sitting.
15. As an admin, I want to announce with only some places filled (gold alone, or gold + silver), so that a small contest isn't forced to invent three winners.
16. As an admin, I want the dialog to enforce contiguity — no 2nd without 1st, no 3rd without 2nd — so that a half-podium with gaps can't be published.
17. As an admin, I want Announce Results blocked until at least 1st place is assigned, so that an empty announcement is impossible.
18. As an admin, I want the announce to be one atomic call publishing the whole podium, so that players never see a partially-published result.
19. As an admin, I want to edit an announced podium later — add a missing place, fix a wrong one — so that mistakes are correctable.
20. As an admin, I want podium edits to be silent (no new broadcast) but audited, so that corrections don't spam players yet leave a trail.
21. As an admin, I want existing contests that already recorded a winner to show that world as 1st place and be editable like any announced podium, so that the old data joins the new model.
22. As an admin, I want the same entry-eligibility guards as today (no quarantined entries, no entries I authored), applied to every place, so that the fairness rules extend to the whole podium.
23. As an admin, I want assigning the same world to two places rejected, so that the strict-podium rule can't be violated by accident.
24. As a staff member who is not an admin, I want announce and edit actions hidden from me, so that podium control is clearly admin-only (a tightening of the current any-staff pick).
25. As an admin, I want a broadcast preview before announcing, so that I can check the message players will receive.
26. As a contest entrant, I want my placed world protected from withdrawal, so that the podium record can't be hollowed out (extends the current winner-only protection to all places).
27. As a contest entrant, I want entries to stay locked until results are announced — not until the first place is picked — so that judging finishes before the lock lifts.
28. As an author whose placed world is later deleted, I want the podium to still show my world's name and author via snapshots, so that the archive survives deletions (existing behavior, extended per-place).
29. As a player, I want the top-bar event chip to mark a decided contest by its results, so that the chip's wording matches the podium model.
30. As a moderator reviewing the audit log, I want announce and each podium edit recorded with who did it, so that results changes are accountable.
31. As a developer, I want the dev event samples and test fixtures to model podium contests, so that dev surfaces exercise the new shape.

## Implementation Decisions

- **Placements replace the winner.** The server's three write-once winner columns and the single-winner pick endpoint are removed, not mirrored — the feature never shipped, so there is no compatibility to preserve. Placements are stored per event as (place, world reference, world-name snapshot, author-name snapshot), place ∈ {1, 2, 3}, unique per place and per world within an event.
- **Strict podium.** One world per place, one place per world, contiguous from gold. Enforced server-side on write and client-side in the dialog.
- **Announce is the decision moment.** A new announce endpoint accepts the full podium in one atomic request: validates admin role, entry membership, quarantine, self-authorship, contiguity, ≥ gold; stores placements; posts one broadcast naming all places; stamps the announcement. "Decided" is defined by the announcement having happened, not by any single place existing. The existing winner-message-id field carries the podium broadcast's id.
- **Edits are a separate admin-only endpoint** over the same validation, allowed only after announce, no broadcast, audited per change.
- **Permissions tighten to admin-only** for both announce and edit (today any staff can pick a winner). The action-gating helper exposes this so the UI hides the controls from non-admin staff.
- **Existing winner data migrates to a gold placement** with its snapshots, treated as announced (the presence of the legacy pick counts as the announcement). After migration the legacy columns go away.
- **Client type gains a placements list** on the server-event shape; the "has winner" helper becomes an announced/decided check over the announcement, and a placement-lookup helper replaces the single-winner equality check. The badge-source helper returns (contest, place) pairs instead of bare contests so the badge component can color and label per place.
- **The winner-pick dialog becomes the podium dialog**: three slots, entries assignable to a slot, local staging only (no server drafts), single announce call. Reused for post-announce editing.
- **Badge presentation**: one badge component renders ordinal label + contest title with a Trophy icon, colored by three new theme-aware metal tokens (gold/silver/bronze) defined in the theme layer — the current single warning-colored badge retires. All current badge surfaces (community card, community details, local library card, local details) render placements identically. The archive's single-winner band becomes a podium band. All "Winner …" literals (chip marker, status lines, banner, ack modal, admin summary, broadcast template) move to results/podium wording.
- **Entry ordering** pins gold, silver, bronze, then the existing likes order.
- **Withdrawal refusal and the post-deadline entry lock** key on placements/announcement instead of the single winner field: any placed world is withdrawal-protected; the lock lifts at announce.
- **No local persistence of placements.** Placement remains derived at render from the in-memory events cache; nothing is written to the stored world record, the world export, or the save envelope.
- **Both repos change**: the client and FormamorphServer are implemented together here; the prod deploy/migration is coordinated with the server owner before release.

## Testing Decisions

- Good tests assert external behavior at the seam — what a caller observes — never internal wiring; each guard must demonstrably fail if its rule is removed.
- **Client pure-lib seam** (primary): the contest/server-event/admin-event helpers tested over constructed server-event values — placement lookup, badge-source pairs, entry ordering with a podium, phase derivation from the announcement, chip marker text, admin action gating by role and state. Prior art: the existing unit tests beside those modules.
- **Client component seam**: podium dialog behavior (slot assignment, contiguity enforcement, announce disabled below gold, blocked entries, atomic submit, edit mode) and badge rendering per place on library and community surfaces. Prior art: the existing winner-pick-dialog and winner-badge component tests.
- **Server HTTP seam**: endpoint tests for announce and edit — validation matrix (role, membership, quarantine, self-pick, contiguity, duplicates, double-announce), broadcast emission, audit entries, migration of legacy winner rows. Prior art: the existing events-admin endpoint tests.
- **E2E**: extend the existing contest-entry journey to cover a podium announce appearing on player surfaces.
- Fixtures and dev event samples updated to the placements shape.

## Out of Scope

- Ties, shared places, or more than three places.
- Server-side draft podiums or multi-session judging state.
- Re-broadcasting on podium edits.
- Any placement data in world exports or save envelopes.
- Player-facing voting or any judging mechanism beyond admin assignment.
- Backfilling 2nd/3rd for past contests (the data becomes editable; actually assigning places to old contests is a manual admin activity, not part of this build).
- Legacy-field mirroring or old-client compatibility (nothing shipped).

## Further Notes

- The metal color tokens don't exist in the theme today; they must be added for both themes and are the only new visual primitives.
- The events cache is deliberately session-only so offline players never see stale results; placements ride the same cache and inherit that property.
- Admin-only podium control is a deliberate tightening from today's any-staff winner pick.
