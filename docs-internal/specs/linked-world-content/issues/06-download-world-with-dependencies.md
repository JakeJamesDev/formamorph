# 06: Download a world with dependencies and add-ons

Status: ready-for-human
Base: ac7c261c
Status note: Built in `55e97dd3`. Five of the six acceptance criteria verified end to end against the
local server. One scope question is open for the author; see Comments.
Blocked by: 01, 04
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Model rationale: extends the download coordination boundary into a multi-listing operation with partial failure, retry, and linking, and it is the path every player takes.

## Parent

[spec.md](../spec.md) — Relationship authority and download behavior, Missing sources and offline use, Settled follow-up decisions (Unlisted), Proposed implementation boundary.

## What to build

A player downloading a community world receives its required content automatically and chooses its optional content.

The community world details window gains a **Linked Content** section with three tabs: **Required**, listing dependencies as included; **Approved Add-ons**; and **Community Add-ons**, each with a checkbox per item. Declined add-ons never appear. The action column's download button reads the count of required and selected items. Unlisted required components arrive through this path like any other and are never offered under the add-on tabs.

The download coordinator resolves the world's sources, downloads the world, the required components, and the selected add-ons, places components in the library, and links the world's copies to them with the link record from ticket 01. A required component that fails leaves the world download pending: completed items are kept and a Retry finishes the rest. An optional component that fails does not hold up the world; it is reported with its own Retry. Re-downloading a world a player already has keeps today's copy and update decisions.

## Acceptance criteria

- [x] The details window shows Required with the world's dependencies, and Approved and Community tabs with checkboxes; a declined add-on is absent from every tab.
- [x] Download installs the world, its required components, and the selected add-ons; each world copy shows Linked with its source in the World Editor.
- [x] An unlisted required component installs and links; it is absent from both add-on tabs.
- [x] A required download failure keeps the world pending with Retry; retry completes it without re-downloading finished items.
- [x] An optional download failure leaves the world ready and offers Retry for that item only.
- [x] Type check, lint, tests, and build pass; the test drives the real coordinator against a stubbed catalog, not a copied prototype transition.

## Blocked by

- 01 — Link metadata on world content.
- 04 — Server: listing relationships and Unlisted.

## Comments

### Handover (2026-09-13)

Built in `55e97dd3`. Four gates green in this turn: `typecheck` 0 errors, `lint` 0 errors, `test` 591
files / 9721 tests pass in 63.05 s, `build` 14.49 s.

**Verified end to end against the local server**, not only in tests. The world's two required sources
installed, including the unlisted `Sedge`, which a signed-out reader reached only through
`/dependencies/:id/content`. The selected add-on installed. The declined offering and the unlisted one
were absent from both add-on tabs. Each downloaded copy opens in the World Editor as **Linked** with its
source named. A dependency pointed at a deleted listing kept the world out of the library, named the
failure, and **Retry** finished it once the listing resolved, without re-downloading the world or the
source that had already landed.

**What the build added beyond the ticket.** `saveDownloadToLibrary` keeps an edited library copy rather
than replacing it, and the world's copy follows the copy the player has. Replacing it would discard
their work with no warning; taking the source's version belongs to the update review in ticket 08. Say
if you want the opposite.

**Found in live use and fixed.** An add-on the player ticks can stop being offered between the review
and the press, if its author unlists it or the world's author declines it. The first build installed the
world, said success, and dropped the selection in silence. It now reports that row by name with its own
Retry.

### Open for the author

**Do selected add-ons join the world, or only the library?** The build installs them into the library and
stops there. Two readings of the ticket both fit:

- **Library only** (what is built). The spec's acceptance table says *"Download world with selected
  add-ons | Only selected optional content is **installed**, alongside requirements."* The player then
  adds one to their world through **Add from Library**, which is where Connect World References fires.
- **Into the world too.** The ticket says the coordinator *"links the world's copies to them"*, and the
  relationship table says add-ons *"download and **link** only selected items"*, in the same sentence
  shape as required content.

The second reading means running the Connect World References step during a community download, outside
the World Editor. The spec does expect that flow outside the editor for component file import, so it is
not unprecedented — but it is a materially bigger build and a different surface. Your call.

### Follow-up noticed, not fixed

`saveDownloadToLibrary` and `useLibraryDownload`'s own store step now hold the same rules twice: one copy
per listing keyed on `sourceId`, a fresh record id rather than the content's, and the same community
stamps. They already differ on an edited copy — `useLibraryDownload` asks the player, this one keeps it.
One shared store step would put that decision in one place. It touches a shipped path, so it is a
proposal rather than something folded in here.
