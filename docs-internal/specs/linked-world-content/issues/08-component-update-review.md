# 08: Component update review

Status: ready-for-human
Status note: Built in `e380b1d4`. Every acceptance criterion passes, verified against a real stored
world. Three notes are open for the author; see Comments.
Base: 1366f604
Blocked by: 02, 04
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Model rationale: revision comparison across several worlds with four outcomes, a content diff, suppression state, and per-world failure handling; the correctness of local replacements depends on it.

## Parent

[spec.md](../spec.md) — Player edits and update conflicts, Review Updates dialog, Settled follow-up decisions (Updates and repairs).

## What to build

A player checks a library item for source updates and decides, per linked world, what to do.

**Check for Updates** on a library item or a linked world copy compares the source's revision marker with each linked world's held revision. When something changed, an **Update available** dialog lists one row per affected world with its state: Linked, or Local replacement with edits protected. Each row has an action dropdown: **Update**, **Keep Mine**, **Use Author's**, and **Unlink**. Unmodified copies default to Update; local replacements default to Keep Mine. **View Changes** shows changed fields first, added and removed dictionary entries grouped, and unchanged content behind a disclosure. Selecting an action changes nothing until **Apply Updates**, one confirmation for the batch.

Keep Mine stores the reviewed revision on that world copy, so the same revision does not return; the row comes back only when the source changes again. Unlink keeps content and clears the record. A failed world update keeps its previous content and offers Retry while the others' results stand. Checks are user-initiated only; nothing runs on open, launch, or in the background.

## Acceptance criteria

- [x] With no source change, Check for Updates reports up to date and opens no review.
- [x] With a change, the dialog lists each linked world; unmodified copies default to Update and local replacements to Keep Mine.
- [x] View Changes shows the changed entry pair, added and removed entries, and unchanged entries behind a disclosure.
- [x] Apply Updates applies each row's action; Unlink leaves an independent copy with unchanged content.
- [x] After Keep Mine, a second check with the same source revision omits that world; a newer revision lists it again.
- [x] One world failing to update keeps its content and shows Retry; the other worlds' updates persist.
- [x] Type check, lint, tests, and build pass.

## Blocked by

- 02 — Save to Library and Add from Library with links.
- 04 — Server: listing relationships and Unlisted.

## Comments

**Built in `e380b1d4`.** Gates, all run in the closing pass: `typecheck` 0 errors, `lint` 0 errors,
`test` 9799 passed across 596 files in 67.9 s, `build` succeeded in 14.4 s. One earlier full-suite run
reported a single failure whose name the output truncated; three later full-suite runs and five runs of
this unit's three files were green, so it did not recur. The suite also reports 3 teardown errors from
`useWorldDownloadPlan.ts`, raised by `CommunityCreationsBrowser.contest.test.tsx`. That file raises them
when run alone and at Base, and this unit touches neither file.

**Verified end to end against a real stored world.** The dev library already held a `Sedge` library item
that the world `The Long Thaw` follows at an older revision. Check for Updates on the entity tile listed
that world alone, and View Changes read the stored copy and compared it field by field against the
library item. Apply was not pressed there, so the world is untouched. The dev route
`#dev?view=mainMenu&modal=componentUpdates` raises the same dialog on two canned worlds, which is where
both row states, all four entry groups, mobile width, and light theme were checked.

**Where it lives.** `componentUpdates.ts` is the pure half: what needs review, what each state offers,
and the comparison. `componentUpdateRun.ts` reads the worlds and applies one row. `useComponentUpdates`
is the entry point both surfaces share, and `UpdateAvailableDialog` draws the review.
`WorldStorageService` gains `linkedCopies` and `updateWorldContent`; the second exists because
`storeWorld` takes a whole record and would blank the wrapper fields a background write has no reason
to know.

### Three notes for the author

1. **A row offers three actions, not four.** This ticket names Update, Keep Mine, Use Author's and
   Unlink. Update and Use Author's are one operation under two names, so the dropdown shows the name
   that fits the row: an unmodified copy reads **Update**, a local replacement reads **Use Author's**.
   The spec's own Review Updates table says the same ("For locally edited content, the dropdown offers
   **Keep mine** and **Use author's**"). Say if you want all four on every row instead.
2. **The world's own Check linked content updates action is not here.** The spec asks for it beside the
   per-copy one ("Offer **Check linked content updates** in the world's actions"), but this ticket's own
   brief names only a library item and a linked copy, and ticket 09 owns the world-level review. Say if
   it belongs in this unit.
3. **The editor still synchronizes owned copies on open.** `syncFromLibrary` runs in an effect when the
   World Editor mounts and brings every owned, unmodified linked copy up to date on its own. That is
   ticket 02's behavior, not this unit's, but it means a copy of your own item is rarely behind by the
   time you press Check for Updates in the editor. Another author's item and every local replacement
   still reach the review. Say if that automatic pass should go.
