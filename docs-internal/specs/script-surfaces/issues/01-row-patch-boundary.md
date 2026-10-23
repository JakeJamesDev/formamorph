# 01: Row Patch Boundary

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: a small shared helper, a callback shape change across three surfaces, and a bench test per surface; the design is settled, the care is in not changing what a row writes.

## What to build

A script row can no longer hand anything but a Script edit to the world (spec: Row patch boundary; Q2, Q6). The row's change callback reports a partial Script: the field that changed and its value. A cleared name reports the name as absent, so the fallback label shows and nothing exports, as today. One helper in the scripts library merges a patch onto the script with the given id inside a list, returning the same list when nothing changed. The owner panels' Scripts section and the Scripts tab's home-based edit both merge through it. Remove stays its own callback; a Timing change is a patch.

With the row reporting patches, the runtime pick that reduces each Scripts tab entry to the Script shape goes away. The entry keeps carrying the code box under its own field for navigation and context, never as what a row writes. The guard moves to the row.

## Acceptance criteria

- [x] Helper tests: a patch merges onto the right id and leaves every other script by reference; a cleared name drops the field; a patch that changes nothing returns the same list; an unknown id returns the same list. (`scripts.test.ts` › patchScript; removing the drop loop turned the cleared-name test red.)
- [x] A row-level guard: a test that fails when the row's change callback carries any key outside the Script fields, proven by reinstating a spread of the whole row object. (`ScriptsSection.test.tsx`; reinstating `onChange({ ...script, code })` turned it red.)
- [x] Scripts tab edit tests: a patch on a global stat's, an entity stat's, a trait's, a link override's and a world script writes the patched script and nothing else into its home. (`worldScripts.test.ts` › editScripts `it.each`, other scripts asserted as the stored records.)
- [x] Bench tests (worldEditorBench): typing in a script box on the stat panel, the trait tab and the Scripts tab leaves one changed field on the stored script and no extra keys; a fast run of keystrokes on the Scripts tab keeps the script's JSON length within the typed text; a rename, a Timing change and a remove behave the same on each surface. (`WorldEditor.scriptSurfaces.test.tsx`, six surfaces incl. Scripts tab on a stat, trait, entity stat and world script; the old bug reinstated turned the Scripts tab cases red.)
- [x] The field-list pick in the entries builder is gone and the entries test that pinned its keys is replaced by the row guard. (Per T01-1 the keys test stays beside the guard and asserts `entry.script` is the stored record by reference.)
- [x] No changelog fragment: the fix that players see shipped on 2026-10-22; this hardens it.

## Landed

**Not verified**
- None.

**For you**
- Type fast in a stat's script on the World Editor's **Scripts** tab; the editor stays responsive and the stat's own Scripts tab shows the same code.
