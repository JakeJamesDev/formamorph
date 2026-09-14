# 11: Files carry relationships

Status: ready-for-human
Base: 4ca9e7ce
Status note: Built. Every acceptance criterion passes. Two calls are open for the author; see Comments.
Blocked by: 01, 08
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Model rationale: touches the export shape of worlds and components, three import paths, offline behavior, and an older-importer compatibility check; regressions here corrupt player files.

## Parent

[spec.md](../spec.md) — Export/import portability, Settled follow-up decisions (Portability), open question 11.

## What to build

Exported files keep enough to reconnect content later, and imports respect what the file says.

A world export bundles its content in the native collections as today and adds relationship metadata: each linked copy's source identity, held revision, and a local-replacement marker where the player's edits diverge. A component export carries the component and its world associations, never a world. Both are additive; today's importer preserves unknown fields, and a test proves a file with these fields loads in the previous shape's reader without loss.

Importing a world file lands in the world details window as today, with a **Link bundled content to My Library** choice in the preference strip. Linked, the bundled content becomes the installed version and later source revisions arrive through update review; unlinked, the components are embedded. A local replacement in the file stays a local replacement on import; the file's content wins over a library copy. Importing a component file reviews the content name, offers installed compatible worlds to link and online worlds to download, and imports standalone when none is chosen. When the component's source already has a library item, Import opens that item's update review with the file as the incoming revision. Offline import proceeds from the bundle; unverifiable relationships stay unresolved and are not treated as deletions.

This is an export-shape change. Say so in the response and do not bump the version.

## Acceptance criteria

- [x] A world export contains relationship metadata for each linked copy and a marker on each local replacement; re-import restores both.
- [x] A component export contains the component and its associations and no world data.
- [x] Importing a world with Link bundled content on links the copies to library items; off embeds them.
- [x] Importing a world whose local replacement conflicts with a library copy keeps the file's content as a local replacement.
- [x] Importing a component whose source has a library item opens the update review; otherwise it offers compatible worlds and imports standalone when none is chosen.
- [x] Offline import of the same files completes with associations left unresolved and nothing reported missing.
- [x] A reader built to the previous shape loads the new file without dropping data, proven by a fixture test.
- [x] Type check, lint, tests, and build pass; the response names the export-shape change.

## Blocked by

- 01 — Link metadata on world content.
- 08 — Component update review.

## Comments

### Handover (2026-09-13)

Built. Gates, all run in the closing pass: `typecheck` 0 errors, `lint` 0 errors, `test` 10061 passed
across 618 files in 73.8 s, `build` succeeded in 15.5 s. Two full-suite runs earlier reported flaky
failures in `ChipTypeahead.test.tsx` and `CodeArea.test.tsx`; both files pass alone and this unit touches
neither. `useDeviceDownload.test.tsx` did fail on the export-shape change and was updated with it.

**This is an export-shape change.** World files gain `link.bundledFrom`; entity cards and dictionary
files gain `source` and `associations`. All three are additive, and a reader built to the previous shape
loads the new files without loss (`fileShapeCompat.test.ts`). No version bump and no migration.

**Where it lives.**
- `componentFileLinks.ts` is the file shape: the `source` and `associations` blocks and their readers.
  `componentExportLinks.ts` gathers them, which is the only half that reads storage.
- `worldBundle.ts` is the pure world-import half: resolving each record against the local library,
  grouping the bundled copies, and linking or embedding them. `worldBundleRun.ts` runs it against
  storage.
- `componentImport.ts` matches a file's associations against installed worlds.
  `useComponentFileImport.tsx` drives the review, and `addToStoredWorld.ts` writes a linked copy into a
  world that is not open in the editor.
- `BundledContentChoice.tsx` is the preference-strip control.
  `useComponentUpdates.reviewImportedFile` opens the update review with a file as the incoming revision.

**Verified end to end in the app.** `#dev?view=mainMenu&modal=importComponent` raises the import review
on a canned file. Importing with a world ticked placed the character in the library and wrote one linked
copy into that world, holding the file's own content. The world details window's **Link bundled content
to My Library** placed a library item, pointed the world's copy at it, and left the content untouched;
unchecking released it. Mobile width checked at 375px.

### Two calls for the author

1. **A world you do not have is handed to Community Creations, not downloaded from the review.** The
   ticket says the review "offers ... online worlds to download". Each such world gets a **Find It**
   button that opens Community Creations on that listing, where the ordinary world download runs with
   its dependency review, add-on tabs and overwrite decision. Downloading from inside the import review
   would need a second copy of that whole flow in the main menu. Say if you want the download there
   instead.
2. **A component file with no relationships imports in one step, as it always did.** The review opens
   for a lone file that carries a `source` or an `associations` block. A plain character card or
   dictionary with neither has no worlds to offer and no source to compare, so it lands straight in the
   library rather than raising a dialog with nothing in it. Say if every single-file import should
   review first.
