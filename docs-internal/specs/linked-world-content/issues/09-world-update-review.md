# 09: World update review with requirement changes

Status: ready-for-human
Base: c4008829
Status note: Built in `36ce2e5b`. Every acceptance criterion passes. Two notes are open for the author;
see Comments. The effort's earlier pause still stands: ticket 03 removes the `LINKING_ENABLED` flag and
is the resume point.
Blocked by: 06, 08
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Model rationale: merges the world update path with component decisions into one review; it must not regress today's overwrite and copy choices.

## Parent

[spec.md](../spec.md) — Publishing and updating, Player edits and update conflicts, Settled follow-up decisions (Relationships over time).

## What to build

A player updating an installed world sees every component consequence in one review before anything changes.

Today's update decision, download a copy or update an existing copy, stays. Updating an existing copy now opens a combined review. It lists changed linked components with the same actions as ticket 08, new required dependencies as rows that download and link on Apply, and requirements the author dropped as rows that become independent copies with content kept. Local replacements keep their protection and default to Keep Mine. One **Apply Updates** confirmation executes the batch; a failed item keeps its previous content and offers Retry while the rest stand. Downloading a separate copy skips the review, as it does today.

## Acceptance criteria

- [x] Updating an existing copy of a republished world opens one review with the world's changed components, new required items, and dropped requirements.
- [x] Apply installs and links a new required item; a dropped requirement becomes an independent copy with its content intact.
- [x] A local replacement defaults to Keep Mine and survives Apply unchanged.
- [x] Download a copy performs no review and installs a fresh world with its current dependencies.
- [x] A failed component in the batch keeps its content with Retry; the world and other components update.
- [x] Type check, lint, tests, and build pass.

## Blocked by

- 06 — Download a world with dependencies and add-ons.
- 08 — Component update review.

## Comments

### Handover (2026-09-13)

Built in `36ce2e5b`. Four gates green in this turn: `typecheck` 0 errors, `lint` 0 errors, `test` 597
files / 9830 tests pass in 70.36 s, `build` 17.38 s. Reachable at
`#dev?view=mainMenu&modal=worldUpdate`, and checked in both themes.

**How Apply protects a copy.** The write cannot merge, so `keepInstalledCopies` puts each protected copy
back into the author's content whole — its own id, its own placeholders, its own content. A merge would
have to invent rules for those, and the review promised the copy survives unchanged. Two things ride
along, neither of them asked for in the ticket, both to stop the write leaving wreckage: a shared
placeholder the kept copy's chips reach is carried into the new world under the same id, and a folder or
location the author deleted is dropped from the copy. Without the first, a kept copy's chips resolve to
nothing.

**Matching a dropped requirement.** Publishing an unchecked source strips its link record, so the
author's embedded copy names no listing and the only key left is its name. That fallback is gated behind
the dropped row kind: a source still required always publishes a copy naming it, so a name match
anywhere else could only hit somebody else's content.

**How an update fails, against how a first download fails.** A first download withholds the world until
every required source is in. An update writes the world anyway and reports the failed source with its
own Retry, because the installed copy already holds that component's previous content — which is exactly
what the ticket asks for, and the opposite of ticket 06's rule. Worth knowing if the two paths are ever
read side by side.

### Open for the author

**No View Changes in this review.** Ticket 08's dialog compares the world's copy against the library
item, both of which are local. Here the author's version is on the server and is not downloaded until
Apply, so there is nothing to compare against while the review is on screen. Comparing against the
library item instead would be worse than nothing: when the listing has republished, the library item is
the stale side, and the comparison would show no change on exactly the row that changed. Closing this
means downloading every required source before the player has agreed to anything. Your call — say if
that trade is worth it.

**A copy that follows a library item and no listing is not in the review, and the update still drops it.**
Content the player added to a downloaded world from their own library has no listing, so the world's
required set cannot speak for it. Overwriting the world removes it. That is today's behavior for any
local addition, not something this build introduced, and it is outside the ticket — but it is the same
class of silent loss this review exists to stop. Ticket 10 or a follow-up.

### Found while building, not fixed

`src/views/CommunityCreationsBrowser.contest.test.tsx` logs three unhandled rejections
(`default.fetchDependencies is not a function`) from ticket 06's `useWorldDownloadPlan`. Its
`WorldStorageService` mock predates the dependency routes. All 39 tests in the file pass, and the errors
are on `main` before this commit. A mock fix, not a product fix.
