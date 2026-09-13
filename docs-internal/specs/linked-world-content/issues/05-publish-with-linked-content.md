# 05: Publish with linked content

Status: ready-for-human
Base: ed020de2
Status note: Built in `6c59c285`. Every acceptance criterion passes, five of the six verified end to end
against the local server. Two product calls are open for the author; see Comments.
Blocked by: 01, 04
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Model rationale: a multi-step publication with ordering, partial success, and retry across two kinds of listing, wired into the existing publish dialog for all three kinds.

## Parent

[spec.md](../spec.md) — Publishing and updating, World publishing review: Linked Content, Component publishing: Compatible Worlds, Settled follow-up decisions (Unlisted).

## What to build

Publishing a world can publish its linked components in the same action, and publishing a component declares where it fits.

The publish dialog for a world gains a **Linked Content** section after the existing new-or-overwrite choice. Each linked component has **Include as required**, checked by default on first publication and remembered after. An owned source that is not yet published shows **Will publish with this world** and a Public/Unlisted choice that defaults to Unlisted. Unchecked content is embedded in the world with no published dependency; an unlisted source keeps its listing state. Another author's published source is never republished. On Publish, owned required sources publish first; each success persists; the world publishes only when every required source exists, and a failure leaves the world pending with Retry.

The publish dialog for a component gains a **Listing** choice, Public or Unlisted, and a **Compatible Worlds** section listing the published worlds that hold a linked copy of it, each with **Offer as add-on** and the current review state. Unlisted makes the component required-only: Compatible Worlds is disabled with an explanation. A local link removed since the last publication appears as a pending removal that Publish applies.

## Acceptance criteria

- [x] Publishing a world with one owned unpublished required source publishes the source unlisted first, then the world with the dependency declared; the local link is preserved.
- [x] Unchecking Include as required embeds the content; the published world declares no dependency for it and the source's listing state is unchanged.
- [x] A required source that fails to publish leaves the world unpublished with Retry; the sources that succeeded are not republished on retry.
- [x] Publishing a component with Offer as add-on for one world creates the association; the world author sees it as unreviewed.
- [x] Choosing Unlisted disables Compatible Worlds and publishes no associations.
- [x] Removing a local link, then publishing the component, removes that association.
- [x] Type check, lint, tests, and build pass.

## Blocked by

- 01 — Link metadata on world content.
- 04 — Server: listing relationships and Unlisted.

## Comments

**Implemented in `6c59c285` (Base `ed020de2`).** Four gates green: `typecheck` 0 errors, `lint` 0 errors,
`npm test` 9670 passed / 3 skipped in 62.2 s, `build` succeeded. `graphify update .` run.

**Verified end to end against the local server** (`FormamorphServer` on 8797), not mocks:

- Publishing a world with two owned unpublished sources created both as unlisted listings first, then the
  world; `GET /worlds/:id/dependencies` returned both with `status: ok`. The local links survived.
- The published world's required copies carry `link: { sourceId, sourceName }`; `libraryId`,
  `sourceRevision` and `reviewedRevision` are stripped. An unchecked copy publishes with no `link` at all.
- Publishing the dictionary with **Offer as add-on** created the association; the world's `/addons`
  showed it `unreviewed`. Choosing **Unlisted** disabled the section and sent `compatibleWorlds: []`.
- Unlinking the copy, then publishing, applied the pending removal.

The Retry path is covered by tests rather than live: forcing a real partial failure needs a server the
run can refuse mid-way.

**Two decisions the author should confirm:**

1. **Published-world shape.** A required copy's `link` now names the listing, and an embedded copy has
   none. The world *export* shape is unchanged and the version was not bumped, but this is the shape
   ticket 06 reads.
2. **A pre-feature listing's first linked publish starts unchecked, not checked.** The spec says
   *"**Include as required** starts checked for linked components on first publication"*, but a listing
   that predates this feature returns an empty required set, which is indistinguishable from an author
   who unchecked everything last time. Checking by default there would publish listings for their library
   items without them asking, so safety won. Say if you want the spec's literal default instead.

**One limitation, by construction:** *"Default to Unlisted when first publishing it as a dependency;
preserve the choice on later publications."* An unpublished source has no listing to preserve a choice
on, so every unpublished row defaults to Unlisted. Once published, the source is never republished by
this flow, so the choice stands on the server.

**Deviation from the effort's own conventions, noted deliberately:** two listing reads per selected row
were avoided. `declaresRelationships` keeps the once-per-opening changelog probe for a world that follows
nothing; only a world with linked content or a component pays the per-row read.

