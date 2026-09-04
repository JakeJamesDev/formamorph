# Spec: Listing Changelog

Status: done

Author-maintained update history on published listings, shown as a `Changelog | Comments` segmented control in the community details modal. Spans both repos: the Formamorph client and FormamorphServer.

## Problem Statement

Authors update their published listings, but there is no way to tell anyone what changed. A player whose downloaded copy shows "Update Available" has no information to decide whether the update matters to them. Authors who iterate seriously on a world have no place to record its history, and a world's evolution over months of updates is invisible to the community.

## Solution

Each published listing (any kind — world, entity, dictionary) can carry a **Listing Changelog**: a list of **Changelog Entries**, each with an author-chosen title, a markdown body, and an author-set date, shown newest-first. Viewers read it in the community details modal via a segmented control that switches the right panel between Changelog and Comments. Authors add an entry as an optional part of the update-publish flow, and can add, edit, or delete entries at any time from the changelog tab itself — including backfilling history for a listing published long ago. One shared entry popup (title field + the standard markdown toolbar) serves every surface.

The changelog is listing metadata, like likes and comments — it never travels inside the content blob, never appears in downloads or exports, and editing it never marks the listing as updated.

## User Stories

1. As a world author, I want to describe what changed when I publish an update, so that players know what they're getting.
2. As a world author, I want the changelog ask to be skippable, so that a quick fix doesn't force me through extra ceremony.
3. As a world author, I want to be asked only when updating an existing listing (not on first publish), so that I'm not prompted to log changes that don't exist yet.
4. As a world author, I want to add a changelog to a listing I published long ago, so that I can backfill its history after the fact.
5. As a world author, I want to publish first and write the changelog later, so that shipping isn't blocked on writing.
6. As a world author, I want to edit an existing entry, so that a typo or omission isn't locked in forever.
7. As a world author, I want to delete an entry, so that I can retract something I no longer stand behind.
8. As a world author, I want to set each entry's date myself, so that backfilled entries can carry the date the update actually happened.
9. As a world author, I want to title entries however I like ("Update 1", "New for v2"), so that the changelog matches how I think about my world's versions.
10. As a world author, I want markdown with the familiar toolbar when writing entries, so that changelogs are formatted like everything else I write in the app.
11. As a world author, I want the same popup for writing an entry whether I'm publishing, backfilling, or editing, so that the flow is always familiar.
12. As a world author, I want fixing a changelog typo to not resurface my listing as "recently updated" or flash "Update Available" at downloaders, so that metadata edits stay silent.
13. As a world author, I want to see an "add changelog" affordance on my own listing even when the changelog is empty, so that the entry point is where the result will appear.
14. As a world author with an entry in a contest being judged, I want to still write changelog entries, so that the content lock doesn't block harmless notes.
15. As an entity or dictionary author, I want changelogs on my published listings too, so that non-world creations get the same treatment.
16. As a community browser, I want to read a listing's changelog in the details modal, so that I can see how actively it's maintained before downloading.
17. As a community browser, I want listings without a changelog to look exactly as they do today, so that the majority of listings carry no empty-tab clutter.
18. As a community browser, I want changelog entries rendered as markdown, newest first with their dates, so that history is easy to scan.
19. As a downloader with an update pending, I want the details modal to open on the changelog, so that "what changed?" is answered at the moment I'm deciding whether to update.
20. As a downloader, I want the changelog excluded from the downloaded world data, so that my local copy and exports carry only the world itself.
21. As a moderator, I want a listing with an abusive changelog handled by the existing quarantine flow, so that no new moderation surface is needed.
22. As a user on an old client or against an old server deploy, I want the feature to be simply invisible rather than broken, so that client and server can ship in any order.

## Implementation Decisions

**Domain model** (terms in the project glossary):
- A **Changelog Entry** is `{ id, title, markdown body, author-set date (day granularity), created/updated timestamps }`. The date defaults to today in the popup and is displayed to viewers.
- Entries sort by author-set date descending; ties break by creation time. No manual reordering.
- The changelog applies to all published kinds — worlds, entities, dictionaries. Canonical term: **Listing Changelog**.

**Server (FormamorphServer)**:
- New child table (`world_changelog`-style) with cascade delete from the listings table — *not* a column on the listings table, because the catalog list projection leaks all listing columns into every row by default.
- Schema follows the established dual-write migration pattern: identical DDL in the fresh-DB table creation and in a new idempotent migration module, wired into server boot before index creation, and asserted by the boot-schema test.
- New sub-resource routes under the listing (`…/:id/changelog` + `…/:id/changelog/:entryId`) for create, update, delete — small-JSON body parser, standard owner-or-moderator authorization, suspended-account and quarantine-visibility rules matching comments.
- Reads: the changelog is embedded in the single-listing GET behind an opt-in query flag (mirroring `includeComments`). It is never served from the content endpoint (which increments the download counter) and never included in catalog list responses.
- Changelog writes do **not** bump the listing's `updated_at` — matching the documented spoiler/withdraw precedent that metadata-only changes don't touch the catalog freshness key.
- The contest judging lock (409 CONTEST_LOCKED) does **not** apply to changelog routes — same standing as comments.
- Validation in the named-constants controller style: title ≤ 120 chars, body ≤ 4000 chars, bounded entry count per listing (100), date must parse as an ISO calendar date. Timestamps follow the server's ISO-string convention.
- Moderation: no per-entry moderation surface in v1; listing-level quarantine covers bad changelogs. (The owner-or-moderator check on mutations means staff *can* remove an entry through the normal route if ever needed.)

**Client (Formamorph)**:
- The changelog never enters the world blob, IndexedDB world records, or import/export — **no export-shape change**.
- A new pure logic module owns entry sorting, client-side validation, the default-tab decision, and endpoint-absence detection. UI components stay thin over it.
- **Details modal right panel**: a two-item segmented control (ToggleGroup, per the project's segmented-control convention — ignore empty values) switching the right panel between Changelog and Comments. Default tab is Comments, except when the viewer's downloaded copy has a pending update (per the existing download-state helper), then Changelog.
- **Empty state**: viewers see no segmented control at all when the changelog is empty — the panel looks exactly as today. The listing's owner sees the control with an "Add Entry" affordance in the empty changelog tab.
- **Shared entry popup**: edits exactly one entry — title input, date input (defaulting to today), and the markdown-enabled prompt field with the standard toolbar and preview. Used for add, edit, and the publish flow. Rendering in the tab uses the app's standard markdown renderer.
- **Publish flow**: when "update existing listing" is selected in the publish modal, an optional "describe what changed" affordance opens the shared popup. The drafted entry is held locally and submitted only after the update-publish succeeds; a failed publish loses nothing. First publish ("publish as new") shows no changelog affordance.
- **Owner affordances** in the changelog tab (Add / per-entry Edit / Delete) gate on the existing own-listing check.
- **Graceful degradation**: if the server doesn't return/support changelog data (old deploy), the feature is invisible — no tab, no publish-flow section, no errors. Ship order between client and server doesn't matter.

## Testing Decisions

Good tests here assert external behavior at the seams below — HTTP responses and rendered/interactive UI — never internal call structure.

**Server — existing HTTP-route seam.** One new test file in the established route-test style (prior art: the worlds, likes, and contest-entries suites): entry CRUD happy paths; 401/403 for anonymous, non-owner, and suspended callers; moderator override; validation caps (title/body/count/date); quarantine visibility on reads; opt-in embed flag on the single-listing GET; changelog absent from catalog list responses; `updated_at` unchanged after changelog writes; contest-lock non-applicability; cascade delete with the listing. Plus the boot-schema test's table list and migration-wiring assertions.

**Client — one new seam (the pure module) + existing component-test seam.** The pure module gets lib-style unit tests: sort order incl. date ties, validation, default-tab decision (update pending vs not), absence detection. Component tests in the existing dialog-test style (prior art: the modal component suites, e.g. the add-entity dialog tests): the shared popup (add vs edit prefill, submit payload, cancel), and the details right panel (segmented control presence/absence per empty-state rules, owner vs viewer affordances, default-tab behavior) with the storage service mocked.

Per the test bar: each guard must be shown to fail when its bug is reinstated; no rigging scenarios to dodge mechanics.

## Out of Scope

- Surfacing the changelog in the local library's world modal or the library "update available" notice (named-for-later; the community details modal is the only v1 surface).
- Changelog presence/preview on listing cards.
- Notifications or feeds for new entries.
- Manual entry reordering.
- A user-facing report/flag system for changelog content.
- Any server-side markdown sanitization beyond what comments/descriptions already get (the client renders through the same renderer used for descriptions today).
- Steam Workshop parity (Steam sharing is a separate future lane).

## Further Notes

- Glossary terms **Listing Changelog** and **Changelog Entry** are recorded in the project CONTEXT.md.
- FormamorphServer is ours but FieryLion hosts the production deploy — graceful client degradation exists precisely so the hosted deploy can lag the client release.
- The "no `updated_at` bump" decision is a candidate ADR (hard to reverse, surprising later, real trade-off); not yet written pending the user's call.
- Publish-flow entries ride an actual content update, which bumps `updated_at` through the normal path — the no-bump rule concerns only the changelog sub-resource writes.
